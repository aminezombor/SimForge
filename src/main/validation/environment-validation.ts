import { randomUUID } from 'node:crypto';
import type {
  EnvironmentGraph,
  SceneSnapshot,
  ValidationFinding,
  ValidationRun,
} from '../../shared/contracts';
import { sha256 } from '../../shared/hash';

const TOLERANCE = 1e-4;
const CONTACT_TOLERANCE = 1e-2;
type FindingDraft = Omit<ValidationFinding, 'id' | 'runId' | 'createdAt' | 'status'>;

export function validateEnvironment(
  snapshot: SceneSnapshot,
  graph: EnvironmentGraph,
  options: { runId?: string; now?: string } = {},
): ValidationRun {
  const runId = options.runId ?? randomUUID();
  const now = options.now ?? new Date().toISOString();
  const drafts: FindingDraft[] = [];
  const add = (finding: FindingDraft) => drafts.push(finding);
  const environmentObjects = snapshot.objects.filter((object) => (
    object.metadata['simforge.environment.id'] === graph.environmentId
  ));
  const role = (value: string) => environmentObjects.filter((object) => object.metadata['simforge.role'] === value);
  const visuals = new Map(role('environment-object').map((object) => [String(object.metadata['simforge.environment.object.id']), object]));
  const collisions = new Map(role('environment-collision').map((object) => [String(object.metadata['simforge.environment.collision.object_id']), object]));

  if (graph.units !== 'meters' || graph.coordinateConvention !== 'right-handed-z-up') {
    addFinding(add, graph, 'ENV-CONVENTION-001', 'scene', 'blocker', '',
      'EnvironmentGraph uses an unsupported unit or coordinate convention.', {
        units: graph.units,
        coordinateConvention: graph.coordinateConvention,
      });
  }
  const roots = role('environment-root');
  if (roots.length !== 1) {
    addFinding(add, graph, 'ENV-ROOT-001', 'scene', 'blocker', '/root',
      'Environment must materialize exactly one stable root.', { rootCount: roots.length, expected: 1 });
  }
  const materialIds = new Set(graph.materials.map((material) => material.id));
  for (const entry of graph.objects) {
    const object = visuals.get(entry.id);
    const path = `/objects/${escapePath(entry.id)}`;
    if (!object) {
      addFinding(add, graph, 'ENV-OBJECT-001', 'scene', 'blocker', path,
        'Declared environment object is absent from the fresh Blender snapshot.', { objectId: entry.id });
      continue;
    }
    const positionError = distance(object.worldLocation, entry.pose.position);
    const rotationError = distance(object.worldRotation, entry.pose.rotationEuler, true);
    if (positionError > TOLERANCE || rotationError > TOLERANCE) {
      addFinding(add, graph, 'ENV-POSE-001', 'scene', 'error', path,
        'Environment object pose differs from the approved graph.', {
          expectedPosition: entry.pose.position,
          actualPosition: object.worldLocation,
          positionError,
          expectedRotationEuler: entry.pose.rotationEuler,
          actualRotationEuler: object.worldRotation,
          rotationError,
        });
    }
    if (!materialIds.has(entry.materialId) || object.materialNames.length === 0) {
      addFinding(add, graph, 'ENV-MATERIAL-001', 'materials', 'error', path,
        'Environment object is missing its declared material.', {
          materialId: entry.materialId,
          materialNames: object.materialNames,
        });
    }
    if (object.metadata['simforge.environment.static'] !== entry.static) {
      addFinding(add, graph, 'ENV-STATIC-001', 'physics', 'error', path,
        'Environment static/dynamic metadata differs from the approved graph.', {
          expectedStatic: entry.static,
          actualStatic: object.metadata['simforge.environment.static'] ?? null,
        });
    }
    const collision = collisions.get(entry.id);
    if (Boolean(entry.collision) !== Boolean(collision)) {
      addFinding(add, graph, 'ENV-COLLISION-001', 'physics', 'error', `${path}/collision`,
        'Environment collision representation does not match its declaration.', {
          declaredCollision: Boolean(entry.collision),
          materializedCollision: Boolean(collision),
        });
    }
    if (entry.support === 'GROUND' && collision?.worldBounds) {
      const minimumZ = collision.worldBounds.min[2];
      if (Math.abs(minimumZ) > CONTACT_TOLERANCE) {
        addFinding(add, graph, 'ENV-CONTACT-001', 'physics', 'error', `${path}/support`,
          'Ground-supported environment collision does not contact Z=0.', {
            minimumCollisionWorldZ: minimumZ,
            supportPlaneZ: 0,
            tolerance: CONTACT_TOLERANCE,
          }, ['Z=0 is the selected project support plane.']);
      }
    }
  }

  const findings = drafts
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId) || left.entityPath.localeCompare(right.entityPath))
    .map((draft) => ({
      ...draft,
      id: `${runId}:${draft.ruleId}:${sha256(draft.entityPath).slice(0, 12)}`,
      runId,
      status: 'OPEN' as const,
      createdAt: now,
    }));
  const summary = { blocker: 0, error: 0, warning: 0, info: 0 };
  for (const finding of findings) summary[finding.severity] += 1;
  return {
    id: runId,
    projectId: snapshot.projectId,
    sceneRevision: snapshot.sceneRevision,
    startedAt: now,
    completedAt: now,
    status: 'COMPLETED',
    channels: ['fresh-blender-snapshot', 'deterministic-environment'],
    summary,
    findings,
  };
}

function addFinding(
  add: (finding: FindingDraft) => void,
  graph: EnvironmentGraph,
  ruleId: string,
  domain: ValidationFinding['domain'],
  severity: ValidationFinding['severity'],
  suffix: string,
  message: string,
  evidence: Record<string, unknown>,
  assumptions: string[] = [],
): void {
  add({
    ruleId,
    domain,
    severity,
    entityPath: `/environments/${escapePath(graph.environmentId)}${suffix}`,
    message,
    deterministicEvidence: evidence,
    assumptions,
    proposedFix: null,
  });
}

function distance(
  left: [number, number, number],
  right: [number, number, number],
  angles = false,
): number {
  return Math.hypot(...left.map((value, index) => {
    const delta = value - right[index]!;
    return angles ? Math.atan2(Math.sin(delta), Math.cos(delta)) : delta;
  }));
}

function escapePath(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
