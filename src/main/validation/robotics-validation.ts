import { randomUUID } from 'node:crypto';
import type {
  RobotGraph,
  RobotJoint,
  RobotLink,
  SceneObject,
  SceneSnapshot,
  ValidationFinding,
  ValidationRun,
} from '../../shared/contracts';
import { sha256 } from '../../shared/hash';

const AXIS_TOLERANCE = 1e-6;
const CONTACT_TOLERANCE = 1e-2;

type FindingDraft = Omit<ValidationFinding, 'id' | 'runId' | 'createdAt' | 'status'>;

export function validateRobotics(
  snapshot: SceneSnapshot,
  graph: RobotGraph,
  options: { runId?: string; now?: string } = {},
): ValidationRun {
  const runId = options.runId ?? randomUUID();
  const now = options.now ?? new Date().toISOString();
  const drafts: FindingDraft[] = [];
  const add = (finding: FindingDraft) => drafts.push(finding);
  const links = new Map(graph.links.map((link) => [link.id, link]));
  const robotObjects = snapshot.objects.filter((object) => object.metadata['simforge.robot.id'] === graph.robotId);
  const role = (name: string) => robotObjects.filter((object) => object.metadata['simforge.role'] === name);
  const linkObjects = new Map(role('link').map((object) => [String(object.metadata['simforge.link.id']), object]));
  const collisionObjects = new Map(role('collision').map((object) => [String(object.metadata['simforge.collision.link_id']), object]));
  const jointObjects = new Map(role('joint').map((object) => [String(object.metadata['simforge.joint.id']), object]));
  const sensorObjects = new Map(role('sensor').map((object) => [String(object.metadata['simforge.sensor.id']), object]));

  validateConvention(graph, add);
  validateRoot(graph, role('robot-root'), add);
  validateLinks(graph, linkObjects, collisionObjects, add);
  validateKinematics(graph, links, linkObjects, jointObjects, add);
  validateSensors(graph, links, linkObjects, sensorObjects, add);
  validateGroundContact(graph, collisionObjects, add);

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
    channels: ['fresh-blender-snapshot', 'deterministic-robotics'],
    summary,
    findings,
  };
}

function validateConvention(graph: RobotGraph, add: (finding: FindingDraft) => void): void {
  if (
    graph.units !== 'meters-kilograms-radians' ||
    graph.coordinateConvention !== 'right-handed-z-up-x-forward'
  ) {
    add({
      ruleId: 'ROB-CONVENTION-001',
      domain: 'robotics',
      severity: 'blocker',
      entityPath: robotPath(graph),
      message: 'RobotGraph uses an unsupported units or coordinate convention.',
      deterministicEvidence: {
        units: graph.units,
        coordinateConvention: graph.coordinateConvention,
      },
      assumptions: [],
      proposedFix: null,
    });
  }
  if (!graph.selfCollision.note.trim()) {
    add({
      ruleId: 'ROB-COLLISION-002',
      domain: 'physics',
      severity: 'warning',
      entityPath: `${robotPath(graph)}/self-collision`,
      message: 'Self-collision policy has no recorded consideration.',
      deterministicEvidence: { policy: graph.selfCollision.policy },
      assumptions: [],
      proposedFix: null,
    });
  }
}

function validateRoot(
  graph: RobotGraph,
  roots: SceneObject[],
  add: (finding: FindingDraft) => void,
): void {
  if (roots.length !== 1) {
    add({
      ruleId: 'ROB-ROOT-001',
      domain: 'robotics',
      severity: 'blocker',
      entityPath: `${robotPath(graph)}/articulation-root`,
      message: 'Robot must materialize exactly one articulation root object.',
      deterministicEvidence: { rootObjectCount: roots.length, expected: 1 },
      assumptions: [],
      proposedFix: null,
    });
    return;
  }
  const root = roots[0]!;
  if (root.metadata['simforge.robot.root_link'] !== graph.rootLinkId) {
    add({
      ruleId: 'ROB-ROOT-002',
      domain: 'robotics',
      severity: 'error',
      entityPath: `${robotPath(graph)}/articulation-root`,
      message: 'Materialized articulation root does not identify the RobotGraph root link.',
      deterministicEvidence: {
        expectedRootLinkId: graph.rootLinkId,
        actualRootLinkId: root.metadata['simforge.robot.root_link'] ?? null,
      },
      assumptions: [],
      proposedFix: null,
    });
  }
}

function validateLinks(
  graph: RobotGraph,
  linkObjects: Map<string, SceneObject>,
  collisionObjects: Map<string, SceneObject>,
  add: (finding: FindingDraft) => void,
): void {
  const materialIds = new Set(graph.materials.map((material) => material.id));
  for (const link of graph.links) {
    const entityPath = linkPath(graph, link.id);
    const object = linkObjects.get(link.id);
    if (!object) {
      add({
        ruleId: 'ROB-LINK-001',
        domain: 'robotics',
        severity: 'blocker',
        entityPath,
        message: 'Robot link is absent from the fresh Blender snapshot.',
        deterministicEvidence: { linkId: link.id },
        assumptions: [],
        proposedFix: null,
      });
    } else if (object.materialNames.length === 0 || !materialIds.has(link.materialId)) {
      add({
        ruleId: 'ROB-MATERIAL-001',
        domain: 'materials',
        severity: 'error',
        entityPath,
        message: 'Robot link is missing its declared material assignment.',
        deterministicEvidence: {
          declaredMaterialId: link.materialId,
          materialNames: object.materialNames,
        },
        assumptions: [],
        proposedFix: null,
      });
    }
    if (object) {
      const positionError = Math.hypot(
        object.worldLocation[0] - link.pose.position[0],
        object.worldLocation[1] - link.pose.position[1],
        object.worldLocation[2] - link.pose.position[2],
      );
      const rotationError = Math.hypot(
        angleDelta(object.worldRotation[0], link.pose.rotationEuler[0]),
        angleDelta(object.worldRotation[1], link.pose.rotationEuler[1]),
        angleDelta(object.worldRotation[2], link.pose.rotationEuler[2]),
      );
      if (positionError > 1e-4 || rotationError > 1e-4) {
        add({
          ruleId: 'ROB-LINK-POSE-001',
          domain: 'robotics',
          severity: 'error',
          entityPath,
          message: 'Materialized link pose differs from the approved RobotGraph.',
          deterministicEvidence: {
            expectedPosition: link.pose.position,
            actualPosition: object.worldLocation,
            positionError,
            expectedRotationEuler: link.pose.rotationEuler,
            actualRotationEuler: object.worldRotation,
            rotationError,
          },
          assumptions: [],
          proposedFix: null,
        });
      }
      const sceneMass = object.metadata['simforge.mass.kg'];
      const sceneInertia = object.metadata['simforge.inertia.diagonal_kg_m2'];
      if (
        (link.massKg.value !== null && sceneMass !== link.massKg.value) ||
        (link.inertiaDiagonalKgM2.value !== null && !numericVectorEqual(sceneInertia, link.inertiaDiagonalKgM2.value))
      ) {
        add({
          ruleId: 'ROB-PHYSICS-METADATA-001',
          domain: 'physics',
          severity: 'error',
          entityPath,
          message: 'Materialized Blender physical metadata differs from the RobotGraph.',
          deterministicEvidence: {
            graphMassKg: link.massKg.value,
            sceneMassKg: sceneMass ?? null,
            graphInertiaDiagonalKgM2: link.inertiaDiagonalKgM2.value,
            sceneInertiaDiagonalKgM2: sceneInertia ?? null,
          },
          assumptions: [],
          proposedFix: null,
        });
      }
    }
    validatePhysicalValues(graph, link, entityPath, add);
    if (!link.collision || !collisionObjects.has(link.id)) {
      add({
        ruleId: 'ROB-COLLISION-001',
        domain: 'physics',
        severity: 'error',
        entityPath: `${entityPath}/collision`,
        message: 'Robot link has no declared and materialized collision primitive.',
        deterministicEvidence: {
          graphCollision: Boolean(link.collision),
          sceneCollision: collisionObjects.has(link.id),
        },
        assumptions: [],
        proposedFix: null,
      });
    }
    if (!link.physicsMaterialId) {
      add({
        ruleId: 'ROB-PHYSICS-MATERIAL-001',
        domain: 'physics',
        severity: 'warning',
        entityPath,
        message: 'Robot link has no physics-material identifier.',
        deterministicEvidence: { physicsMaterialId: null },
        assumptions: ['Contact behavior cannot be inferred from the visual material.'],
        proposedFix: null,
      });
    }
  }
}

function validatePhysicalValues(
  graph: RobotGraph,
  link: RobotLink,
  entityPath: string,
  add: (finding: FindingDraft) => void,
): void {
  if (link.massKg.value === null) {
    add(unknownPhysicalFinding('ROB-MASS-001', entityPath, 'mass', link.massKg.note));
  } else if (link.massKg.value <= 0) {
    add({
      ruleId: 'ROB-MASS-002',
      domain: 'physics',
      severity: 'error',
      entityPath,
      message: 'Dynamic link mass must be greater than zero.',
      deterministicEvidence: { massKg: link.massKg.value, dynamic: link.dynamic },
      assumptions: [],
      proposedFix: null,
    });
  }
  validateAssumptionSource(graph, link.id, 'mass', link.massKg.source, link.massKg.note, add);

  const inertia = link.inertiaDiagonalKgM2.value;
  if (inertia === null) {
    add(unknownPhysicalFinding('ROB-INERTIA-001', entityPath, 'inertia', link.inertiaDiagonalKgM2.note));
  } else {
    const positive = inertia.every((value) => value > 0);
    const triangle = (
      inertia[0] <= inertia[1] + inertia[2] + AXIS_TOLERANCE &&
      inertia[1] <= inertia[0] + inertia[2] + AXIS_TOLERANCE &&
      inertia[2] <= inertia[0] + inertia[1] + AXIS_TOLERANCE
    );
    if (!positive || !triangle) {
      add({
        ruleId: 'ROB-INERTIA-002',
        domain: 'physics',
        severity: 'error',
        entityPath,
        message: 'Inertia diagonal must be positive and satisfy rigid-body triangle inequalities.',
        deterministicEvidence: { inertiaDiagonalKgM2: inertia, positive, triangle },
        assumptions: [],
        proposedFix: null,
      });
    }
  }
  validateAssumptionSource(
    graph,
    link.id,
    'inertia',
    link.inertiaDiagonalKgM2.source,
    link.inertiaDiagonalKgM2.note,
    add,
  );
  if (link.centerOfMassM.value === null) {
    add(unknownPhysicalFinding('ROB-COM-001', entityPath, 'center of mass', link.centerOfMassM.note));
  } else if (link.centerOfMassM.value.some((value) => !Number.isFinite(value))) {
    add({
      ruleId: 'ROB-COM-002',
      domain: 'physics',
      severity: 'error',
      entityPath,
      message: 'Center of mass contains a non-finite value.',
      deterministicEvidence: { centerOfMassM: link.centerOfMassM.value },
      assumptions: [],
      proposedFix: null,
    });
  }
}

function validateKinematics(
  graph: RobotGraph,
  links: Map<string, RobotLink>,
  linkObjects: Map<string, SceneObject>,
  jointObjects: Map<string, SceneObject>,
  add: (finding: FindingDraft) => void,
): void {
  const inbound = new Map<string, RobotJoint[]>();
  for (const joint of graph.joints) {
    inbound.set(joint.childLinkId, [...(inbound.get(joint.childLinkId) ?? []), joint]);
    const entityPath = `${robotPath(graph)}/joints/${escapePath(joint.id)}`;
    if (!links.has(joint.parentLinkId) || !links.has(joint.childLinkId) || joint.parentLinkId === joint.childLinkId) {
      add({
        ruleId: 'ROB-JOINT-001',
        domain: 'robotics',
        severity: 'blocker',
        entityPath,
        message: 'Joint parent/child link relationship is invalid.',
        deterministicEvidence: {
          parentLinkId: joint.parentLinkId,
          childLinkId: joint.childLinkId,
          parentExists: links.has(joint.parentLinkId),
          childExists: links.has(joint.childLinkId),
        },
        assumptions: [],
        proposedFix: null,
      });
    }
    validateJointSemantics(joint, entityPath, add);
    const jointObject = jointObjects.get(joint.id);
    const parentObject = linkObjects.get(joint.parentLinkId);
    const childObject = linkObjects.get(joint.childLinkId);
    if (
      !jointObject || !parentObject || !childObject ||
      jointObject.parentId !== parentObject.id ||
      childObject.parentId !== jointObject.id
    ) {
      add({
        ruleId: 'ROB-JOINT-004',
        domain: 'robotics',
        severity: 'error',
        entityPath,
        message: 'Materialized Blender hierarchy does not match the joint graph.',
        deterministicEvidence: {
          jointObjectId: jointObject?.id ?? null,
          jointParentObjectId: jointObject?.parentId ?? null,
          expectedParentObjectId: parentObject?.id ?? null,
          childParentObjectId: childObject?.parentId ?? null,
        },
        assumptions: [],
        proposedFix: null,
      });
    }
  }

  for (const link of graph.links) {
    const count = inbound.get(link.id)?.length ?? 0;
    const expected = link.id === graph.rootLinkId ? 0 : 1;
    if (count !== expected) {
      add({
        ruleId: 'ROB-KINEMATIC-001',
        domain: 'robotics',
        severity: 'blocker',
        entityPath: linkPath(graph, link.id),
        message: 'Link has an invalid number of inbound joints for a single articulation tree.',
        deterministicEvidence: { inboundJointCount: count, expected },
        assumptions: [],
        proposedFix: null,
      });
    }
  }
  const reachable = new Set<string>([graph.rootLinkId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const joint of graph.joints) {
      if (reachable.has(joint.parentLinkId) && !reachable.has(joint.childLinkId)) {
        reachable.add(joint.childLinkId);
        changed = true;
      }
    }
  }
  const unreachable = graph.links.map((link) => link.id).filter((id) => !reachable.has(id));
  if (unreachable.length) {
    add({
      ruleId: 'ROB-KINEMATIC-002',
      domain: 'robotics',
      severity: 'blocker',
      entityPath: `${robotPath(graph)}/kinematic-tree`,
      message: 'Robot contains links unreachable from the articulation root.',
      deterministicEvidence: { unreachableLinkIds: unreachable.sort() },
      assumptions: [],
      proposedFix: null,
    });
  }
}

function validateJointSemantics(
  joint: RobotJoint,
  entityPath: string,
  add: (finding: FindingDraft) => void,
): void {
  const magnitude = Math.hypot(...joint.axis);
  const moving = joint.type !== 'FIXED';
  if ((moving && Math.abs(magnitude - 1) > AXIS_TOLERANCE) || (!moving && magnitude > AXIS_TOLERANCE)) {
    add({
      ruleId: 'ROB-JOINT-002',
      domain: 'robotics',
      severity: 'error',
      entityPath,
      message: 'Joint axis must be unit length for moving joints and zero for fixed joints.',
      deterministicEvidence: { jointType: joint.type, axis: joint.axis, magnitude },
      assumptions: [],
      proposedFix: null,
    });
  }
  const requiresLimits = joint.type === 'REVOLUTE' || joint.type === 'PRISMATIC';
  if (
    (requiresLimits && (!joint.limits || joint.limits.lower > joint.limits.upper)) ||
    ((joint.type === 'FIXED' || joint.type === 'CONTINUOUS') && joint.limits !== null)
  ) {
    add({
      ruleId: 'ROB-JOINT-003',
      domain: 'robotics',
      severity: 'error',
      entityPath,
      message: 'Joint limits are inconsistent with the joint type.',
      deterministicEvidence: { jointType: joint.type, limits: joint.limits },
      assumptions: [],
      proposedFix: null,
    });
  }
  if (moving && !joint.drive) {
    add({
      ruleId: 'ROB-JOINT-005',
      domain: 'robotics',
      severity: 'warning',
      entityPath,
      message: 'Moving joint has no prepared drive metadata.',
      deterministicEvidence: { jointType: joint.type, drive: null },
      assumptions: ['Passive motion may be intentional and requires human review.'],
      proposedFix: null,
    });
  }
}

function validateSensors(
  graph: RobotGraph,
  links: Map<string, RobotLink>,
  linkObjects: Map<string, SceneObject>,
  sensorObjects: Map<string, SceneObject>,
  add: (finding: FindingDraft) => void,
): void {
  for (const sensor of graph.sensors) {
    const entityPath = `${robotPath(graph)}/sensors/${escapePath(sensor.id)}`;
    const object = sensorObjects.get(sensor.id);
    const parent = linkObjects.get(sensor.parentLinkId);
    if (!links.has(sensor.parentLinkId) || !object || !parent || object.parentId !== parent.id) {
      add({
        ruleId: 'ROB-SENSOR-001',
        domain: 'sensors',
        severity: 'error',
        entityPath,
        message: 'Sensor frame is missing or parented to the wrong link.',
        deterministicEvidence: {
          parentLinkId: sensor.parentLinkId,
          parentLinkExists: links.has(sensor.parentLinkId),
          sceneSensorObjectId: object?.id ?? null,
          sceneParentObjectId: object?.parentId ?? null,
          expectedParentObjectId: parent?.id ?? null,
        },
        assumptions: [],
        proposedFix: null,
      });
    }
    if (
      (sensor.type === 'CAMERA' && sensor.fieldOfViewDegrees === null) ||
      (sensor.type !== 'CAMERA' && sensor.fieldOfViewDegrees !== null)
    ) {
      add({
        ruleId: 'ROB-SENSOR-002',
        domain: 'sensors',
        severity: 'error',
        entityPath,
        message: 'Sensor field-of-view metadata is inconsistent with the sensor type.',
        deterministicEvidence: {
          sensorType: sensor.type,
          fieldOfViewDegrees: sensor.fieldOfViewDegrees,
        },
        assumptions: [],
        proposedFix: null,
      });
    }
  }
}

function validateGroundContact(
  graph: RobotGraph,
  collisionObjects: Map<string, SceneObject>,
  add: (finding: FindingDraft) => void,
): void {
  const minimumZ = Math.min(
    ...[...collisionObjects.values()]
      .map((object) => object.worldBounds?.min[2])
      .filter((value): value is number => typeof value === 'number'),
  );
  if (!Number.isFinite(minimumZ) || Math.abs(minimumZ) > CONTACT_TOLERANCE) {
    add({
      ruleId: 'ROB-CONTACT-001',
      domain: 'physics',
      severity: 'error',
      entityPath: `${robotPath(graph)}/support-contact`,
      message: 'Robot collision representation does not contact the Z=0 support plane.',
      deterministicEvidence: {
        minimumCollisionWorldZ: Number.isFinite(minimumZ) ? minimumZ : null,
        supportPlaneZ: 0,
        tolerance: CONTACT_TOLERANCE,
      },
      assumptions: ['Z=0 is the selected project support plane.'],
      proposedFix: null,
    });
  }
}

function validateAssumptionSource(
  graph: RobotGraph,
  linkId: string,
  quantity: string,
  source: string,
  note: string,
  add: (finding: FindingDraft) => void,
): void {
  if (source === 'ASSUMED') {
    add({
      ruleId: 'ROB-ASSUMPTION-001',
      domain: 'physics',
      severity: 'info',
      entityPath: `${linkPath(graph, linkId)}/${escapePath(quantity)}`,
      message: `Physical ${quantity} is explicitly marked as an assumption.`,
      deterministicEvidence: { source, note },
      assumptions: [note],
      proposedFix: null,
    });
  } else if (source === 'UNKNOWN' && note.trim() === '') {
    add({
      ruleId: 'ROB-ASSUMPTION-002',
      domain: 'physics',
      severity: 'warning',
      entityPath: `${linkPath(graph, linkId)}/${escapePath(quantity)}`,
      message: `Unknown physical ${quantity} has no explanatory note.`,
      deterministicEvidence: { source, note },
      assumptions: [],
      proposedFix: null,
    });
  }
}

function unknownPhysicalFinding(
  ruleId: string,
  entityPath: string,
  quantity: string,
  note: string,
): FindingDraft {
  return {
    ruleId,
    domain: 'physics',
    severity: 'warning',
    entityPath: `${entityPath}/${escapePath(quantity)}`,
    message: `Physical ${quantity} is unknown; no value was fabricated.`,
    deterministicEvidence: { value: null, note },
    assumptions: note ? [note] : [],
    proposedFix: null,
  };
}

function robotPath(graph: RobotGraph): string {
  return `/robots/${escapePath(graph.robotId)}`;
}

function linkPath(graph: RobotGraph, linkId: string): string {
  return `${robotPath(graph)}/links/${escapePath(linkId)}`;
}

function escapePath(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function angleDelta(left: number, right: number): number {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function numericVectorEqual(value: unknown, expected: [number, number, number]): boolean {
  return Array.isArray(value) && value.length === 3 && value.every((entry, index) => (
    typeof entry === 'number' && Math.abs(entry - expected[index]!) <= AXIS_TOLERANCE
  ));
}
