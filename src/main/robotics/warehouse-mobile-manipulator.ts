import type {
  EnvironmentGraph,
  EnvironmentObject,
  RobotGeometry,
  RobotGraph,
  RobotLink,
  RobotVector,
} from '../../shared/contracts';

const assumedScalar = (value: number, note: string) => ({
  value,
  source: 'ASSUMED' as const,
  note,
});

const assumedVector = (value: RobotVector['value'], note: string): RobotVector => ({
  value,
  source: 'ASSUMED',
  note,
});

function boxLink(
  id: string,
  name: string,
  position: [number, number, number],
  size: [number, number, number],
  mass: number,
  materialId: string,
  rotationEuler: [number, number, number] = [0, 0, 0],
): RobotLink {
  const [x, y, z] = size;
  const inertia: [number, number, number] = [
    mass * (y * y + z * z) / 12,
    mass * (x * x + z * z) / 12,
    mass * (x * x + y * y) / 12,
  ];
  return {
    id,
    name,
    pose: { position, rotationEuler },
    visual: { primitive: 'BOX', size },
    collision: { primitive: 'BOX', size: size.map((value) => value * 0.96) as [number, number, number] },
    materialId,
    physicsMaterialId: materialId,
    massKg: assumedScalar(mass, `Demonstration mass for ${name}; replace with measured hardware data.`),
    centerOfMassM: assumedVector([0, 0, 0], `Centered primitive approximation for ${name}.`),
    inertiaDiagonalKgM2: assumedVector(inertia, `Uniform-box inertia derived from the assumed ${mass} kg mass.`),
    dynamic: true,
  };
}

function cylinderLink(
  id: string,
  name: string,
  position: [number, number, number],
  radius: number,
  depth: number,
  mass: number,
): RobotLink {
  const radial = mass * (3 * radius * radius + depth * depth) / 12;
  const axial = mass * radius * radius / 2;
  return {
    id,
    name,
    pose: { position, rotationEuler: [Math.PI / 2, 0, 0] },
    visual: { primitive: 'CYLINDER', radius, depth },
    collision: { primitive: 'CYLINDER', radius: radius * 0.98, depth: depth * 0.96 },
    materialId: 'wheel-rubber',
    physicsMaterialId: 'wheel-rubber',
    massKg: assumedScalar(mass, `Demonstration wheel mass for ${name}.`),
    centerOfMassM: assumedVector([0, 0, 0], `Centered on the ${name} axle.`),
    inertiaDiagonalKgM2: assumedVector([radial, axial, radial], 'Uniform-cylinder inertia approximation.'),
    dynamic: true,
  };
}

export function warehouseMobileManipulatorGraph(): RobotGraph {
  const links: RobotLink[] = [
    boxLink('base_link', 'Mobile Base', [0, 0, 0.42], [1.25, 0.76, 0.28], 24, 'body-teal'),
    cylinderLink('left_wheel_link', 'Left Drive Wheel', [0, 0.44, 0.23], 0.23, 0.12, 2.4),
    cylinderLink('right_wheel_link', 'Right Drive Wheel', [0, -0.44, 0.23], 0.23, 0.12, 2.4),
    {
      ...boxLink('rear_caster_link', 'Rear Caster', [-0.48, 0, 0.11], [0.2, 0.2, 0.2], 0.9, 'wheel-rubber'),
      visual: { primitive: 'SPHERE', radius: 0.11 },
      collision: { primitive: 'SPHERE', radius: 0.105 },
      inertiaDiagonalKgM2: assumedVector([0.00436, 0.00436, 0.00436], 'Uniform-sphere inertia approximation.'),
    },
    boxLink('arm_column_link', 'Arm Pedestal', [-0.12, 0, 0.74], [0.34, 0.34, 0.46], 7.5, 'arm-graphite'),
    boxLink('upper_arm_link', 'Upper Arm', [0.03, 0, 1.18], [0.22, 0.24, 0.62], 4.2, 'arm-graphite'),
    boxLink('forearm_link', 'Forearm', [0.3, 0, 1.49], [0.58, 0.2, 0.2], 3.1, 'body-teal'),
    boxLink('wrist_link', 'Wrist', [0.62, 0, 1.49], [0.16, 0.22, 0.22], 1.2, 'sensor-amber'),
    boxLink('gripper_palm_link', 'Gripper Palm', [0.76, 0, 1.49], [0.18, 0.28, 0.16], 0.9, 'arm-graphite'),
    boxLink('left_finger_link', 'Left Gripper Finger', [0.88, 0.12, 1.49], [0.25, 0.06, 0.08], 0.25, 'sensor-amber'),
    boxLink('right_finger_link', 'Right Gripper Finger', [0.88, -0.12, 1.49], [0.25, 0.06, 0.08], 0.25, 'sensor-amber'),
    boxLink('sensor_mast_link', 'Sensor Mast', [-0.35, 0, 1.03], [0.12, 0.12, 0.78], 1.1, 'arm-graphite'),
  ];
  return {
    schemaVersion: 1,
    robotId: 'simforge-warehouse-manipulator-v1',
    name: 'SimForge Warehouse Mobile Manipulator',
    units: 'meters-kilograms-radians',
    coordinateConvention: 'right-handed-z-up-x-forward',
    rootLinkId: 'base_link',
    selfCollision: {
      policy: 'ADJACENT_EXCLUDED',
      note: 'Adjacent arm links and gripper pairs are excluded; non-adjacent pairs require simulator review.',
    },
    materials: [
      { id: 'body-teal', name: 'SimForge Teal', baseColor: [0.035, 0.48, 0.39, 1], metallic: 0.28, roughness: 0.3 },
      { id: 'arm-graphite', name: 'Arm Graphite', baseColor: [0.055, 0.075, 0.1, 1], metallic: 0.52, roughness: 0.27 },
      { id: 'wheel-rubber', name: 'Engineering Rubber', baseColor: [0.018, 0.024, 0.03, 1], metallic: 0, roughness: 0.72 },
      { id: 'sensor-amber', name: 'Sensor Amber', baseColor: [0.95, 0.34, 0.045, 1], metallic: 0.08, roughness: 0.34 },
      { id: 'collision-guide', name: 'Collision Guide', baseColor: [0.08, 0.75, 0.95, 0.18], metallic: 0, roughness: 0.55 },
    ],
    links,
    joints: [
      joint('left_wheel_joint', 'Left Wheel Joint', 'CONTINUOUS', 'base_link', 'left_wheel_link', [0, 0.44, 0.23], [0, 1, 0], null, 'VELOCITY', 90),
      joint('right_wheel_joint', 'Right Wheel Joint', 'CONTINUOUS', 'base_link', 'right_wheel_link', [0, -0.44, 0.23], [0, 1, 0], null, 'VELOCITY', 90),
      joint('rear_caster_joint', 'Rear Caster Joint', 'FIXED', 'base_link', 'rear_caster_link', [-0.48, 0, 0.11], [0, 0, 0], null, null, null),
      joint('arm_mount_joint', 'Arm Mount', 'FIXED', 'base_link', 'arm_column_link', [-0.12, 0, 0.74], [0, 0, 0], null, null, null),
      joint('shoulder_joint', 'Shoulder Joint', 'REVOLUTE', 'arm_column_link', 'upper_arm_link', [-0.12, 0, 0.97], [0, 1, 0], [-1.25, 1.25], 'POSITION', 180),
      joint('elbow_joint', 'Elbow Joint', 'REVOLUTE', 'upper_arm_link', 'forearm_link', [0.03, 0, 1.46], [0, 1, 0], [-1.5, 1.5], 'POSITION', 140),
      joint('wrist_joint', 'Wrist Joint', 'REVOLUTE', 'forearm_link', 'wrist_link', [0.58, 0, 1.49], [1, 0, 0], [-1.8, 1.8], 'POSITION', 70),
      joint('palm_joint', 'Palm Mount', 'FIXED', 'wrist_link', 'gripper_palm_link', [0.7, 0, 1.49], [0, 0, 0], null, null, null),
      joint('left_finger_joint', 'Left Finger Joint', 'PRISMATIC', 'gripper_palm_link', 'left_finger_link', [0.8, 0.12, 1.49], [0, 1, 0], [0, 0.08], 'POSITION', 35),
      joint('right_finger_joint', 'Right Finger Joint', 'PRISMATIC', 'gripper_palm_link', 'right_finger_link', [0.8, -0.12, 1.49], [0, 1, 0], [-0.08, 0], 'POSITION', 35),
      joint('sensor_mast_joint', 'Sensor Mast Mount', 'FIXED', 'base_link', 'sensor_mast_link', [-0.35, 0, 1.03], [0, 0, 0], null, null, null),
    ],
    sensors: [
      { id: 'wrist_camera_frame', name: 'Wrist Camera', type: 'CAMERA', parentLinkId: 'wrist_link', pose: { position: [0.65, 0, 1.61], rotationEuler: [0, Math.PI / 2, -Math.PI / 2] }, fieldOfViewDegrees: 72 },
      { id: 'mast_lidar_frame', name: 'Mast Lidar', type: 'LIDAR', parentLinkId: 'sensor_mast_link', pose: { position: [-0.35, 0, 1.46], rotationEuler: [0, 0, 0] }, fieldOfViewDegrees: null },
      { id: 'base_imu_frame', name: 'Base IMU', type: 'IMU', parentLinkId: 'base_link', pose: { position: [0, 0, 0.5], rotationEuler: [0, 0, 0] }, fieldOfViewDegrees: null },
    ],
    assumptions: [
      'Physical values are explicit demo assumptions, not measured hardware data.',
      'Z=0 is the warehouse support plane and X is robot-forward.',
      'Collision primitives are conservative approximations of the visual primitives.',
      'Drive forces and joint limits are prepared metadata and require downstream controller tuning.',
    ],
  };
}

function joint(
  id: string,
  name: string,
  type: 'FIXED' | 'REVOLUTE' | 'CONTINUOUS' | 'PRISMATIC',
  parentLinkId: string,
  childLinkId: string,
  position: [number, number, number],
  axis: [number, number, number],
  range: [number, number] | null,
  driveMode: 'POSITION' | 'VELOCITY' | null,
  force: number | null,
): RobotGraph['joints'][number] {
  return {
    id,
    name,
    type,
    parentLinkId,
    childLinkId,
    origin: { position, rotationEuler: [0, 0, 0] },
    axis,
    limits: range ? { lower: range[0], upper: range[1], effort: force ?? 1 } : null,
    drive: driveMode ? { mode: driveMode, maxForce: force ?? 1 } : null,
  };
}

export function warehouseEnvironmentGraph(): EnvironmentGraph {
  const objects: EnvironmentObject[] = [
    environmentObject('floor', 'Warehouse Floor', 'FLOOR', [1.5, 0, 0.03], [10, 7, 0.06], 'concrete', 'GROUND'),
    environmentObject('left-pallet', 'Inbound Pallet', 'PALLET', [1.9, 1.9, 0.09], [1.1, 0.9, 0.18], 'pallet-wood', 'GROUND'),
    environmentObject('left-cargo', 'Inbound Cargo', 'CARGO', [1.9, 1.9, 0.52], [0.75, 0.62, 0.68], 'cargo-kraft', 'STACKED'),
    environmentObject('right-pallet', 'Outbound Pallet', 'PALLET', [2.4, -1.9, 0.09], [1.1, 0.9, 0.18], 'pallet-wood', 'GROUND'),
    environmentObject('right-cargo', 'Outbound Cargo', 'CARGO', [2.4, -1.9, 0.42], [0.7, 0.58, 0.48], 'cargo-teal', 'STACKED'),
    environmentObject('shelf-left-upright-a', 'Left Shelf Upright A', 'SHELF', [3.8, 2.45, 1.25], [0.12, 0.12, 2.5], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('shelf-left-upright-b', 'Left Shelf Upright B', 'SHELF', [3.8, 0.95, 1.25], [0.12, 0.12, 2.5], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('shelf-left-deck-low', 'Left Shelf Lower Deck', 'SHELF', [3.8, 1.7, 0.38], [0.9, 1.65, 0.12], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('shelf-left-deck-high', 'Left Shelf Upper Deck', 'SHELF', [3.8, 1.7, 1.62], [0.9, 1.65, 0.12], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('shelf-right-upright-a', 'Right Shelf Upright A', 'SHELF', [3.8, -0.95, 1.25], [0.12, 0.12, 2.5], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('shelf-right-upright-b', 'Right Shelf Upright B', 'SHELF', [3.8, -2.45, 1.25], [0.12, 0.12, 2.5], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('shelf-right-deck-low', 'Right Shelf Lower Deck', 'SHELF', [3.8, -1.7, 0.38], [0.9, 1.65, 0.12], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('shelf-right-deck-high', 'Right Shelf Upper Deck', 'SHELF', [3.8, -1.7, 1.62], [0.9, 1.65, 0.12], 'shelf-steel', 'STRUCTURAL'),
    environmentObject('safety-bollard-left', 'Safety Bollard Left', 'SAFETY', [0.9, 2.75, 0.49], [0.18, 0.18, 1], 'safety-yellow', 'GROUND'),
    environmentObject('safety-bollard-right', 'Safety Bollard Right', 'SAFETY', [0.9, -2.75, 0.49], [0.18, 0.18, 1], 'safety-yellow', 'GROUND'),
  ];
  return {
    schemaVersion: 1,
    environmentId: 'simforge-warehouse-demo-v1',
    name: 'SimForge Warehouse Workcell',
    units: 'meters',
    coordinateConvention: 'right-handed-z-up',
    materials: [
      { id: 'concrete', name: 'Sealed Concrete', baseColor: [0.18, 0.22, 0.25, 1], metallic: 0, roughness: 0.82 },
      { id: 'shelf-steel', name: 'Warehouse Steel', baseColor: [0.16, 0.24, 0.31, 1], metallic: 0.64, roughness: 0.32 },
      { id: 'pallet-wood', name: 'Pallet Wood', baseColor: [0.42, 0.22, 0.08, 1], metallic: 0, roughness: 0.74 },
      { id: 'cargo-kraft', name: 'Cargo Kraft', baseColor: [0.58, 0.34, 0.15, 1], metallic: 0, roughness: 0.66 },
      { id: 'cargo-teal', name: 'Cargo Teal', baseColor: [0.04, 0.42, 0.36, 1], metallic: 0.08, roughness: 0.4 },
      { id: 'safety-yellow', name: 'Safety Yellow', baseColor: [0.95, 0.58, 0.03, 1], metallic: 0.05, roughness: 0.38 },
      { id: 'collision-guide', name: 'Environment Collision Guide', baseColor: [0.08, 0.75, 0.95, 0.12], metallic: 0, roughness: 0.55 },
    ],
    objects,
    assumptions: [
      'The warehouse is a generated demonstration workcell using primitive geometry.',
      'Z=0 is the support plane; stacked cargo support is visually and deterministically reviewed.',
      'Static collision geometry approximates shelving, pallets, cargo, floor, and safety structures.',
    ],
  };
}

function environmentObject(
  id: string,
  name: string,
  category: EnvironmentObject['category'],
  position: [number, number, number],
  size: [number, number, number],
  materialId: string,
  support: EnvironmentObject['support'],
): EnvironmentObject {
  const geometry: RobotGeometry = { primitive: 'BOX', size };
  return {
    id,
    name,
    category,
    pose: { position, rotationEuler: [0, 0, 0] },
    visual: geometry,
    collision: { primitive: 'BOX', size: size.map((value) => value * 0.98) as [number, number, number] },
    materialId,
    static: true,
    support,
  };
}
