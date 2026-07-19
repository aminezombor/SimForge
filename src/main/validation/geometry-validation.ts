import { randomUUID } from 'node:crypto';
import type {
  ProposedFix,
  SceneObject,
  SceneSnapshot,
  ValidationFinding,
  ValidationRun,
  ValidationSeverity,
} from '../../shared/contracts';
import { sha256 } from '../../shared/hash';

const EPSILON = 1e-6;
const CONTACT_TOLERANCE = 1e-3;
const COMPLEXITY_WARNING_VERTICES = 250_000;

type FindingDraft = Omit<ValidationFinding, 'id' | 'runId' | 'createdAt' | 'status'>;

export interface ValidationOptions {
  runId?: string;
  now?: string;
}

export function validateGeometry(
  snapshot: SceneSnapshot,
  options: ValidationOptions = {},
): ValidationRun {
  const runId = options.runId ?? randomUUID();
  const now = options.now ?? new Date().toISOString();
  const drafts: FindingDraft[] = [];
  const add = (draft: FindingDraft) => drafts.push(draft);

  validateSceneSettings(snapshot, add);
  validateObjects(snapshot, add);
  validateHierarchy(snapshot, add);
  validateIntersections(snapshot, add);
  validateExternalFiles(snapshot, add);

  const findings = drafts
    .sort(compareDrafts)
    .map((draft) => ({
      ...draft,
      id: `${runId}:${draft.ruleId}:${sha256(draft.entityPath).slice(0, 12)}`,
      runId,
      status: 'OPEN' as const,
      createdAt: now,
    }));
  return {
    id: runId,
    projectId: snapshot.projectId,
    sceneRevision: snapshot.sceneRevision,
    startedAt: now,
    completedAt: now,
    status: 'COMPLETED',
    channels: ['fresh-blender-snapshot', 'deterministic-geometry-metadata'],
    summary: summarize(findings),
    findings,
  };
}

function validateSceneSettings(
  snapshot: SceneSnapshot,
  add: (finding: FindingDraft) => void,
): void {
  if (snapshot.unitSystem !== 'METRIC' || !approximately(snapshot.unitScale, 1)) {
    add({
      ruleId: 'GEO-UNIT-001',
      domain: 'scene',
      severity: 'error',
      entityPath: '/scene/settings/units',
      message: 'Scene units must be metric with a scale of one meter.',
      deterministicEvidence: {
        unitSystem: snapshot.unitSystem,
        unitScale: snapshot.unitScale,
        expectedUnitSystem: 'METRIC',
        expectedUnitScale: 1,
      },
      assumptions: [],
      proposedFix: null,
    });
  }
}

function validateObjects(
  snapshot: SceneSnapshot,
  add: (finding: FindingDraft) => void,
): void {
  const nameCounts = new Map<string, number>();
  for (const object of snapshot.objects) {
    nameCounts.set(object.name, (nameCounts.get(object.name) ?? 0) + 1);
  }

  for (const object of [...snapshot.objects].sort((a, b) => a.id.localeCompare(b.id))) {
    const entityPath = objectPath(object);
    if (object.scale.some((value) => !approximately(value, 1))) {
      add({
        ruleId: 'GEO-TRANSFORM-001',
        domain: 'geometry',
        severity: 'warning',
        entityPath,
        message: 'Object has unapplied or negative scale.',
        deterministicEvidence: { scale: object.scale, expectedScale: [1, 1, 1] },
        assumptions: [],
        proposedFix: structuralScaleFix(snapshot, object),
      });
    }
    if (object.type === 'MESH' && object.dimensions.some((value) => value <= EPSILON)) {
      add({
        ruleId: 'GEO-DIMENSION-001',
        domain: 'geometry',
        severity: 'error',
        entityPath,
        message: 'Mesh has a zero or near-zero world dimension.',
        deterministicEvidence: { dimensions: object.dimensions, epsilon: EPSILON },
        assumptions: [],
        proposedFix: null,
      });
    }
    if (object.worldBounds && !pointInsideBounds(object.location, object.worldBounds)) {
      add({
        ruleId: 'GEO-ORIGIN-001',
        domain: 'geometry',
        severity: 'info',
        entityPath,
        message: 'Object origin lies outside its world-space bounds.',
        deterministicEvidence: { origin: object.location, worldBounds: object.worldBounds },
        assumptions: ['An external origin can be intentional and requires human review.'],
        proposedFix: null,
      });
    }
    if (object.type === 'MESH' && object.worldBounds && object.parentId === null) {
      const minZ = object.worldBounds.min[2];
      if (Math.abs(minZ) > CONTACT_TOLERANCE) {
        const direction = minZ > 0 ? 'floats above' : 'penetrates below';
        add({
          ruleId: 'GEO-CONTACT-001',
          domain: 'geometry',
          severity: minZ > 0 ? 'warning' : 'error',
          entityPath,
          message: `Root mesh ${direction} the Z=0 support plane.`,
          deterministicEvidence: {
            minimumWorldZ: minZ,
            supportPlaneZ: 0,
            tolerance: CONTACT_TOLERANCE,
          },
          assumptions: ['Z=0 is the selected project support plane.'],
          proposedFix: groundContactFix(snapshot, object, minZ),
        });
      }
    }
    if (!object.visible) {
      add({
        ruleId: 'GEO-VISIBILITY-001',
        domain: 'scene',
        severity: 'info',
        entityPath,
        message: 'Object is hidden from the active view layer or render.',
        deterministicEvidence: { visible: object.visible },
        assumptions: ['Hidden objects may be intentional and require human review.'],
        proposedFix: null,
      });
    }
    if ((nameCounts.get(object.name) ?? 0) > 1 || /\.\d{3}$/.test(object.name)) {
      add({
        ruleId: 'GEO-NAMING-001',
        domain: 'scene',
        severity: 'warning',
        entityPath,
        message: 'Object name is duplicated or uses an auto-generated numeric suffix.',
        deterministicEvidence: {
          name: object.name,
          occurrences: nameCounts.get(object.name) ?? 1,
          numericSuffix: /\.\d{3}$/.test(object.name),
        },
        assumptions: [],
        proposedFix: null,
      });
    }
    if (object.type === 'MESH' && object.materialNames.length === 0) {
      add({
        ruleId: 'GEO-MATERIAL-001',
        domain: 'materials',
        severity: 'warning',
        entityPath,
        message: 'Mesh has no assigned material.',
        deterministicEvidence: { materialSlotCount: 0 },
        assumptions: ['Material appearance is a creative decision and is never auto-invented.'],
        proposedFix: null,
      });
    }
    validateMeshEvidence(object, entityPath, add);
  }
}

function validateMeshEvidence(
  object: SceneObject,
  entityPath: string,
  add: (finding: FindingDraft) => void,
): void {
  const mesh = object.mesh;
  if (!mesh) return;
  const topologyChecks: Array<{
    ruleId: string;
    count: number;
    label: string;
    severity: ValidationSeverity;
  }> = [
    { ruleId: 'GEO-TOPOLOGY-001', count: mesh.nonManifoldEdgeCount, label: 'non-manifold edges', severity: 'error' },
    { ruleId: 'GEO-TOPOLOGY-002', count: mesh.looseVertexCount, label: 'loose vertices', severity: 'warning' },
    { ruleId: 'GEO-TOPOLOGY-003', count: mesh.degenerateFaceCount, label: 'degenerate faces', severity: 'error' },
    { ruleId: 'GEO-TOPOLOGY-004', count: mesh.zeroLengthEdgeCount, label: 'zero-length edges', severity: 'error' },
    { ruleId: 'GEO-NORMAL-001', count: mesh.normalIssueCount, label: 'invalid face normals', severity: 'error' },
  ];
  for (const check of topologyChecks) {
    if (check.count === 0) continue;
    add({
      ruleId: check.ruleId,
      domain: 'topology',
      severity: check.severity,
      entityPath,
      message: `Mesh contains ${check.count} ${check.label}.`,
      deterministicEvidence: { count: check.count },
      assumptions: [],
      proposedFix: null,
    });
  }
  if (mesh.vertexCount > COMPLEXITY_WARNING_VERTICES) {
    add({
      ruleId: 'GEO-COMPLEXITY-001',
      domain: 'topology',
      severity: 'warning',
      entityPath,
      message: 'Mesh exceeds the hackathon complexity review threshold.',
      deterministicEvidence: {
        vertexCount: mesh.vertexCount,
        warningThreshold: COMPLEXITY_WARNING_VERTICES,
      },
      assumptions: ['The threshold is a review signal, not a correctness limit.'],
      proposedFix: null,
    });
  }
}

function validateHierarchy(
  snapshot: SceneSnapshot,
  add: (finding: FindingDraft) => void,
): void {
  const byId = new Map(snapshot.objects.map((object) => [object.id, object]));
  for (const object of snapshot.objects) {
    if (object.parentId && !byId.has(object.parentId)) {
      add({
        ruleId: 'GEO-HIERARCHY-001',
        domain: 'scene',
        severity: 'error',
        entityPath: objectPath(object),
        message: 'Object references a parent that is absent from the snapshot.',
        deterministicEvidence: { parentId: object.parentId },
        assumptions: [],
        proposedFix: null,
      });
      continue;
    }
    const visited = new Set<string>();
    let cursor: SceneObject | undefined = object;
    while (cursor?.parentId) {
      if (visited.has(cursor.parentId)) {
        add({
          ruleId: 'GEO-HIERARCHY-002',
          domain: 'scene',
          severity: 'blocker',
          entityPath: objectPath(object),
          message: 'Hierarchy contains a parent cycle.',
          deterministicEvidence: { repeatedParentId: cursor.parentId },
          assumptions: [],
          proposedFix: null,
        });
        break;
      }
      visited.add(cursor.id);
      cursor = byId.get(cursor.parentId);
    }
  }
}

function validateIntersections(
  snapshot: SceneSnapshot,
  add: (finding: FindingDraft) => void,
): void {
  const objects = snapshot.objects
    .filter((object) => object.type === 'MESH' && object.worldBounds && object.parentId === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (let leftIndex = 0; leftIndex < objects.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < objects.length; rightIndex += 1) {
      const left = objects[leftIndex];
      const right = objects[rightIndex];
      if (!left?.worldBounds || !right?.worldBounds) continue;
      const overlap = boundsOverlap(left.worldBounds, right.worldBounds);
      if (overlap.every((value) => value > CONTACT_TOLERANCE)) {
        add({
          ruleId: 'GEO-INTERSECTION-001',
          domain: 'geometry',
          severity: 'info',
          entityPath: `/intersections/${escapePath(left.id)}/${escapePath(right.id)}`,
          message: 'Root mesh world bounds overlap on all three axes.',
          deterministicEvidence: {
            leftObjectId: left.id,
            rightObjectId: right.id,
            axisOverlap: overlap,
            tolerance: CONTACT_TOLERANCE,
          },
          assumptions: ['Bounding-box overlap is a conservative signal; mesh penetration requires deeper review.'],
          proposedFix: null,
        });
      }
    }
  }
}

function validateExternalFiles(
  snapshot: SceneSnapshot,
  add: (finding: FindingDraft) => void,
): void {
  for (const file of [...snapshot.externalFiles].sort((a, b) => (
    `${a.kind}:${a.datablock}:${a.path}`.localeCompare(`${b.kind}:${b.datablock}:${b.path}`)
  ))) {
    if (file.packed || file.exists) continue;
    add({
      ruleId: 'GEO-REFERENCE-001',
      domain: 'references',
      severity: 'error',
      entityPath: `/external-files/${escapePath(file.kind)}/${escapePath(file.datablock)}`,
      message: 'External file reference is missing and is not packed into the Blender source.',
      deterministicEvidence: {
        kind: file.kind,
        datablock: file.datablock,
        path: file.path,
        exists: file.exists,
        packed: file.packed,
      },
      assumptions: [],
      proposedFix: null,
    });
  }
}

function groundContactFix(snapshot: SceneSnapshot, object: SceneObject, minimumWorldZ: number): ProposedFix {
  const location: [number, number, number] = [
    object.location[0],
    object.location[1],
    object.location[2] - minimumWorldZ,
  ];
  return {
    id: `FIX-GEO-CONTACT-001:${object.id}`,
    label: 'Move root object to the Z=0 support plane',
    fixClass: 'SAFE_LOCAL',
    toolId: 'object.set_location',
    args: { objectId: object.id, location },
    preconditions: {
      sceneRevision: snapshot.sceneRevision,
      objectId: object.id,
      expectedLocation: object.location,
    },
    reversible: true,
    approvalRequired: false,
  };
}

function structuralScaleFix(snapshot: SceneSnapshot, object: SceneObject): ProposedFix {
  return {
    id: `FIX-GEO-TRANSFORM-001:${object.id}`,
    label: 'Apply object scale while preserving world geometry',
    fixClass: 'STRUCTURAL',
    toolId: 'object.apply_scale',
    args: { objectId: object.id },
    preconditions: {
      sceneRevision: snapshot.sceneRevision,
      objectId: object.id,
      expectedScale: object.scale,
    },
    reversible: false,
    approvalRequired: true,
  };
}

function summarize(findings: ValidationFinding[]): ValidationRun['summary'] {
  const summary = { blocker: 0, error: 0, warning: 0, info: 0 };
  for (const finding of findings) summary[finding.severity] += 1;
  return summary;
}

function compareDrafts(left: FindingDraft, right: FindingDraft): number {
  return left.ruleId.localeCompare(right.ruleId) || left.entityPath.localeCompare(right.entityPath);
}

function objectPath(object: SceneObject): string {
  return `/objects/${escapePath(object.id)}`;
}

function escapePath(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function approximately(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON;
}

function pointInsideBounds(
  point: [number, number, number],
  bounds: NonNullable<SceneObject['worldBounds']>,
): boolean {
  return point.every((value, axis) => (
    value >= bounds.min[axis]! - CONTACT_TOLERANCE &&
    value <= bounds.max[axis]! + CONTACT_TOLERANCE
  ));
}

function boundsOverlap(
  left: NonNullable<SceneObject['worldBounds']>,
  right: NonNullable<SceneObject['worldBounds']>,
): [number, number, number] {
  return [0, 1, 2].map((axis) => (
    Math.min(left.max[axis]!, right.max[axis]!) -
    Math.max(left.min[axis]!, right.min[axis]!)
  )) as [number, number, number];
}
