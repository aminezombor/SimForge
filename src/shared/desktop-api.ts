import type {
  AppState,
  EnvironmentGraph,
  ExportKind,
  ExportResult,
  ImportReport,
  Mode,
  ModelDescriptor,
  NativeImportReport,
  ReviewManifest,
  RobotGraph,
  RobotMaterial,
  RobotSensor,
  ScenePreviewManifest,
  ValidationRun,
} from './contracts';
import type { DoctorCheck } from '../main/environment-doctor';
import type {
  CloudProviderId,
  ProviderProbeResult,
  ProviderStatus,
} from '../main/providers/provider-service';
import type { ExportProposal } from '../main/export/export-service';
import type {
  NativeImportDecisionProposal,
  NativeImportProposal,
} from '../main/import/native-import-service';
export type { ExportProposal };
export type { NativeImportDecisionProposal, NativeImportProposal };

export interface ToolExecutionInput {
  toolId: string;
  args: Record<string, unknown>;
  planHash: string | null;
  planApproved: boolean;
  approvalId: string | null;
}

export interface ApprovalInput {
  planHash: string;
  toolId: string;
  args: Record<string, unknown>;
}

export interface GoalPlanInput {
  goal: string;
  tasks: Array<{ id: string; description: string }>;
}

export interface GoalJobView {
  jobId: string;
  planHash: string;
  status: string;
  currentTaskIndex: number;
  branchOf: string | null;
  tasks: Array<{
    taskIndex: number;
    id: string;
    description: string;
    status: string;
    attempts: number;
    error: string | null;
  }>;
}

export interface ChatMessageView {
  id: string;
  role: string;
  text: string;
  createdAt: string;
}

export interface ConversationSummaryView {
  id: string;
  title: string;
  branchOf: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentView {
  id: string;
  conversationId: string;
  name: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  relativePath: string;
  createdAt: string;
}

export interface ConversationContextView {
  estimatedTokens: number;
  contextLimit: number;
  percentUsed: number;
  compactedAt: string | null;
  summary: string | null;
}

export interface WorkspaceSettings {
  routingMode: 'automatic' | 'manual';
  activeProvider: 'local' | CloudProviderId;
  activeModel: string;
  enabledProviders: Record<CloudProviderId, boolean>;
  fallbackOrder: Array<'local' | CloudProviderId>;
  monthlyBudgetUsd: number | null;
  cloudProcessing: boolean;
  visualUploads: boolean;
  fileUploads: boolean;
  projectMemory: boolean;
  globalMemory: boolean;
  diagnosticLogging: boolean;
}

export interface MemoryView {
  id: string;
  scope: 'project' | 'global';
  title: string;
  content: string;
  source: 'user' | 'compaction';
  updatedAt: string;
}

export interface UsageSummaryView {
  inputTokens: number;
  outputTokens: number;
  knownCostUsd: number;
  unpricedRequests: number;
  requestCount: number;
}

export interface VersionView {
  id: string;
  name: string;
  checkpointId: string;
  branchOf: string | null;
  sceneRevision: number;
  createdAt: string;
}

export interface TimelineEventView {
  id: string;
  kind: 'activity' | 'checkpoint' | 'version' | 'export';
  title: string;
  detail: string;
  sceneRevision: number | null;
  actor: string;
  createdAt: string;
}

export interface ValidationFixInput {
  findingId: string;
  planHash: string | null;
  approvalId: string | null;
}

export interface CheckpointView {
  id: string;
  label: string;
  sceneRevision: number;
  createdAt: string;
  completeProjectState: boolean;
}

export interface RobotProposal {
  planHash: string;
  toolId: 'robot.materialize';
  args: { graph: RobotGraph };
  graph: RobotGraph;
  summary: string;
}

export interface WarehouseProposal {
  planHash: string;
  toolId: 'scene.materialize_assembly';
  args: { robotGraph: RobotGraph; environmentGraph: EnvironmentGraph };
  robotGraph: RobotGraph;
  environmentGraph: EnvironmentGraph;
  summary: string;
}

export interface ImportedRobotProposal {
  planHash: string;
  toolId: 'robot.materialize';
  args: { graph: RobotGraph };
  graph: RobotGraph;
  report: ImportReport;
  summary: string;
}

export interface ImportedRobotModificationProposal {
  planHash: string;
  toolId: 'robot.add_sensor';
  args: {
    robotId: string;
    sensor: RobotSensor;
    material: RobotMaterial;
    reason: string;
  };
  graph: RobotGraph;
  report: ImportReport;
  summary: string;
}

export interface SimForgeDesktopApi {
  getState(): Promise<AppState>;
  setMode(mode: Mode): Promise<AppState>;
  refreshScene(): Promise<AppState>;
  getLatestValidation(): Promise<ValidationRun | null>;
  runValidation(): Promise<ValidationRun>;
  applyValidationFix(input: ValidationFixInput): Promise<ValidationRun>;
  undoLatestValidationFix(): Promise<ValidationRun>;
  listCheckpoints(): Promise<CheckpointView[]>;
  approveCheckpointRestore(checkpointId: string, planHash: string): Promise<string>;
  restoreCheckpoint(
    checkpointId: string,
    planHash: string,
    approvalId: string,
  ): Promise<ValidationRun>;
  getPrimitiveRobotProposal(): Promise<RobotProposal>;
  buildPrimitiveRobot(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
  }>;
  getWarehouseProposal(): Promise<WarehouseProposal>;
  buildWarehouseScene(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
  }>;
  getLatestImportReport(): Promise<ImportReport | null>;
  stageBundledRobotImport(): Promise<ImportReport>;
  getImportedRobotProposal(): Promise<ImportedRobotProposal>;
  buildImportedRobot(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
    report: ImportReport;
  }>;
  getImportedRobotModificationProposal(): Promise<ImportedRobotModificationProposal>;
  modifyImportedRobot(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
    report: ImportReport;
  }>;
  listNativeImports(): Promise<NativeImportReport[]>;
  chooseNativeImport(): Promise<NativeImportProposal | null>;
  executeNativeImport(proposal: NativeImportProposal, approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
    report: NativeImportReport;
  }>;
  getNativeImportDecisionProposal(importId: string, accept: boolean): Promise<NativeImportDecisionProposal>;
  executeNativeImportDecision(proposal: NativeImportDecisionProposal, approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
    report: NativeImportReport;
  }>;
  renderPrimitiveRobotReview(label: string): Promise<ReviewManifest>;
  listReviews(): Promise<ReviewManifest[]>;
  getReviewImage(reviewId: string, view: string): Promise<string>;
  chooseExportDestination(kind: ExportKind): Promise<string | null>;
  proposeExport(kind: ExportKind, destination: string, overwrite: boolean): Promise<ExportProposal>;
  executeExport(proposal: ExportProposal, approvalId: string): Promise<ExportResult>;
  listExports(): Promise<ExportResult[]>;
  executeTool(input: ToolExecutionInput): Promise<AppState>;
  approveAction(input: ApprovalInput): Promise<string>;
  createGoal(input: GoalPlanInput): Promise<{ jobId: string; planHash: string }>;
  approveGoal(jobId: string, planHash: string): Promise<void>;
  commandGoal(
    jobId: string,
    command: 'start' | 'pause' | 'cancel' | 'retry' | 'rewind' | 'branch',
    taskIndex?: number,
  ): Promise<{ jobId: string; status: string }>;
  getGoal(jobId: string): Promise<GoalJobView>;
  runNextGoalTask(jobId: string): Promise<GoalJobView>;
  providerStatus(providerId: CloudProviderId): Promise<ProviderStatus>;
  configureProvider(providerId: CloudProviderId, credential: string): Promise<ProviderStatus>;
  removeProvider(providerId: CloudProviderId): Promise<ProviderStatus>;
  discoverProviderModels(providerId: CloudProviderId): Promise<ModelDescriptor[]>;
  probeProvider(providerId: CloudProviderId, modelId: string): Promise<ProviderProbeResult>;
  probeMockProvider(): Promise<ModelDescriptor>;
  runMockThinSlice(prompt: string): Promise<AppState>;
  listConversations(search?: string): Promise<ConversationSummaryView[]>;
  createConversation(title?: string): Promise<ConversationSummaryView>;
  renameConversation(conversationId: string, title: string): Promise<ConversationSummaryView>;
  deleteConversation(conversationId: string): Promise<ConversationSummaryView[]>;
  branchConversation(conversationId: string, throughMessageId?: string | null): Promise<ConversationSummaryView>;
  getChat(conversationId: string): Promise<ChatMessageView[]>;
  sendChat(conversationId: string, message: string, attachmentIds?: string[]): Promise<ChatMessageView[]>;
  stopChat(conversationId: string): Promise<void>;
  compactConversation(conversationId: string): Promise<ConversationContextView>;
  getConversationContext(conversationId: string): Promise<ConversationContextView>;
  chooseAttachments(conversationId: string): Promise<AttachmentView[]>;
  listAttachments(conversationId: string): Promise<AttachmentView[]>;
  getWorkspaceSettings(): Promise<WorkspaceSettings>;
  updateWorkspaceSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings>;
  listMemories(scope: 'project' | 'global'): Promise<MemoryView[]>;
  saveMemory(scope: 'project' | 'global', title: string, content: string, id?: string): Promise<MemoryView>;
  deleteMemory(scope: 'project' | 'global', id: string): Promise<MemoryView[]>;
  exportMemories(scope: 'project' | 'global'): Promise<string | null>;
  getUsageSummary(): Promise<UsageSummaryView>;
  exportProjectData(): Promise<string | null>;
  exportDiagnostics(): Promise<string | null>;
  deleteCurrentProject(confirmation: string): Promise<void>;
  generateScenePreview(): Promise<ScenePreviewManifest>;
  getScenePreviewData(previewId: string): Promise<string>;
  selectSceneObject(previewId: string, objectId: string): Promise<string>;
  openSceneInBlender(): Promise<string>;
  listVersions(): Promise<VersionView[]>;
  createVersion(name: string, checkpointId: string, branchOf?: string): Promise<VersionView>;
  getTimeline(): Promise<TimelineEventView[]>;
  runEnvironmentDoctor(): Promise<DoctorCheck[]>;
}
