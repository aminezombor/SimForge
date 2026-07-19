import type { AppState, Mode, ModelDescriptor, ValidationRun } from './contracts';
import type { DoctorCheck } from '../main/environment-doctor';
import type {
  CloudProviderId,
  ProviderProbeResult,
  ProviderStatus,
} from '../main/providers/provider-service';

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
  getChat(): Promise<ChatMessageView[]>;
  sendChat(message: string): Promise<ChatMessageView[]>;
  runEnvironmentDoctor(): Promise<DoctorCheck[]>;
}
