import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type {
  AppState,
  BridgeEvent,
  ExportKind,
  ExportResult,
  Mode,
  ModelDescriptor,
  ReviewManifest,
  RobotGraph,
  ValidationRun,
} from '../shared/contracts';
import { sha256 } from '../shared/hash';
import type {
  ApprovalInput as DesktopApprovalInput,
  ChatMessageView,
  GoalJobView,
  GoalPlanInput,
  ToolExecutionInput,
} from '../shared/desktop-api';
import { BlenderBridgeServer } from './bridge/blender-bridge';
import { SceneStateService } from './bridge/scene-state';
import { ActivityService } from './domain/activity-service';
import { AiToolCoordinator } from './domain/ai-tool-coordinator';
import { ApprovedScriptArchive } from './domain/approved-script-archive';
import { ApprovalService } from './domain/approval-service';
import { CheckpointService } from './domain/checkpoint-service';
import { JobOrchestrator } from './domain/job-orchestrator';
import { ToolExecutor } from './domain/tool-executor';
import { runEnvironmentDoctor, type DoctorCheck } from './environment-doctor';
import { ExportService, type ExportProposal } from './export/export-service';
import { MockProviderAdapter } from './providers/mock-provider';
import {
  ProviderService,
  type CloudProviderId,
  type ProviderProbeResult,
  type ProviderStatus,
} from './providers/provider-service';
import { ElectronCredentialStore } from './security/credential-store';
import { containsLikelySecret } from './security/secret-redaction';
import { GlobalRepository } from './storage/global-repository';
import { ProjectManager, type ProjectHandle } from './storage/project-repository';
import { ValidationService, type CheckpointView } from './validation/validation-service';
import { primitiveWheeledRobotGraph } from './robotics/primitive-wheeled-robot';
import { ReviewService } from './robotics/review-service';

export class AppRuntime {
  private project: ProjectHandle | null = null;
  private globalRepository: GlobalRepository | null = null;
  private bridge: BlenderBridgeServer | null = null;
  private sceneState: SceneStateService | null = null;
  private activities: ActivityService | null = null;
  private approvals: ApprovalService | null = null;
  private executor: ToolExecutor | null = null;
  private jobs: JobOrchestrator | null = null;
  private checkpoints: CheckpointService | null = null;
  private validation: ValidationService | null = null;
  private reviews: ReviewService | null = null;
  private exports: ExportService | null = null;
  private providers: ProviderService | null = null;
  private closed = false;
  private readonly mockProvider = new MockProviderAdapter();
  private readonly aiTools = new AiToolCoordinator();

  constructor(
    private readonly userDataDirectory: string,
    private readonly applicationRoot: string = process.cwd(),
  ) {}

  async initialize(): Promise<void> {
    const projectRoot = path.join(this.userDataDirectory, 'projects', 'default');
    const manager = new ProjectManager();
    try {
      await access(path.join(projectRoot, 'simforge.project.json'));
      this.project = await manager.open(projectRoot);
    } catch {
      this.project = await manager.create(projectRoot, 'SimForge Foundation Project');
    }
    const project = this.requireProject();
    this.globalRepository = new GlobalRepository(this.userDataDirectory);
    this.globalRepository.registerProject({
      projectId: project.manifest.projectId,
      name: project.manifest.name,
      root: project.root,
      lastOpenedAt: new Date().toISOString(),
    });
    this.activities = new ActivityService(project.manifest.projectId, project.repository);
    this.providers = new ProviderService(
      new ElectronCredentialStore(this.userDataDirectory),
      this.globalRepository,
      this.activities,
    );
    this.approvals = new ApprovalService(project.repository);
    this.jobs = new JobOrchestrator(project.manifest.projectId, project.repository);
    this.bridge = new BlenderBridgeServer();
    this.sceneState = new SceneStateService(
      project.manifest.projectId,
      this.bridge,
      project.repository,
    );
    const checkpoints = new CheckpointService(project, this.bridge);
    this.checkpoints = checkpoints;
    this.executor = new ToolExecutor(
      this.bridge,
      this.approvals,
      checkpoints,
      this.activities,
      new ApprovedScriptArchive(project),
    );
    this.validation = new ValidationService(
      project,
      this.sceneState,
      this.executor,
      this.approvals,
      checkpoints,
      this.activities,
    );
    this.reviews = new ReviewService(project, this.sceneState, this.executor, this.activities);
    this.exports = new ExportService(
      project,
      this.sceneState,
      this.executor,
      this.activities,
      this.applicationRoot,
    );
    this.bridge.on('connected', () => {
      this.requireActivities().record('bridge', 'connected', 'Blender connected');
    });
    this.bridge.on('disconnected', () => {
      this.requireActivities().record('bridge', 'disconnected', 'Blender disconnected');
    });
    this.bridge.on('scene-event', (event: BridgeEvent) => {
      void this.handleSceneEvent(event);
    });
    await this.bridge.start(
      path.join(this.userDataDirectory, 'runtime'),
      project.manifest.projectId,
      project.root,
      project.repository.latestSceneSnapshot(project.manifest.projectId)?.sceneRevision ?? 0,
    );
    this.activities.record('foundation', 'app-ready', 'SimForge foundation services are ready');
  }

  async shutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.bridge?.stop();
    this.project?.repository.close();
    this.globalRepository?.close();
  }

  getState(): AppState {
    const project = this.requireProject();
    const snapshot = this.requireSceneState().current;
    return {
      projectId: project.manifest.projectId,
      projectName: project.manifest.name,
      mode: project.repository.getMode(),
      bridgeConnected: this.requireBridge().connected,
      sceneRevision: snapshot?.sceneRevision ?? null,
      activeGoalJobId: project.repository.getState<string>('activeGoalJobId'),
      activities: this.requireActivities().list(50),
    };
  }

  setMode(mode: Mode): AppState {
    const project = this.requireProject();
    project.repository.setMode(mode);
    this.requireActivities().record('mode', 'mode-changed', `Mode changed to ${mode}`);
    return this.getState();
  }

  async refreshScene(): Promise<AppState> {
    const { diff } = await this.requireSceneState().refresh();
    this.requireActivities().record('scene', 'scene-refreshed', 'Fresh Blender scene captured', {
      added: diff?.added.length ?? 0,
      removed: diff?.removed.length ?? 0,
      changed: diff?.changed.length ?? 0,
    });
    return this.getState();
  }

  getLatestValidation(): ValidationRun | null {
    return this.requireValidation().latest();
  }

  runValidation(): Promise<ValidationRun> {
    return this.requireValidation().run();
  }

  applyValidationFix(
    findingId: string,
    planHash: string | null,
    approvalId: string | null,
  ): Promise<ValidationRun> {
    return this.requireValidation().applyFix(findingId, planHash, approvalId);
  }

  undoLatestValidationFix(): Promise<ValidationRun> {
    return this.requireValidation().undoLatestSafeFix();
  }

  listCheckpoints(): CheckpointView[] {
    return this.requireValidation().listCheckpoints();
  }

  async approveCheckpointRestore(checkpointId: string, planHash: string): Promise<string> {
    await this.requireSceneState().refresh();
    return this.requireValidation().approveCheckpointRestore(checkpointId, planHash);
  }

  restoreCheckpoint(
    checkpointId: string,
    planHash: string,
    approvalId: string,
  ): Promise<ValidationRun> {
    return this.requireValidation().restoreCheckpoint(checkpointId, planHash, approvalId);
  }

  primitiveRobotProposal(): {
    planHash: string;
    toolId: 'robot.materialize';
    args: { graph: RobotGraph };
    graph: RobotGraph;
    summary: string;
  } {
    const graph = primitiveWheeledRobotGraph();
    const args = { graph };
    return {
      planHash: sha256({ toolId: 'robot.materialize', args }),
      toolId: 'robot.materialize',
      args,
      graph,
      summary: `${graph.links.length} links / ${graph.joints.length} joints / ${graph.sensors.length} sensor frames`,
    };
  }

  async buildPrimitiveRobot(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
  }> {
    const { snapshot } = await this.requireSceneState().refresh();
    const proposal = this.primitiveRobotProposal();
    const project = this.requireProject();
    const execution = await this.requireExecutor().execute(proposal.toolId, proposal.args, {
      projectId: project.manifest.projectId,
      mode: project.repository.getMode(),
      planHash: proposal.planHash,
      planApproved: true,
      sceneRevision: snapshot.sceneRevision,
      approvalId,
      origin: 'general',
    });
    const now = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `robot-graph:${proposal.graph.robotId}:${execution.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: {
        type: 'robot-graph',
        graph: proposal.graph,
        materialization: {
          preRevision: execution.preRevision,
          postRevision: execution.postRevision,
          checkpointId: execution.checkpointId,
          result: execution.result,
        },
      },
      createdAt: now,
      updatedAt: now,
    });
    await this.requireSceneState().refresh();
    const validation = await this.requireValidation().run();
    this.requireActivities().record('robotics', 'primitive-robot-materialized', 'Primitive wheeled robot materialized and validated', {
      robotId: proposal.graph.robotId,
      sceneRevision: validation.sceneRevision,
      checkpointId: execution.checkpointId,
      blocker: validation.summary.blocker,
      error: validation.summary.error,
    });
    return { state: this.getState(), validation };
  }

  renderPrimitiveRobotReview(label: string): Promise<ReviewManifest> {
    const graph = this.requireValidation().latestRobotGraph();
    if (!graph) throw new Error('Build a RobotGraph before rendering a materialized review');
    return this.requireReviews().render(graph.robotId, label);
  }

  getReviewImage(reviewId: string, view: string): Promise<string> {
    return this.requireReviews().imageData(reviewId, view);
  }

  proposeExport(kind: ExportKind, destination: string, overwrite: boolean): Promise<ExportProposal> {
    return this.requireExports().propose(kind, destination, overwrite);
  }

  executeExport(proposal: ExportProposal, approvalId: string): Promise<ExportResult> {
    return this.requireExports().execute(proposal, approvalId);
  }

  listExports(): ExportResult[] {
    return this.requireExports().list();
  }

  async executeTool(input: ToolExecutionInput): Promise<AppState> {
    const state = this.getState();
    if (state.sceneRevision === null) {
      throw new Error('Refresh the Blender scene before executing a scene mutation');
    }
    await this.requireExecutor().execute(input.toolId, input.args, {
      projectId: state.projectId,
      mode: state.mode,
      planHash: input.planHash,
      planApproved: input.planApproved,
      sceneRevision: state.sceneRevision,
      approvalId: input.approvalId,
    });
    await this.requireSceneState().refresh();
    return this.getState();
  }

  approveAction(input: DesktopApprovalInput): string {
    const state = this.getState();
    if (state.sceneRevision === null) throw new Error('Scene revision is required for approval');
    const tool = this.requireExecutor().availableTools(state.mode).find((entry) => entry.id === input.toolId);
    if (!tool) throw new Error('Tool is unavailable in the current mode');
    const approvalId = this.requireApprovals().approve({
      projectId: state.projectId,
      planHash: input.planHash,
      toolId: input.toolId,
      args: input.args,
      sceneRevision: state.sceneRevision,
      risk: tool.risk,
    });
    this.requireActivities().record('approval', 'action-approved', `Approved ${input.toolId}`, {
      approvalId,
      planHash: input.planHash,
      sceneRevision: state.sceneRevision,
    });
    return approvalId;
  }

  createGoal(input: GoalPlanInput): { jobId: string; planHash: string } {
    const created = this.requireJobs().create(input.goal, input.tasks);
    this.requireProject().repository.setState('activeGoalJobId', created.job.id);
    this.requireActivities().record('goal', 'plan-created', 'Goal plan is awaiting approval', {
      jobId: created.job.id,
      taskCount: created.tasks.length,
    });
    return { jobId: created.job.id, planHash: created.job.planHash };
  }

  approveGoal(jobId: string, planHash: string): void {
    this.requireJobs().approvePlan(jobId, planHash);
    this.requireActivities().record('goal', 'plan-approved', 'Goal plan approved', { jobId });
  }

  commandGoal(
    jobId: string,
    command: 'start' | 'pause' | 'cancel' | 'retry' | 'rewind' | 'branch',
    taskIndex?: number,
  ): { jobId: string; status: string } {
    const jobs = this.requireJobs();
    const state = (() => {
      switch (command) {
        case 'start':
          return jobs.start(jobId);
        case 'pause':
          return jobs.pause(jobId);
        case 'cancel':
          return jobs.cancel(jobId);
        case 'retry':
          return jobs.retry(jobId);
        case 'rewind':
          return jobs.rewind(jobId, taskIndex ?? 0);
        case 'branch':
          return jobs.branch(jobId);
      }
    })();
    this.requireActivities().record('goal', `job-${command}`, `Goal job ${command}`, {
      jobId: state.job.id,
      status: state.job.status,
    });
    if (command === 'branch') this.requireProject().repository.setState('activeGoalJobId', state.job.id);
    return { jobId: state.job.id, status: state.job.status };
  }

  getGoal(jobId: string): GoalJobView {
    return this.goalView(this.requireJobs().get(jobId));
  }

  async runNextGoalTask(jobId: string): Promise<GoalJobView> {
    const jobs = this.requireJobs();
    const state = await jobs.runNext(jobId, async (task) => {
      const sceneState = this.requireSceneState();
      if (task.id === 'inspect' || task.id === 'verify') {
        await sceneState.refresh();
        return;
      }
      const snapshot = sceneState.current;
      if (!snapshot) throw new Error('A fresh Blender snapshot is required before goal execution');
      if (task.id === 'checkpoint') {
        await this.requireCheckpoints().create('Goal plan checkpoint', snapshot.sceneRevision);
        return;
      }
      if (task.id === 'create') {
        const job = jobs.get(jobId).job;
        await this.requireExecutor().execute(
          'object.create_primitive',
          { primitive: 'CUBE', name: 'SimForge Goal Cube', location: [0, 0, 1] },
          {
            projectId: job.projectId,
            mode: 'goal',
            planHash: job.planHash,
            planApproved: true,
            sceneRevision: snapshot.sceneRevision,
            approvalId: null,
          },
        );
        await sceneState.refresh();
        return;
      }
      throw new Error(`Goal task ${task.id} has no approved deterministic runner`);
    });
    this.requireActivities().record('goal', 'task-transition', 'Goal task state changed', {
      jobId,
      status: state.job.status,
      currentTaskIndex: state.job.currentTaskIndex,
    });
    return this.goalView(state);
  }

  async probeMockProvider(): Promise<ModelDescriptor> {
    const descriptor = await this.mockProvider.probeCapabilities(null, 'mock-planner');
    this.requireActivities().record('provider', 'capability-probed', 'Mock provider capability probe passed', {
      providerId: descriptor.providerId,
      modelId: descriptor.modelId,
    });
    return descriptor;
  }

  async runMockThinSlice(prompt: string): Promise<AppState> {
    if (!prompt.trim() || prompt.length > 4_000) throw new Error('Thin-slice prompt is invalid');
    let state = this.getState();
    if (state.mode === 'plan' || state.mode === 'goal') {
      throw new Error('The local AI thin slice is available in Chat or Build mode');
    }
    if (state.sceneRevision === null) {
      await this.refreshScene();
      state = this.getState();
    }
    if (state.sceneRevision === null) throw new Error('Fresh Blender scene state is unavailable');
    const project = this.requireProject();
    const conversationId = 'ms1-local-thin-slice';
    const now = new Date().toISOString();
    project.repository.saveConversation({
      id: conversationId,
      projectId: project.manifest.projectId,
      title: 'MS1 local provider thin slice',
      createdAt: now,
      updatedAt: now,
    });
    project.repository.addMessage({
      id: randomUUID(),
      conversationId,
      role: 'user',
      parts: [{ type: 'text', text: prompt }],
      createdAt: now,
    });
    const result = await this.aiTools.run(
      this.mockProvider,
      null,
      {
        requestId: randomUUID(),
        modelId: 'mock-planner',
        purpose: 'Local deterministic AI-to-Blender acceptance slice',
        messages: [{ role: 'user', parts: [{ type: 'text', text: prompt }] }],
        tools: [{
          name: 'object.create_primitive',
          description: 'Create a checkpointed Blender cube',
          inputSchema: { type: 'object', additionalProperties: false },
        }],
      },
      new Set(['object.create_primitive']),
      (toolId, args) => this.requireExecutor().execute(toolId, args, {
        projectId: state.projectId,
        mode: state.mode,
        planHash: null,
        planApproved: false,
        sceneRevision: state.sceneRevision!,
        approvalId: null,
      }),
    );
    project.repository.addMessage({
      id: randomUUID(),
      conversationId,
      role: 'assistant',
      parts: result.events.map((event) => ({ type: 'provider-event', event })),
      createdAt: new Date().toISOString(),
    });
    this.requireActivities().record('provider', 'ai-tool-slice-completed', 'Local provider completed a structured Blender tool call', {
      providerId: this.mockProvider.id,
      toolCalls: result.toolResults.length,
    });
    await this.refreshScene();
    return this.getState();
  }

  getChat(): ChatMessageView[] {
    return this.requireProject().repository.listMessages('main-chat').map((message) => ({
      id: message.id,
      role: message.role,
      text: message.parts
        .filter((part): part is { type: 'text'; text: string } => (
          Boolean(part) && typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        ))
        .map((part) => part.text)
        .join('\n'),
      createdAt: message.createdAt,
    }));
  }

  async sendChat(message: string): Promise<ChatMessageView[]> {
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 8_000) throw new Error('Chat message is invalid');
    if (containsLikelySecret(trimmed)) {
      throw new Error('Possible API key or private key detected. Configure credentials in Provider Settings.');
    }
    const project = this.requireProject();
    const now = new Date().toISOString();
    project.repository.saveConversation({
      id: 'main-chat',
      projectId: project.manifest.projectId,
      title: 'SimForge conversation',
      createdAt: now,
      updatedAt: now,
    });
    project.repository.addMessage({
      id: randomUUID(),
      conversationId: 'main-chat',
      role: 'user',
      parts: [{ type: 'text', text: trimmed }],
      createdAt: now,
    });
    let responseText = '';
    for await (const event of this.mockProvider.stream(null, {
      requestId: randomUUID(),
      modelId: 'mock-planner',
      purpose: 'Local non-mutating conversation fixture',
      messages: [{ role: 'user', parts: [{ type: 'text', text: trimmed }] }],
      tools: [],
    })) {
      if (event.type === 'text-delta') responseText += event.text;
    }
    project.repository.addMessage({
      id: randomUUID(),
      conversationId: 'main-chat',
      role: 'assistant',
      parts: [{ type: 'text', text: responseText }],
      createdAt: new Date().toISOString(),
    });
    this.requireActivities().record('conversation', 'message-completed', 'Local conversation response stored', {
      providerId: this.mockProvider.id,
      mutatingToolsAvailable: false,
    });
    return this.getChat();
  }

  providerStatus(providerId: CloudProviderId): Promise<ProviderStatus> {
    return this.requireProviders().status(providerId);
  }

  configureProvider(providerId: CloudProviderId, credential: string): Promise<ProviderStatus> {
    return this.requireProviders().configure(providerId, credential);
  }

  removeProvider(providerId: CloudProviderId): Promise<ProviderStatus> {
    return this.requireProviders().remove(providerId);
  }

  discoverProviderModels(providerId: CloudProviderId): Promise<ModelDescriptor[]> {
    return this.requireProviders().discover(providerId);
  }

  probeProvider(providerId: CloudProviderId, modelId: string): Promise<ProviderProbeResult> {
    return this.requireProviders().probe(providerId, modelId);
  }

  runEnvironmentDoctor(): Promise<DoctorCheck[]> {
    return runEnvironmentDoctor(this.applicationRoot);
  }

  private async handleSceneEvent(event: BridgeEvent): Promise<void> {
    try {
      const diff = await this.requireSceneState().handleSceneEvent(event);
      this.requireActivities().record('scene', 'manual-edit-detected', event.summary, {
        sceneRevision: event.sceneRevision,
        added: diff?.added.length ?? 0,
        removed: diff?.removed.length ?? 0,
        changed: diff?.changed.length ?? 0,
      });
    } catch (error) {
      this.requireActivities().record('scene', 'refresh-failed', 'Scene refresh after event failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private requireProject(): ProjectHandle {
    if (!this.project) throw new Error('Project runtime is not initialized');
    return this.project;
  }

  private requireBridge(): BlenderBridgeServer {
    if (!this.bridge) throw new Error('Bridge runtime is not initialized');
    return this.bridge;
  }

  private requireSceneState(): SceneStateService {
    if (!this.sceneState) throw new Error('Scene state is not initialized');
    return this.sceneState;
  }

  private requireActivities(): ActivityService {
    if (!this.activities) throw new Error('Activity service is not initialized');
    return this.activities;
  }

  private requireApprovals(): ApprovalService {
    if (!this.approvals) throw new Error('Approval service is not initialized');
    return this.approvals;
  }

  private requireExecutor(): ToolExecutor {
    if (!this.executor) throw new Error('Tool executor is not initialized');
    return this.executor;
  }

  private requireJobs(): JobOrchestrator {
    if (!this.jobs) throw new Error('Job orchestrator is not initialized');
    return this.jobs;
  }

  private requireCheckpoints(): CheckpointService {
    if (!this.checkpoints) throw new Error('Checkpoint service is not initialized');
    return this.checkpoints;
  }

  private requireProviders(): ProviderService {
    if (!this.providers) throw new Error('Provider service is not initialized');
    return this.providers;
  }

  private requireValidation(): ValidationService {
    if (!this.validation) throw new Error('Validation service is not initialized');
    return this.validation;
  }

  private requireReviews(): ReviewService {
    if (!this.reviews) throw new Error('Review service is not initialized');
    return this.reviews;
  }

  private requireExports(): ExportService {
    if (!this.exports) throw new Error('Export service is not initialized');
    return this.exports;
  }

  private goalView(state: ReturnType<JobOrchestrator['get']>): GoalJobView {
    return {
      jobId: state.job.id,
      planHash: state.job.planHash,
      status: state.job.status,
      currentTaskIndex: state.job.currentTaskIndex,
      branchOf: state.job.branchOf,
      tasks: state.tasks.map((task) => ({
        taskIndex: task.taskIndex,
        id: task.taskId,
        description: task.description,
        status: task.status,
        attempts: task.attempts,
        error: task.error,
      })),
    };
  }
}
