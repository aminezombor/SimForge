import { randomUUID } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
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
  AttachmentView,
  ApprovalInput as DesktopApprovalInput,
  ChatMessageView,
  ConversationContextView,
  ConversationSummaryView,
  GoalJobView,
  GoalPlanInput,
  MemoryView,
  TimelineEventView,
  ToolExecutionInput,
  UsageSummaryView,
  VersionView,
  WorkspaceSettings,
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
import { ModelRouter } from './providers/model-router';
import {
  ProviderService,
  type CloudProviderId,
  type ProviderProbeResult,
  type ProviderStatus,
} from './providers/provider-service';
import { ElectronCredentialStore } from './security/credential-store';
import { containsLikelySecret, redactLikelySecrets } from './security/secret-redaction';
import { GlobalRepository } from './storage/global-repository';
import { ProjectManager, type ProjectHandle } from './storage/project-repository';
import { ValidationService, type CheckpointView } from './validation/validation-service';
import { primitiveWheeledRobotGraph } from './robotics/primitive-wheeled-robot';
import { ReviewService } from './robotics/review-service';
import { PreviewService } from './preview/preview-service';
import { WorkspaceService } from './workspace/workspace-service';

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
  private previews: PreviewService | null = null;
  private workspace: WorkspaceService | null = null;
  private providers: ProviderService | null = null;
  private modelRouter: ModelRouter | null = null;
  private closed = false;
  private readonly mockProvider = new MockProviderAdapter();
  private readonly aiTools = new AiToolCoordinator();
  private readonly activeChats = new Map<string, { requestId: string; cancel: () => void }>();

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
    this.modelRouter = new ModelRouter(this.providers);
    this.workspace = new WorkspaceService(project, this.globalRepository, this.activities);
    this.workspace.ensureInitialConversation();
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
    this.previews = new PreviewService(project, this.bridge, this.sceneState, this.activities);
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

  listReviews(): ReviewManifest[] {
    return this.requireReviews().list();
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

  listConversations(search = ''): ConversationSummaryView[] {
    return this.requireWorkspace().listConversations(search);
  }

  createConversation(title?: string): ConversationSummaryView {
    return this.requireWorkspace().createConversation(title);
  }

  renameConversation(conversationId: string, title: string): ConversationSummaryView {
    return this.requireWorkspace().renameConversation(conversationId, title);
  }

  deleteConversation(conversationId: string): ConversationSummaryView[] {
    return this.requireWorkspace().deleteConversation(conversationId);
  }

  branchConversation(conversationId: string, throughMessageId?: string | null): ConversationSummaryView {
    return this.requireWorkspace().branchConversation(conversationId, throughMessageId);
  }

  getChat(conversationId: string): ChatMessageView[] {
    this.requireWorkspace().context(conversationId);
    return this.requireProject().repository.listMessages(conversationId).map((message) => ({
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

  async sendChat(conversationId: string, message: string, attachmentIds: string[] = []): Promise<ChatMessageView[]> {
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 8_000) throw new Error('Chat message is invalid');
    if (containsLikelySecret(trimmed)) {
      throw new Error('Possible API key or private key detected. Configure credentials in Provider Settings.');
    }
    const project = this.requireProject();
    const workspace = this.requireWorkspace();
    workspace.context(conversationId);
    const attachments = workspace.attachments(attachmentIds, conversationId);
    if (this.activeChats.has(conversationId)) throw new Error('This conversation already has a response in progress');
    const settings = workspace.settings();
    let route = await this.requireModelRouter().select(settings, 'conversation', ['text', 'streaming']);
    if (route.providerId !== 'local' && attachments.length > 0) {
      if (settings.routingMode === 'manual') {
        if (!settings.fileUploads) throw new Error('File uploads are disabled in Privacy Settings');
        throw new Error('Cloud attachment dispatch is not yet available; select the local route');
      }
      route = await this.requireModelRouter().select({
        ...settings,
        activeProvider: 'local',
        activeModel: 'mock-planner',
        fallbackOrder: ['local'],
      }, 'conversation', ['text', 'streaming']);
      route = { ...route, fallback: true, reason: `${route.reason}; attachment references remained local` };
    }
    const now = new Date().toISOString();
    project.repository.addMessage({
      id: randomUUID(),
      conversationId,
      role: 'user',
      parts: [
        { type: 'text', text: trimmed },
        ...attachments.map((attachment) => ({
          type: 'attachment-reference',
          attachmentId: attachment.id,
          name: attachment.name,
          mediaType: attachment.mediaType,
          sha256: attachment.sha256,
        })),
      ],
      createdAt: now,
    });
    const conversation = workspace.listConversations().find((entry) => entry.id === conversationId);
    if (conversation && ['New conversation', 'New robot workspace'].includes(conversation.title)) {
      workspace.renameConversation(conversationId, trimmed.replace(/\s+/g, ' ').slice(0, 64));
    }
    workspace.touchConversation(conversationId);
    workspace.autoCompactIfNeeded(conversationId);
    const requestId = randomUUID();
    const cloudProvider: CloudProviderId | null = route.providerId === 'local' ? null : route.providerId;
    const cloud = cloudProvider !== null;
    const disclosure = {
      providerId: route.providerId,
      modelId: route.modelId,
      purpose: 'Project conversation',
      dataClasses: ['conversation text', ...(attachments.length ? ['project attachment references'] : [])],
      attachments: attachments.map((attachment) => attachment.name),
      selectionReason: route.reason,
    };
    this.requireActivities().record('provider', 'dispatch-disclosed', `${route.providerId}/${route.modelId}: ${route.reason}`, disclosure);
    let responseText = '';
    let usage: { inputTokens: number | null; outputTokens: number | null } | null = null;
    const request = {
      requestId,
      modelId: route.modelId,
      purpose: cloud ? 'Project conversation' : 'Local non-mutating conversation',
      messages: workspace.dispatchMessages(conversationId),
      tools: [],
    };
    const localController = new AbortController();
    this.activeChats.set(conversationId, {
      requestId,
      cancel: cloud
        ? () => this.requireProviders().cancel(requestId)
        : () => localController.abort(),
    });
    try {
      const stream = cloudProvider
        ? this.requireProviders().stream(cloudProvider, request)
        : this.mockProvider.stream(null, request, localController.signal);
      for await (const event of stream) {
        if (event.type === 'text-delta') responseText += event.text;
        if (event.type === 'usage') usage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
      }
    } catch (error) {
      if (!localController.signal.aborted && !(error instanceof Error && error.name === 'AbortError')) throw error;
      responseText = responseText || 'Response stopped by user.';
    } finally {
      this.activeChats.delete(conversationId);
    }
    project.repository.addMessage({
      id: randomUUID(),
      conversationId,
      role: 'assistant',
      parts: [{ type: 'text', text: responseText }],
      createdAt: new Date().toISOString(),
    });
    workspace.touchConversation(conversationId);
    const completedAt = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `usage:${requestId}`,
      projectId: project.manifest.projectId,
      kind: 'usage',
      body: { type: 'provider-usage', providerId: route.providerId, modelId: request.modelId, usage, costUsd: null, purpose: request.purpose, selectionReason: route.reason },
      createdAt: completedAt,
      updatedAt: completedAt,
    });
    this.requireActivities().record('conversation', 'message-completed', 'Conversation response stored', {
      providerId: route.providerId,
      modelId: request.modelId,
      selectionReason: route.reason,
      mutatingToolsAvailable: false,
      usage,
    });
    return this.getChat(conversationId);
  }

  stopChat(conversationId: string): void {
    const active = this.activeChats.get(conversationId);
    if (!active) return;
    active.cancel();
    this.requireActivities().record('conversation', 'response-stopped', 'Stopped an in-progress response', { conversationId, requestId: active.requestId });
  }

  compactConversation(conversationId: string): ConversationContextView {
    return this.requireWorkspace().compact(conversationId);
  }

  getConversationContext(conversationId: string): ConversationContextView {
    return this.requireWorkspace().context(conversationId);
  }

  importAttachments(conversationId: string, paths: string[]): Promise<AttachmentView[]> {
    return this.requireWorkspace().importAttachments(conversationId, paths);
  }

  listAttachments(conversationId: string): AttachmentView[] {
    return this.requireWorkspace().listAttachments(conversationId);
  }

  getWorkspaceSettings(): WorkspaceSettings {
    return this.requireWorkspace().settings();
  }

  updateWorkspaceSettings(settings: WorkspaceSettings): WorkspaceSettings {
    return this.requireWorkspace().updateSettings(settings);
  }

  listMemories(scope: 'project' | 'global'): MemoryView[] {
    return this.requireWorkspace().listMemories(scope);
  }

  saveMemory(scope: 'project' | 'global', title: string, content: string, id?: string): MemoryView {
    return this.requireWorkspace().saveMemory(scope, title, content, id);
  }

  deleteMemory(scope: 'project' | 'global', id: string): MemoryView[] {
    return this.requireWorkspace().deleteMemory(scope, id);
  }

  exportMemories(scope: 'project' | 'global', destination: string): Promise<string> {
    return this.requireWorkspace().exportMemories(scope, destination);
  }

  getUsageSummary(): UsageSummaryView {
    return this.requireWorkspace().usageSummary();
  }

  exportProject(destination: string): Promise<string> {
    return this.requireWorkspace().exportProject(destination);
  }

  async exportDiagnostics(destination: string): Promise<string> {
    const project = this.requireProject();
    const [nvidia, openai, doctor] = await Promise.all([
      this.requireProviders().status('nvidia'),
      this.requireProviders().status('openai'),
      this.runEnvironmentDoctor(),
    ]);
    const payload = sanitizeDiagnosticValue({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      projectId: project.manifest.projectId,
      appState: this.getState(),
      settings: this.getWorkspaceSettings(),
      providers: [nvidia, openai],
      environment: doctor,
      activities: this.requireActivities().list(200),
      includesConversationContent: false,
      includesMemoryContent: false,
      includesCredentials: false,
      automaticTelemetry: false,
    }, [
      [project.root, '%PROJECT_ROOT%'],
      [this.userDataDirectory, '%SIMFORGE_DATA%'],
    ]);
    const serialized = redactLikelySecrets(`${JSON.stringify(payload, null, 2)}\n`);
    await writeFile(path.resolve(destination), serialized, { encoding: 'utf8', flag: 'wx' });
    this.requireActivities().record('privacy', 'diagnostics-exported', 'Exported sanitized diagnostics after explicit request', {
      includesCredentials: false, includesConversationContent: false, includesMemoryContent: false,
    });
    return path.resolve(destination);
  }

  async prepareProjectDeletion(confirmation: string): Promise<string> {
    const project = this.requireProject();
    if (confirmation !== project.manifest.name) {
      throw new Error(`Project deletion requires the exact project name: ${project.manifest.name}`);
    }
    this.requireActivities().record('privacy', 'project-deletion-approved', 'Project deletion confirmed; moving the active project to the Recycle Bin', {
      projectId: project.manifest.projectId,
    });
    await this.bridge?.stop();
    project.repository.close();
    this.globalRepository?.unregisterProject(project.manifest.projectId);
    this.globalRepository?.close();
    this.closed = true;
    return project.root;
  }

  generateScenePreview() {
    return this.requirePreviews().generate();
  }

  getScenePreviewData(previewId: string): Promise<string> {
    return this.requirePreviews().data(previewId);
  }

  selectSceneObject(previewId: string, objectId: string): Promise<string> {
    return this.requirePreviews().selectObject(previewId, objectId);
  }

  sceneFilePath(): string {
    const project = this.requireProject();
    const fromScene = this.requireSceneState().current?.blenderFile;
    return fromScene && path.isAbsolute(fromScene)
      ? fromScene
      : path.resolve(project.root, fromScene ?? project.manifest.blenderFile);
  }

  listVersions(): VersionView[] {
    return this.requireWorkspace().listVersions();
  }

  createVersion(name: string, checkpointId: string, branchOf?: string): VersionView {
    return this.requireWorkspace().createVersion(name, checkpointId, branchOf);
  }

  getTimeline(): TimelineEventView[] {
    return this.requireWorkspace().timeline(this.listExports());
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

  private requireModelRouter(): ModelRouter {
    if (!this.modelRouter) throw new Error('Model router is not initialized');
    return this.modelRouter;
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

  private requirePreviews(): PreviewService {
    if (!this.previews) throw new Error('Preview service is not initialized');
    return this.previews;
  }

  private requireWorkspace(): WorkspaceService {
    if (!this.workspace) throw new Error('Workspace service is not initialized');
    return this.workspace;
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

function sanitizeDiagnosticValue(
  value: unknown,
  replacements: Array<[string, string]>,
): unknown {
  if (typeof value === 'string') {
    return replacements.reduce((current, [privateValue, replacement]) => (
      privateValue ? current.replaceAll(privateValue, replacement) : current
    ), value);
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeDiagnosticValue(entry, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      sanitizeDiagnosticValue(entry, replacements),
    ]));
  }
  return value;
}
