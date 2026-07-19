import { describe, expect, it } from 'vitest';
import {
  warehouseEnvironmentGraph,
  warehouseMobileManipulatorGraph,
} from '../../src/main/robotics/warehouse-mobile-manipulator';
import { validateEnvironment } from '../../src/main/validation/environment-validation';
import { validateRobotics } from '../../src/main/validation/robotics-validation';
import type {
  EnvironmentGraph,
  RobotGeometry,
  RobotGraph,
  SceneObject,
  SceneSnapshot,
} from '../../src/shared/contracts';
import { EnvironmentGraphSchema, RobotGraphSchema } from '../../src/shared/contracts';
import { assertContract } from '../../src/shared/validation';

const NOW = '2026-07-19T12:00:00.000Z';

describe('MS7 warehouse assembly contracts and deterministic validation', () => {
  it('defines reusable versioned robot and environment graphs with source-tagged physics', () => {
    const robot = warehouseMobileManipulatorGraph();
    const environment = warehouseEnvironmentGraph();
    expect(() => assertContract<RobotGraph>(RobotGraphSchema, robot, 'Warehouse RobotGraph')).not.toThrow();
    expect(() => assertContract<EnvironmentGraph>(EnvironmentGraphSchema, environment, 'Warehouse EnvironmentGraph')).not.toThrow();
    expect(robot.links).toHaveLength(12);
    expect(robot.joints).toHaveLength(11);
    expect(robot.sensors.map((sensor) => sensor.type).sort()).toEqual(['CAMERA', 'IMU', 'LIDAR']);
    expect(robot.links.every((link) => (
      link.collision !== null &&
      link.massKg.source === 'ASSUMED' &&
      link.inertiaDiagonalKgM2.source === 'ASSUMED' &&
      link.centerOfMassM.source === 'ASSUMED'
    ))).toBe(true);
    expect(environment.objects).toHaveLength(15);
    expect(new Set(environment.objects.map((object) => object.category))).toEqual(new Set([
      'FLOOR', 'SHELF', 'PALLET', 'CARGO', 'SAFETY',
    ]));
    expect(environment.objects.every((object) => object.static && object.collision !== null)).toBe(true);
  });

  it('accepts the matching materialized assembly with deterministic evidence', () => {
    const robot = warehouseMobileManipulatorGraph();
    const environment = warehouseEnvironmentGraph();
    const snapshot = assemblySnapshot(robot, environment);
    const firstRobot = validateRobotics(snapshot, robot, { runId: 'robot-a', now: NOW });
    const secondRobot = validateRobotics(snapshot, robot, { runId: 'robot-b', now: NOW });
    const firstEnvironment = validateEnvironment(snapshot, environment, { runId: 'environment-a', now: NOW });
    const secondEnvironment = validateEnvironment(snapshot, environment, { runId: 'environment-b', now: NOW });
    expect(firstRobot.summary).toMatchObject({ blocker: 0, error: 0 });
    expect(firstEnvironment.summary).toMatchObject({ blocker: 0, error: 0 });
    expect(evidence(firstRobot.findings)).toEqual(evidence(secondRobot.findings));
    expect(evidence(firstEnvironment.findings)).toEqual(evidence(secondEnvironment.findings));
  });

  it('catches a visible gripper pose defect and missing environment collision by stable rule IDs', () => {
    const robot = warehouseMobileManipulatorGraph();
    const environment = warehouseEnvironmentGraph();
    const snapshot = assemblySnapshot(robot, environment);
    const finger = snapshot.objects.find((object) => object.metadata['simforge.link.id'] === 'left_finger_link')!;
    finger.worldLocation = [finger.worldLocation[0], finger.worldLocation[1] + 0.2, finger.worldLocation[2]];
    snapshot.objects = snapshot.objects.filter((object) => (
      object.metadata['simforge.environment.collision.object_id'] !== 'safety-bollard-left'
    ));
    const robotRun = validateRobotics(snapshot, robot, { runId: 'robot-defect', now: NOW });
    const environmentRun = validateEnvironment(snapshot, environment, { runId: 'environment-defect', now: NOW });
    expect(robotRun.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'ROB-LINK-POSE-001', severity: 'error' }),
    ]));
    expect(environmentRun.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'ENV-COLLISION-001', severity: 'error' }),
    ]));
  });
});

function assemblySnapshot(robot: RobotGraph, environment: EnvironmentGraph): SceneSnapshot {
  const rootId = `${robot.robotId}:root`;
  const objects: SceneObject[] = [empty(rootId, robot.name, null, {
    'simforge.robot.id': robot.robotId,
    'simforge.role': 'robot-root',
    'simforge.robot.root_link': robot.rootLinkId,
  })];
  const jointsByChild = new Map(robot.joints.map((joint) => [joint.childLinkId, joint]));
  for (const link of robot.links) {
    const joint = jointsByChild.get(link.id);
    const linkId = `${robot.robotId}:link:${link.id}`;
    objects.push(mesh(
      linkId,
      link.name,
      link.id === robot.rootLinkId ? rootId : `${robot.robotId}:joint:${joint!.id}`,
      link.pose.position,
      link.pose.rotationEuler,
      link.visual,
      [`SF ${link.materialId}`],
      {
        'simforge.robot.id': robot.robotId,
        'simforge.role': 'link',
        'simforge.link.id': link.id,
        'simforge.mass.kg': link.massKg.value,
        'simforge.inertia.diagonal_kg_m2': link.inertiaDiagonalKgM2.value,
      },
    ));
    if (link.collision) {
      objects.push(mesh(
        `${robot.robotId}:collision:${link.id}`,
        `${link.name} Collision`,
        linkId,
        link.pose.position,
        link.pose.rotationEuler,
        link.collision,
        ['Collision Guide'],
        {
          'simforge.robot.id': robot.robotId,
          'simforge.role': 'collision',
          'simforge.collision.link_id': link.id,
        },
      ));
    }
  }
  for (const joint of robot.joints) {
    objects.push(empty(
      `${robot.robotId}:joint:${joint.id}`,
      joint.name,
      `${robot.robotId}:link:${joint.parentLinkId}`,
      { 'simforge.robot.id': robot.robotId, 'simforge.role': 'joint', 'simforge.joint.id': joint.id },
    ));
  }
  for (const sensor of robot.sensors) {
    objects.push(empty(
      `${robot.robotId}:sensor:${sensor.id}`,
      sensor.name,
      `${robot.robotId}:link:${sensor.parentLinkId}`,
      { 'simforge.robot.id': robot.robotId, 'simforge.role': 'sensor', 'simforge.sensor.id': sensor.id },
    ));
  }
  const environmentRoot = `${environment.environmentId}:root`;
  objects.push(empty(environmentRoot, environment.name, null, {
    'simforge.environment.id': environment.environmentId,
    'simforge.role': 'environment-root',
  }));
  for (const entry of environment.objects) {
    const objectId = `${environment.environmentId}:object:${entry.id}`;
    objects.push(mesh(
      objectId,
      entry.name,
      environmentRoot,
      entry.pose.position,
      entry.pose.rotationEuler,
      entry.visual,
      [`SF ${entry.materialId}`],
      {
        'simforge.environment.id': environment.environmentId,
        'simforge.role': 'environment-object',
        'simforge.environment.object.id': entry.id,
        'simforge.environment.static': entry.static,
      },
    ));
    if (entry.collision) {
      objects.push(mesh(
        `${environment.environmentId}:collision:${entry.id}`,
        `${entry.name} Collision`,
        objectId,
        entry.pose.position,
        entry.pose.rotationEuler,
        entry.collision,
        ['Collision Guide'],
        {
          'simforge.environment.id': environment.environmentId,
          'simforge.role': 'environment-collision',
          'simforge.environment.collision.object_id': entry.id,
        },
      ));
    }
  }
  return {
    protocolVersion: 1,
    projectId: 'warehouse-project',
    sceneRevision: 17,
    sceneName: 'Warehouse fixture',
    blenderFile: null,
    capturedAt: NOW,
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
  geometry: RobotGeometry,
  materialNames: string[],
  metadata: Record<string, unknown>,
): SceneObject {
  const worldBounds = bounds(position, geometry);
  return {
    id,
    name,
    type: 'MESH',
    parentId,
    location: position,
    rotation,
    worldLocation: position,
    worldRotation: rotation,
    scale: [1, 1, 1],
    dimensions: worldBounds.max.map((value, index) => value - worldBounds.min[index]!) as [number, number, number],
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
    min: position.map((value, index) => value - half[index]!) as [number, number, number],
    max: position.map((value, index) => value + half[index]!) as [number, number, number],
  };
}

function evidence(findings: Array<{ ruleId: string; entityPath: string; deterministicEvidence: unknown }>) {
  return findings.map((finding) => ({
    ruleId: finding.ruleId,
    entityPath: finding.entityPath,
    evidence: finding.deterministicEvidence,
  }));
}
