import { describe, expect, it } from 'vitest';
import { primitiveWheeledRobotGraph } from '../../src/main/robotics/primitive-wheeled-robot';
import { validateRobotics } from '../../src/main/validation/robotics-validation';
import type { RobotGeometry, RobotGraph, SceneObject, SceneSnapshot } from '../../src/shared/contracts';
import { RobotGraphSchema } from '../../src/shared/contracts';
import { assertContract } from '../../src/shared/validation';

function robotSnapshot(graph: RobotGraph): SceneSnapshot {
  const rootId = `${graph.robotId}:root`;
  const objects: SceneObject[] = [empty(rootId, graph.name, null, {
    'simforge.robot.id': graph.robotId,
    'simforge.role': 'robot-root',
    'simforge.robot.root_link': graph.rootLinkId,
  })];
  const jointsByChild = new Map(graph.joints.map((joint) => [joint.childLinkId, joint]));
  for (const link of graph.links) {
    const joint = jointsByChild.get(link.id);
    const parentId = link.id === graph.rootLinkId
      ? rootId
      : `${graph.robotId}:joint:${joint!.id}`;
    objects.push(mesh(
      `${graph.robotId}:link:${link.id}`,
      link.name,
      parentId,
      link.pose.position,
      link.pose.rotationEuler,
      bounds(link.pose.position, link.visual),
      [`SF ${graph.robotId} - ${graph.materials.find((material) => material.id === link.materialId)!.name}`],
      {
        'simforge.robot.id': graph.robotId,
        'simforge.role': 'link',
        'simforge.link.id': link.id,
        'simforge.mass.kg': link.massKg.value,
        'simforge.inertia.diagonal_kg_m2': link.inertiaDiagonalKgM2.value,
      },
    ));
    if (link.collision) {
      objects.push(mesh(
        `${graph.robotId}:collision:${link.id}`,
        `${link.name} Collision`,
        `${graph.robotId}:link:${link.id}`,
        link.pose.position,
        link.pose.rotationEuler,
        bounds(link.pose.position, link.collision),
        ['Collision Guide'],
        {
          'simforge.robot.id': graph.robotId,
          'simforge.role': 'collision',
          'simforge.collision.link_id': link.id,
        },
      ));
    }
  }
  for (const joint of graph.joints) {
    objects.push(empty(
      `${graph.robotId}:joint:${joint.id}`,
      joint.name,
      `${graph.robotId}:link:${joint.parentLinkId}`,
      {
        'simforge.robot.id': graph.robotId,
        'simforge.role': 'joint',
        'simforge.joint.id': joint.id,
      },
    ));
  }
  for (const sensor of graph.sensors) {
    objects.push(empty(
      `${graph.robotId}:sensor:${sensor.id}`,
      sensor.name,
      `${graph.robotId}:link:${sensor.parentLinkId}`,
      {
        'simforge.robot.id': graph.robotId,
        'simforge.role': 'sensor',
        'simforge.sensor.id': sensor.id,
      },
    ));
  }
  return {
    protocolVersion: 1,
    projectId: 'robotics-project',
    sceneRevision: 11,
    sceneName: 'Robot fixture',
    blenderFile: null,
    capturedAt: '2026-07-19T12:00:00.000Z',
    unitSystem: 'METRIC',
    unitScale: 1,
    lengthUnit: 'METERS',
    upAxis: 'Z',
    externalFiles: [],
    objects,
  };
}

function empty(
  id: string,
  name: string,
  parentId: string | null,
  metadata: Record<string, unknown>,
): SceneObject {
  return {
    id,
    name,
    type: 'EMPTY',
    parentId,
    location: [0, 0, 0],
    rotation: [0, 0, 0],
    worldLocation: [0, 0, 0],
    worldRotation: [0, 0, 0],
    scale: [1, 1, 1],
    dimensions: [0, 0, 0],
    visible: true,
    worldBounds: null,
    mesh: null,
    materialNames: [],
    metadata,
  };
}

function mesh(
  id: string,
  name: string,
  parentId: string,
  position: [number, number, number],
  rotation: [number, number, number],
  worldBounds: NonNullable<SceneObject['worldBounds']>,
  materialNames: string[],
  metadata: Record<string, unknown>,
): SceneObject {
  return {
    id,
    name,
    type: 'MESH',
    parentId,
    location: position,
    rotation: [0, 0, 0],
    worldLocation: position,
    worldRotation: rotation,
    scale: [1, 1, 1],
    dimensions: [
      worldBounds.max[0] - worldBounds.min[0],
      worldBounds.max[1] - worldBounds.min[1],
      worldBounds.max[2] - worldBounds.min[2],
    ],
    visible: true,
    worldBounds,
    mesh: {
      vertexCount: 8,
      edgeCount: 12,
      polygonCount: 6,
      looseVertexCount: 0,
      nonManifoldEdgeCount: 0,
      degenerateFaceCount: 0,
      zeroLengthEdgeCount: 0,
      normalIssueCount: 0,
    },
    materialNames,
    metadata,
  };
}

function bounds(
  position: [number, number, number],
  geometry: RobotGeometry,
): NonNullable<SceneObject['worldBounds']> {
  const half: [number, number, number] = geometry.primitive === 'BOX'
    ? [geometry.size[0] / 2, geometry.size[1] / 2, geometry.size[2] / 2]
    : geometry.primitive === 'SPHERE'
      ? [geometry.radius, geometry.radius, geometry.radius]
      : [geometry.radius, geometry.depth / 2, geometry.radius];
  return {
    min: [position[0] - half[0], position[1] - half[1], position[2] - half[2]],
    max: [position[0] + half[0], position[1] + half[1], position[2] + half[2]],
  };
}

describe('MS4 RobotGraph and deterministic robotics validation', () => {
  it('accepts the versioned general primitive graph and emits only explicit assumption information', () => {
    const graph = primitiveWheeledRobotGraph();
    expect(() => assertContract<RobotGraph>(RobotGraphSchema, graph, 'RobotGraph')).not.toThrow();
    const run = validateRobotics(robotSnapshot(graph), graph, { runId: 'good-robot' });
    expect(run.summary.blocker).toBe(0);
    expect(run.summary.error).toBe(0);
    expect(run.findings.length).toBeGreaterThan(0);
    expect(new Set(run.findings.map((finding) => finding.ruleId))).toEqual(new Set([
      'ROB-ASSUMPTION-001',
    ]));
    expect(run.findings.every((finding) => finding.severity === 'info')).toBe(true);
  });

  it('catches joint, hierarchy, collision, mass, inertia, sensor, and contact defects deterministically', () => {
    const graph = structuredClone(primitiveWheeledRobotGraph());
    const rightJoint = graph.joints.find((joint) => joint.id === 'right_wheel_joint')!;
    rightJoint.axis = [0, 0, 0];
    rightJoint.limits = { lower: 1, upper: -1, effort: 10 };
    rightJoint.drive = null;
    const rightLink = graph.links.find((link) => link.id === 'right_wheel_link')!;
    rightLink.collision = null;
    rightLink.massKg = { value: null, source: 'UNKNOWN', note: 'Not measured.' };
    rightLink.inertiaDiagonalKgM2 = {
      value: [1, 1, 4],
      source: 'USER',
      note: 'Invalid fixture.',
    };
    graph.sensors[0]!.parentLinkId = 'missing_link';
    graph.sensors[0]!.fieldOfViewDegrees = null;
    const snapshot = robotSnapshot(graph);
    snapshot.objects = snapshot.objects.filter((object) => (
      object.metadata['simforge.collision.link_id'] !== 'right_wheel_link'
    ));
    const casterCollision = snapshot.objects.find((object) => (
      object.metadata['simforge.collision.link_id'] === 'rear_caster_link'
    ))!;
    casterCollision.worldBounds = { min: [-0.56, -0.11, 0.2], max: [-0.34, 0.11, 0.43] };
    for (const object of snapshot.objects.filter((candidate) => candidate.metadata['simforge.role'] === 'collision')) {
      if (object.worldBounds && object !== casterCollision) {
        object.worldBounds = {
          min: [object.worldBounds.min[0], object.worldBounds.min[1], object.worldBounds.min[2] + 0.2],
          max: [object.worldBounds.max[0], object.worldBounds.max[1], object.worldBounds.max[2] + 0.2],
        };
      }
    }
    const first = validateRobotics(snapshot, graph, { runId: 'bad-a', now: '2026-07-19T12:00:00.000Z' });
    const second = validateRobotics(snapshot, graph, { runId: 'bad-b', now: '2026-07-19T12:01:00.000Z' });
    const evidence = (run: typeof first) => run.findings.map((finding) => ({
      ruleId: finding.ruleId,
      entityPath: finding.entityPath,
      evidence: finding.deterministicEvidence,
    }));
    expect(evidence(first)).toEqual(evidence(second));
    expect(first.findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
      'ROB-JOINT-002',
      'ROB-JOINT-003',
      'ROB-JOINT-005',
      'ROB-COLLISION-001',
      'ROB-MASS-001',
      'ROB-INERTIA-002',
      'ROB-SENSOR-001',
      'ROB-SENSOR-002',
      'ROB-CONTACT-001',
    ]));
    expect(first.findings.find((finding) => finding.ruleId === 'ROB-MASS-001')?.deterministicEvidence)
      .toMatchObject({ value: null });
  });
});
