import { Type, type Static } from '@sinclair/typebox';

export const ProtocolVersion = 1 as const;

export const ModeSchema = Type.Union([
  Type.Literal('normal'),
  Type.Literal('plan'),
  Type.Literal('build'),
  Type.Literal('goal'),
]);
export type Mode = Static<typeof ModeSchema>;

export const RiskClassSchema = Type.Union([
  Type.Literal('read'),
  Type.Literal('safe-local'),
  Type.Literal('structural'),
  Type.Literal('creative'),
  Type.Literal('destructive'),
  Type.Literal('privileged'),
]);
export type RiskClass = Static<typeof RiskClassSchema>;

export const ActivitySchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
  phase: Type.String({ minLength: 1 }),
  kind: Type.String({ minLength: 1 }),
  summary: Type.String({ minLength: 1 }),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  createdAt: Type.String({ format: 'date-time' }),
});
export type Activity = Static<typeof ActivitySchema>;

export const Vector3Schema = Type.Tuple([Type.Number(), Type.Number(), Type.Number()]);

export const WorldBoundsSchema = Type.Object({
  min: Vector3Schema,
  max: Vector3Schema,
});
export type WorldBounds = Static<typeof WorldBoundsSchema>;

export const MeshEvidenceSchema = Type.Object({
  vertexCount: Type.Integer({ minimum: 0 }),
  edgeCount: Type.Integer({ minimum: 0 }),
  polygonCount: Type.Integer({ minimum: 0 }),
  looseVertexCount: Type.Integer({ minimum: 0 }),
  nonManifoldEdgeCount: Type.Integer({ minimum: 0 }),
  degenerateFaceCount: Type.Integer({ minimum: 0 }),
  zeroLengthEdgeCount: Type.Integer({ minimum: 0 }),
  normalIssueCount: Type.Integer({ minimum: 0 }),
});
export type MeshEvidence = Static<typeof MeshEvidenceSchema>;

export const SceneObjectSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  type: Type.String({ minLength: 1 }),
  parentId: Type.Union([Type.String(), Type.Null()]),
  location: Vector3Schema,
  rotation: Vector3Schema,
  worldLocation: Vector3Schema,
  worldRotation: Vector3Schema,
  scale: Vector3Schema,
  dimensions: Vector3Schema,
  visible: Type.Boolean(),
  worldBounds: Type.Union([WorldBoundsSchema, Type.Null()]),
  mesh: Type.Union([MeshEvidenceSchema, Type.Null()]),
  materialNames: Type.Array(Type.String()),
  metadata: Type.Record(Type.String(), Type.Unknown()),
});
export type SceneObject = Static<typeof SceneObjectSchema>;

export const SceneSnapshotSchema = Type.Object({
  protocolVersion: Type.Literal(ProtocolVersion),
  projectId: Type.String({ minLength: 1 }),
  sceneRevision: Type.Integer({ minimum: 0 }),
  sceneName: Type.String(),
  blenderFile: Type.Union([Type.String(), Type.Null()]),
  capturedAt: Type.String({ format: 'date-time' }),
  unitSystem: Type.String(),
  unitScale: Type.Number({ exclusiveMinimum: 0 }),
  lengthUnit: Type.String(),
  upAxis: Type.Literal('Z'),
  externalFiles: Type.Array(Type.Object({
    kind: Type.String({ minLength: 1 }),
    datablock: Type.String({ minLength: 1 }),
    path: Type.String(),
    exists: Type.Boolean(),
    packed: Type.Boolean(),
  })),
  objects: Type.Array(SceneObjectSchema),
});
export type SceneSnapshot = Static<typeof SceneSnapshotSchema>;

export const ValidationSeveritySchema = Type.Union([
  Type.Literal('blocker'),
  Type.Literal('error'),
  Type.Literal('warning'),
  Type.Literal('info'),
]);
export type ValidationSeverity = Static<typeof ValidationSeveritySchema>;

export const FixClassSchema = Type.Union([
  Type.Literal('SAFE_LOCAL'),
  Type.Literal('STRUCTURAL'),
  Type.Literal('CREATIVE'),
  Type.Literal('DESTRUCTIVE'),
  Type.Literal('UNKNOWN'),
]);
export type FixClass = Static<typeof FixClassSchema>;

export const FindingStatusSchema = Type.Union([
  Type.Literal('OPEN'),
  Type.Literal('FIXED'),
  Type.Literal('ACCEPTED'),
  Type.Literal('SUPPRESSED'),
]);
export type FindingStatus = Static<typeof FindingStatusSchema>;

export const ProposedFixSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
  fixClass: FixClassSchema,
  toolId: Type.String({ minLength: 1 }),
  args: Type.Record(Type.String(), Type.Unknown()),
  preconditions: Type.Object({
    sceneRevision: Type.Integer({ minimum: 0 }),
    objectId: Type.Optional(Type.String({ minLength: 1 })),
    expectedLocation: Type.Optional(Vector3Schema),
    expectedScale: Type.Optional(Vector3Schema),
  }),
  reversible: Type.Boolean(),
  approvalRequired: Type.Boolean(),
});
export type ProposedFix = Static<typeof ProposedFixSchema>;

export const ValidationFindingSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  runId: Type.String({ minLength: 1 }),
  ruleId: Type.String({ minLength: 1 }),
  domain: Type.Union([
    Type.Literal('geometry'),
    Type.Literal('topology'),
    Type.Literal('scene'),
    Type.Literal('materials'),
    Type.Literal('references'),
    Type.Literal('robotics'),
    Type.Literal('physics'),
    Type.Literal('sensors'),
  ]),
  severity: ValidationSeveritySchema,
  entityPath: Type.String({ minLength: 1 }),
  message: Type.String({ minLength: 1 }),
  deterministicEvidence: Type.Record(Type.String(), Type.Unknown()),
  assumptions: Type.Array(Type.String()),
  proposedFix: Type.Union([ProposedFixSchema, Type.Null()]),
  status: FindingStatusSchema,
  createdAt: Type.String({ format: 'date-time' }),
});
export type ValidationFinding = Static<typeof ValidationFindingSchema>;

export const ValidationRunSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
  sceneRevision: Type.Integer({ minimum: 0 }),
  startedAt: Type.String({ format: 'date-time' }),
  completedAt: Type.String({ format: 'date-time' }),
  status: Type.Literal('COMPLETED'),
  channels: Type.Array(Type.String({ minLength: 1 })),
  summary: Type.Object({
    blocker: Type.Integer({ minimum: 0 }),
    error: Type.Integer({ minimum: 0 }),
    warning: Type.Integer({ minimum: 0 }),
    info: Type.Integer({ minimum: 0 }),
  }),
  findings: Type.Array(ValidationFindingSchema),
});
export type ValidationRun = Static<typeof ValidationRunSchema>;

export interface ValidationFixRecord {
  id: string;
  projectId: string;
  sourceRunId: string;
  findingId: string;
  fixId: string;
  fixClass: FixClass;
  toolId: string;
  args: Record<string, unknown>;
  inverseToolId: string | null;
  inverseArgs: Record<string, unknown> | null;
  checkpointId: string | null;
  preRevision: number;
  postRevision: number;
  resultRunId: string;
  status: 'APPLIED' | 'UNDONE';
  createdAt: string;
  updatedAt: string;
}

export const RobotPoseSchema = Type.Object({
  position: Vector3Schema,
  rotationEuler: Vector3Schema,
});
export type RobotPose = Static<typeof RobotPoseSchema>;

export const RobotValueSourceSchema = Type.Union([
  Type.Literal('USER'),
  Type.Literal('IMPORTED'),
  Type.Literal('ASSUMED'),
  Type.Literal('UNKNOWN'),
]);

export const RobotScalarSchema = Type.Object({
  value: Type.Union([Type.Number(), Type.Null()]),
  source: RobotValueSourceSchema,
  note: Type.String(),
});

export const RobotVectorSchema = Type.Object({
  value: Type.Union([Vector3Schema, Type.Null()]),
  source: RobotValueSourceSchema,
  note: Type.String(),
});
export type RobotVector = Static<typeof RobotVectorSchema>;

export const RobotGeometrySchema = Type.Union([
  Type.Object({ primitive: Type.Literal('BOX'), size: Vector3Schema }),
  Type.Object({
    primitive: Type.Literal('CYLINDER'),
    radius: Type.Number({ exclusiveMinimum: 0 }),
    depth: Type.Number({ exclusiveMinimum: 0 }),
  }),
  Type.Object({
    primitive: Type.Literal('SPHERE'),
    radius: Type.Number({ exclusiveMinimum: 0 }),
  }),
]);
export type RobotGeometry = Static<typeof RobotGeometrySchema>;

export const RobotMaterialSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  baseColor: Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()]),
  metallic: Type.Number({ minimum: 0, maximum: 1 }),
  roughness: Type.Number({ minimum: 0, maximum: 1 }),
});
export type RobotMaterial = Static<typeof RobotMaterialSchema>;

export const RobotLinkSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  pose: RobotPoseSchema,
  visual: RobotGeometrySchema,
  collision: Type.Union([RobotGeometrySchema, Type.Null()]),
  materialId: Type.String({ minLength: 1 }),
  physicsMaterialId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  massKg: RobotScalarSchema,
  centerOfMassM: RobotVectorSchema,
  inertiaDiagonalKgM2: RobotVectorSchema,
  dynamic: Type.Boolean(),
});
export type RobotLink = Static<typeof RobotLinkSchema>;

export const RobotJointSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  type: Type.Union([
    Type.Literal('FIXED'),
    Type.Literal('REVOLUTE'),
    Type.Literal('CONTINUOUS'),
    Type.Literal('PRISMATIC'),
  ]),
  parentLinkId: Type.String({ minLength: 1 }),
  childLinkId: Type.String({ minLength: 1 }),
  origin: RobotPoseSchema,
  axis: Vector3Schema,
  limits: Type.Union([
    Type.Object({ lower: Type.Number(), upper: Type.Number(), effort: Type.Number({ exclusiveMinimum: 0 }) }),
    Type.Null(),
  ]),
  drive: Type.Union([
    Type.Object({ mode: Type.Union([Type.Literal('POSITION'), Type.Literal('VELOCITY')]), maxForce: Type.Number({ exclusiveMinimum: 0 }) }),
    Type.Null(),
  ]),
});
export type RobotJoint = Static<typeof RobotJointSchema>;

export const RobotSensorSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  type: Type.Union([Type.Literal('CAMERA'), Type.Literal('LIDAR'), Type.Literal('IMU')]),
  parentLinkId: Type.String({ minLength: 1 }),
  pose: RobotPoseSchema,
  fieldOfViewDegrees: Type.Union([Type.Number({ exclusiveMinimum: 0, maximum: 180 }), Type.Null()]),
});
export type RobotSensor = Static<typeof RobotSensorSchema>;

export const EnvironmentObjectSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  category: Type.Union([
    Type.Literal('FLOOR'),
    Type.Literal('SHELF'),
    Type.Literal('PALLET'),
    Type.Literal('CARGO'),
    Type.Literal('SAFETY'),
    Type.Literal('STRUCTURE'),
  ]),
  pose: RobotPoseSchema,
  visual: RobotGeometrySchema,
  collision: Type.Union([RobotGeometrySchema, Type.Null()]),
  materialId: Type.String({ minLength: 1 }),
  static: Type.Boolean(),
  support: Type.Union([
    Type.Literal('GROUND'),
    Type.Literal('STACKED'),
    Type.Literal('STRUCTURAL'),
  ]),
});
export type EnvironmentObject = Static<typeof EnvironmentObjectSchema>;

export const EnvironmentGraphSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  environmentId: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  units: Type.Literal('meters'),
  coordinateConvention: Type.Literal('right-handed-z-up'),
  materials: Type.Array(RobotMaterialSchema, { minItems: 1 }),
  objects: Type.Array(EnvironmentObjectSchema, { minItems: 1 }),
  assumptions: Type.Array(Type.String()),
});
export type EnvironmentGraph = Static<typeof EnvironmentGraphSchema>;

export const RobotGraphSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  robotId: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  units: Type.Literal('meters-kilograms-radians'),
  coordinateConvention: Type.Literal('right-handed-z-up-x-forward'),
  rootLinkId: Type.String({ minLength: 1 }),
  selfCollision: Type.Object({
    policy: Type.Union([
      Type.Literal('DISABLED'),
      Type.Literal('ADJACENT_EXCLUDED'),
      Type.Literal('ENABLED'),
    ]),
    note: Type.String({ minLength: 1 }),
  }),
  materials: Type.Array(RobotMaterialSchema, { minItems: 1 }),
  links: Type.Array(RobotLinkSchema, { minItems: 1 }),
  joints: Type.Array(RobotJointSchema),
  sensors: Type.Array(RobotSensorSchema),
  assumptions: Type.Array(Type.String()),
});
export type RobotGraph = Static<typeof RobotGraphSchema>;

export const ImportFormatSchema = Type.Union([
  Type.Literal('BLEND'),
  Type.Literal('USD'),
  Type.Literal('GLTF'),
  Type.Literal('FBX'),
  Type.Literal('OBJ'),
  Type.Literal('STL'),
  Type.Literal('URDF'),
  Type.Literal('MJCF'),
]);
export type ImportFormat = Static<typeof ImportFormatSchema>;

export const ImportReportSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  importId: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
  status: Type.Union([
    Type.Literal('STAGED'),
    Type.Literal('MATERIALIZED'),
    Type.Literal('MODIFIED'),
    Type.Literal('ACCEPTED'),
    Type.Literal('REJECTED'),
  ]),
  source: Type.Object({
    assetId: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    format: ImportFormatSchema,
    sourceRepository: Type.String({ minLength: 1 }),
    sourceCommit: Type.String({ minLength: 1 }),
    sourcePath: Type.String({ minLength: 1 }),
    sourceSha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    sourceBytes: Type.Integer({ minimum: 1 }),
    stagedRelativePath: Type.String({ minLength: 1 }),
    license: Type.String({ minLength: 1 }),
    attribution: Type.String({ minLength: 1 }),
  }),
  assets: Type.Array(Type.Object({
    originalReference: Type.String({ minLength: 1 }),
    stagedRelativePath: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    bytes: Type.Integer({ minimum: 1 }),
    contained: Type.Literal(true),
  })),
  conversions: Type.Array(Type.Object({
    code: Type.String({ minLength: 1 }),
    entityPath: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  })),
  losses: Type.Array(Type.Object({
    code: Type.String({ minLength: 1 }),
    severity: Type.Union([Type.Literal('warning'), Type.Literal('error')]),
    entityPath: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  })),
  assumptions: Type.Array(Type.String()),
  warnings: Type.Array(Type.String()),
  robotGraph: Type.Union([RobotGraphSchema, Type.Null()]),
  stagedObjectCount: Type.Integer({ minimum: 0 }),
  materializedSceneRevision: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  modification: Type.Union([
    Type.Object({
      kind: Type.String({ minLength: 1 }),
      summary: Type.String({ minLength: 1 }),
      sceneRevision: Type.Integer({ minimum: 0 }),
    }),
    Type.Null(),
  ]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type ImportReport = Static<typeof ImportReportSchema>;

export const NativeImportReportSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  importId: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
  status: Type.Union([
    Type.Literal('COPIED'),
    Type.Literal('STAGED'),
    Type.Literal('ACCEPTED'),
    Type.Literal('REJECTED'),
  ]),
  source: Type.Object({
    name: Type.String({ minLength: 1 }),
    format: Type.Union([
      Type.Literal('BLEND'),
      Type.Literal('USD'),
      Type.Literal('GLTF'),
      Type.Literal('FBX'),
      Type.Literal('OBJ'),
      Type.Literal('STL'),
    ]),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    bytes: Type.Integer({ minimum: 1 }),
    stagedRelativePath: Type.String({ minLength: 1 }),
    licenseNote: Type.String({ minLength: 1 }),
  }),
  collectionName: Type.String({ minLength: 1 }),
  objectCount: Type.Integer({ minimum: 0 }),
  entityIds: Type.Array(Type.String({ minLength: 1 })),
  conversions: Type.Array(Type.String()),
  warnings: Type.Array(Type.String()),
  sceneRevision: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type NativeImportReport = Static<typeof NativeImportReportSchema>;

export const ReviewManifestSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  reviewId: Type.String({ minLength: 1 }),
  robotId: Type.String({ minLength: 1 }),
  environmentId: Type.Optional(Type.String({ minLength: 1 })),
  sceneRevision: Type.Integer({ minimum: 0 }),
  label: Type.String({ minLength: 1 }),
  materialized: Type.Boolean(),
  advisoryOnly: Type.Literal(true),
  createdAt: Type.String({ format: 'date-time' }),
  images: Type.Array(Type.Object({
    view: Type.String({ minLength: 1 }),
    relativePath: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
  }), { minItems: 1 }),
});
export type ReviewManifest = Static<typeof ReviewManifestSchema>;

export const ScenePreviewManifestSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  previewId: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
  sceneRevision: Type.Integer({ minimum: 0 }),
  createdAt: Type.String({ format: 'date-time' }),
  relativePath: Type.String({ minLength: 1 }),
  sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  bytes: Type.Integer({ minimum: 1 }),
  objects: Type.Array(SceneObjectSchema),
});
export type ScenePreviewManifest = Static<typeof ScenePreviewManifestSchema>;

export const ExportKindSchema = Type.Union([Type.Literal('quick'), Type.Literal('canonical')]);
export type ExportKind = Static<typeof ExportKindSchema>;

export const ExportCheckSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal('PASS'), Type.Literal('WARN'), Type.Literal('FAIL')]),
  evidence: Type.Record(Type.String(), Type.Unknown()),
});
export type ExportCheck = Static<typeof ExportCheckSchema>;

export const ExportManifestSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  exportId: Type.String({ minLength: 1 }),
  kind: ExportKindSchema,
  appVersion: Type.String({ minLength: 1 }),
  createdAt: Type.String({ format: 'date-time' }),
  entryPoint: Type.String({ minLength: 1 }),
  project: Type.Object({ id: Type.String({ minLength: 1 }), name: Type.String({ minLength: 1 }) }),
  robotId: Type.String({ minLength: 1 }),
  environmentId: Type.Optional(Type.String({ minLength: 1 })),
  sceneRevision: Type.Integer({ minimum: 0 }),
  conventions: Type.Object({
    upAxis: Type.Literal('Z'),
    metersPerUnit: Type.Literal(1),
    robotForwardAxis: Type.Literal('X'),
  }),
  sourceValidationRunId: Type.String({ minLength: 1 }),
  validation: Type.Object({
    checks: Type.Array(ExportCheckSchema),
    summary: Type.Object({
      blocker: Type.Integer({ minimum: 0 }),
      error: Type.Integer({ minimum: 0 }),
      warning: Type.Integer({ minimum: 0 }),
      info: Type.Integer({ minimum: 0 }),
    }),
  }),
  assumptions: Type.Array(Type.String()),
  limitations: Type.Array(Type.String()),
  files: Type.Array(Type.Object({
    path: Type.String({ minLength: 1 }),
    role: Type.String({ minLength: 1 }),
    bytes: Type.Integer({ minimum: 0 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  })),
});
export type ExportManifest = Static<typeof ExportManifestSchema>;

export const ExportResultSchema = Type.Object({
  exportId: Type.String({ minLength: 1 }),
  kind: ExportKindSchema,
  destination: Type.String({ minLength: 1 }),
  sceneRevision: Type.Integer({ minimum: 0 }),
  verified: Type.Boolean(),
  checkpointId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  manifest: ExportManifestSchema,
  checks: Type.Array(ExportCheckSchema),
  machineResultsPath: Type.String({ minLength: 1 }),
  readinessReportPath: Type.String({ minLength: 1 }),
  completedAt: Type.String({ format: 'date-time' }),
});
export type ExportResult = Static<typeof ExportResultSchema>;

export const IsaacCheckSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal('PASS'), Type.Literal('WARN'), Type.Literal('FAIL')]),
  evidence: Type.Record(Type.String(), Type.Unknown()),
});
export type IsaacCheck = Static<typeof IsaacCheckSchema>;

export const IsaacEnvironmentStatusSchema = Type.Object({
  installed: Type.Boolean(),
  runtimeReady: Type.Boolean(),
  product: Type.Literal('NVIDIA Isaac Sim'),
  version: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  pythonVersion: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  pythonPath: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  compatibility: Type.Union([
    Type.Literal('SUPPORTED'),
    Type.Literal('BELOW_PUBLISHED_MINIMUM'),
    Type.Literal('UNAVAILABLE'),
  ]),
  hardware: Type.Object({
    ramGiB: Type.Number({ minimum: 0 }),
    gpuName: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    vramGiB: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    driverVersion: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  }),
  publishedMinimum: Type.Object({
    ramGiB: Type.Literal(32),
    vramGiB: Type.Literal(16),
  }),
  issues: Type.Array(Type.String()),
  checkedAt: Type.String({ format: 'date-time' }),
});
export type IsaacEnvironmentStatus = Static<typeof IsaacEnvironmentStatusSchema>;

export const IsaacExperimentSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  experimentId: Type.String({ minLength: 1 }),
  parentExperimentId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  projectId: Type.String({ minLength: 1 }),
  sourceExport: Type.Object({
    exportId: Type.String({ minLength: 1 }),
    sceneRevision: Type.Integer({ minimum: 0 }),
    packageSha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    entryPoint: Type.String({ minLength: 1 }),
  }),
  task: Type.Object({
    id: Type.Union([
      Type.Literal('static-settle-v1'),
      Type.Literal('drive-to-waypoint-v1'),
    ]),
    seed: Type.Integer(),
    steps: Type.Integer({ minimum: 60, maximum: 600 }),
    timeCodesPerSecond: Type.Literal(60),
  }),
  status: Type.Union([Type.Literal('PASSED'), Type.Literal('FAILED'), Type.Literal('ERROR')]),
  checks: Type.Array(IsaacCheckSchema),
  metrics: Type.Record(Type.String(), Type.Unknown()),
  runtime: Type.Object({
    product: Type.Literal('NVIDIA Isaac Sim'),
    version: Type.String({ minLength: 1 }),
    python: Type.String({ minLength: 1 }),
    headless: Type.Literal(true),
    compatibility: Type.Union([
      Type.Literal('SUPPORTED'),
      Type.Literal('BELOW_PUBLISHED_MINIMUM'),
    ]),
  }),
  artifacts: Type.Array(Type.Object({
    role: Type.Union([
      Type.Literal('request'),
      Type.Literal('result'),
      Type.Literal('log'),
      Type.Literal('image'),
    ]),
    relativePath: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    bytes: Type.Integer({ minimum: 0 }),
  })),
  experimentRelativePath: Type.String({ minLength: 1 }),
  startedAt: Type.String({ format: 'date-time' }),
  completedAt: Type.String({ format: 'date-time' }),
});
export type IsaacExperiment = Static<typeof IsaacExperimentSchema>;

export const BridgeHandshakeSchema = Type.Object({
  protocolVersion: Type.Literal(ProtocolVersion),
  kind: Type.Literal('handshake'),
  token: Type.String({ minLength: 43, maxLength: 128 }),
  projectId: Type.String({ minLength: 1 }),
  client: Type.Literal('simforge-blender-extension'),
});
export type BridgeHandshake = Static<typeof BridgeHandshakeSchema>;

export const BridgeRequestSchema = Type.Object({
  protocolVersion: Type.Literal(ProtocolVersion),
  kind: Type.Literal('request'),
  requestId: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
  expectedSceneRevision: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  operation: Type.String({ minLength: 1 }),
  payload: Type.Record(Type.String(), Type.Unknown()),
  deadline: Type.String({ format: 'date-time' }),
});
export type BridgeRequest = Static<typeof BridgeRequestSchema>;

export const BridgeResponseSchema = Type.Object({
  protocolVersion: Type.Literal(ProtocolVersion),
  kind: Type.Literal('response'),
  requestId: Type.String({ minLength: 1 }),
  ok: Type.Boolean(),
  preRevision: Type.Integer({ minimum: 0 }),
  postRevision: Type.Integer({ minimum: 0 }),
  changedEntityIds: Type.Array(Type.String()),
  warnings: Type.Array(Type.String()),
  result: Type.Optional(Type.Unknown()),
  error: Type.Optional(
    Type.Object({
      code: Type.String({ minLength: 1 }),
      message: Type.String({ minLength: 1 }),
    }),
  ),
});
export type BridgeResponse = Static<typeof BridgeResponseSchema>;

export const BridgeEventSchema = Type.Object({
  protocolVersion: Type.Literal(ProtocolVersion),
  kind: Type.Literal('event'),
  eventId: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
  sceneRevision: Type.Integer({ minimum: 0 }),
  eventType: Type.String({ minLength: 1 }),
  changedEntityIds: Type.Array(Type.String()),
  summary: Type.String({ minLength: 1 }),
});
export type BridgeEvent = Static<typeof BridgeEventSchema>;

export const BridgeMessageSchema = Type.Union([
  BridgeHandshakeSchema,
  BridgeRequestSchema,
  BridgeResponseSchema,
  BridgeEventSchema,
]);
export type BridgeMessage = Static<typeof BridgeMessageSchema>;

export const ProviderCapabilitySchema = Type.Union([
  Type.Boolean(),
  Type.Literal('unknown'),
]);

export const ModelDescriptorSchema = Type.Object({
  providerId: Type.String({ minLength: 1 }),
  modelId: Type.String({ minLength: 1 }),
  displayName: Type.String({ minLength: 1 }),
  capabilities: Type.Object({
    text: ProviderCapabilitySchema,
    vision: ProviderCapabilitySchema,
    tools: ProviderCapabilitySchema,
    streaming: ProviderCapabilitySchema,
    structuredOutput: ProviderCapabilitySchema,
    reasoningControls: ProviderCapabilitySchema,
  }),
  contextWindow: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  maxOutputTokens: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  probedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});
export type ModelDescriptor = Static<typeof ModelDescriptorSchema>;

export const ProviderMessagePartSchema = Type.Union([
  Type.Object({ type: Type.Literal('text'), text: Type.String() }),
  Type.Object({
    type: Type.Literal('image'),
    mediaType: Type.String(),
    data: Type.String(),
  }),
]);

export const ProviderRequestSchema = Type.Object({
  requestId: Type.String({ minLength: 1 }),
  modelId: Type.String({ minLength: 1 }),
  purpose: Type.String({ minLength: 1 }),
  messages: Type.Array(
    Type.Object({
      role: Type.Union([
        Type.Literal('system'),
        Type.Literal('user'),
        Type.Literal('assistant'),
        Type.Literal('tool'),
      ]),
      parts: Type.Array(ProviderMessagePartSchema),
    }),
  ),
  tools: Type.Array(
    Type.Object({
      name: Type.String({ minLength: 1 }),
      description: Type.String(),
      inputSchema: Type.Record(Type.String(), Type.Unknown()),
    }),
  ),
});
export type ProviderRequest = Static<typeof ProviderRequestSchema>;

export const ProviderEventSchema = Type.Union([
  Type.Object({ type: Type.Literal('text-delta'), text: Type.String() }),
  Type.Object({
    type: Type.Literal('tool-call'),
    callId: Type.String(),
    name: Type.String(),
    arguments: Type.Record(Type.String(), Type.Unknown()),
  }),
  Type.Object({
    type: Type.Literal('usage'),
    inputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    outputTokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  }),
  Type.Object({ type: Type.Literal('warning'), message: Type.String() }),
  Type.Object({ type: Type.Literal('completed') }),
]);
export type ProviderEvent = Static<typeof ProviderEventSchema>;

export interface SceneDiff {
  fromRevision: number;
  toRevision: number;
  added: SceneObject[];
  removed: SceneObject[];
  changed: Array<{ before: SceneObject; after: SceneObject }>;
}

export interface AppState {
  projectId: string;
  projectName: string;
  mode: Mode;
  bridgeConnected: boolean;
  sceneRevision: number | null;
  activeGoalJobId: string | null;
  activities: Activity[];
}
