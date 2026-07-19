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
  scale: Vector3Schema,
  dimensions: Vector3Schema,
  visible: Type.Boolean(),
  worldBounds: Type.Union([WorldBoundsSchema, Type.Null()]),
  mesh: Type.Union([MeshEvidenceSchema, Type.Null()]),
  materialNames: Type.Array(Type.String()),
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
