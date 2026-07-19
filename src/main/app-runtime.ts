import { randomUUID } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AppState,
  BridgeEvent,
  EnvironmentGraph,
  ExportKind,
  ExportResult,
  IsaacEnvironmentStatus,
  IsaacExperiment,
  ImportReport,
  Mode,
  ModelDescriptor,
  ReviewManifest,
  RobotGraph,
  RobotMaterial,
  RobotSensor,
  NativeImportReport,
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
import { evaluateAutomaticAuthority } from './domain/action-authority';
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
import {
  warehouseEnvironmentGraph,
  warehouseMobileManipulatorGraph,
} from './robotics/warehouse-mobile-manipulator';
import { PreviewService } from './preview/preview-service';
import { WorkspaceService } from './workspace/workspace-service';
import { UrdfImportService } from './import/urdf-import-service';
import {
  NativeImportService,
  type NativeImportDecisionProposal,
  type NativeImportProposal,
} from './import/native-import-service';
import {
  createIsaacStabilityCorrectionProposal,
  IsaacExperimentService,
  type IsaacCorrectionProposal,
  type IsaacExperimentAnalysis,
  type IsaacExperimentProposal,
} from './isaac/isaac-service';

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
  private isaac: IsaacExperimentService | null = null;
  private previews: PreviewService | null = null;
  private workspace: WorkspaceService | null = null;
  private providers: ProviderService | null = null;
  private modelRouter: ModelRouter | null = null;
  private imports: UrdfImportService | null = null;
  private nativeImports: NativeImportService | null = null;
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
    this.imports = new UrdfImportService(project, this.applicationRoot);
    this.nativeImports = new NativeImportService(project, this.applicationRoot);
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
    this.isaac = new IsaacExperimentService(
      project,
      this.exports,
      this.approvals,
      this.activities,
      this.applicationRoot,
      this.userDataDirectory,
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

  latestImportReport(): ImportReport | null {
    return this.requireImports().latest();
  }

  async stageBundledRobotImport(): Promise<ImportReport> {
    const report = await this.requireImports().stageBundledSample();
    this.requireActivities().record('import', 'robot-import-staged', 'Verified and staged the licensed ROS URDF tutorial robot', {
      importId: report.importId,
      sourceSha256: report.source.sourceSha256,
      sourceCommit: report.source.sourceCommit,
      license: report.source.license,
      links: report.robotGraph?.links.length ?? 0,
      joints: report.robotGraph?.joints.length ?? 0,
      losses: report.losses.length,
      remoteReferencesAccepted: false,
    });
    return report;
  }

  importedRobotProposal(): {
    planHash: string;
    toolId: 'robot.materialize';
    args: { graph: RobotGraph };
    graph: RobotGraph;
    report: ImportReport;
    summary: string;
  } {
    const report = this.requireImports().latest();
    if (!report || report.status !== 'STAGED' || !report.robotGraph) {
      throw new Error('A verified staged URDF import is required before materialization');
    }
    const graph = report.robotGraph;
    const args = { graph };
    return {
      planHash: sha256({ toolId: 'robot.materialize', args }),
      toolId: 'robot.materialize',
      args,
      graph,
      report,
      summary: `${graph.links.length} imported links / ${graph.joints.length} joints / ${report.losses.length} disclosed conversion losses`,
    };
  }

  async buildImportedRobot(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
    report: ImportReport;
  }> {
    const { snapshot } = await this.requireSceneState().refresh();
    const proposal = this.importedRobotProposal();
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
    this.saveRobotGraph(proposal.graph, execution);
    const report = this.requireImports().markMaterialized(proposal.report, execution.postRevision);
    await this.requireSceneState().refresh();
    const validation = await this.requireValidation().run();
    this.requireActivities().record('import', 'robot-import-materialized', 'Materialized and validated the approved imported RobotGraph', {
      importId: report.importId,
      robotId: proposal.graph.robotId,
      sceneRevision: validation.sceneRevision,
      checkpointId: execution.checkpointId,
      blocker: validation.summary.blocker,
      error: validation.summary.error,
    });
    return { state: this.getState(), validation, report };
  }

  importedRobotModificationProposal(): {
    planHash: string;
    toolId: 'robot.add_sensor';
    args: { robotId: string; sensor: RobotSensor; material: RobotMaterial; reason: string };
    graph: RobotGraph;
    report: ImportReport;
    summary: string;
  } {
    const report = this.requireImports().latest();
    if (!report || report.status !== 'MATERIALIZED' || !report.robotGraph) {
      throw new Error('The imported robot must be materialized before proposing a modification');
    }
    const head = report.robotGraph.links.find((link) => link.id === 'head') ?? report.robotGraph.links[0];
    if (!head) throw new Error('The imported robot has no sensor parent link');
    const sensor: RobotSensor = {
      id: 'simforge-inspection-camera',
      name: 'SimForge Forward Inspection Camera',
      type: 'CAMERA',
      parentLinkId: head.id,
      pose: {
        position: [head.pose.position[0] + 0.18, head.pose.position[1], head.pose.position[2] + 0.03],
        rotationEuler: [0, 0, 0],
      },
      fieldOfViewDegrees: 68,
    };
    if (report.robotGraph.sensors.some((candidate) => candidate.id === sensor.id)) {
      throw new Error('The meaningful imported-robot modification already exists');
    }
    const material = report.robotGraph.materials.find((candidate) => candidate.id === 'sensor-amber');
    if (!material) throw new Error('The reviewed sensor material is absent from the imported graph');
    const reason = 'Add a forward inspection camera to make the imported robot materially useful for visual inspection tasks.';
    const graph: RobotGraph = {
      ...report.robotGraph,
      sensors: [...report.robotGraph.sensors, sensor],
      assumptions: [...report.robotGraph.assumptions, 'The added camera uses a user-approved 68-degree horizontal field of view and is not claimed to be source URDF data.'],
    };
    const args = { robotId: graph.robotId, sensor, material, reason };
    return {
      planHash: sha256({ toolId: 'robot.add_sensor', args }),
      toolId: 'robot.add_sensor',
      args,
      graph,
      report,
      summary: `Add one exact-approved 68° inspection camera to ${head.name}; preserve all ${graph.links.length} imported links and source provenance`,
    };
  }

  async modifyImportedRobot(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
    report: ImportReport;
  }> {
    const { snapshot } = await this.requireSceneState().refresh();
    const proposal = this.importedRobotModificationProposal();
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
    this.saveRobotGraph(proposal.graph, execution);
    const report = this.requireImports().markModified(
      proposal.report,
      proposal.graph,
      execution.postRevision,
      proposal.summary,
    );
    await this.requireSceneState().refresh();
    const validation = await this.requireValidation().run();
    this.requireActivities().record('import', 'robot-import-modified', 'Added and validated the approved inspection camera', {
      importId: report.importId,
      robotId: proposal.graph.robotId,
      sceneRevision: validation.sceneRevision,
      checkpointId: execution.checkpointId,
      sensors: proposal.graph.sensors.length,
      blocker: validation.summary.blocker,
      error: validation.summary.error,
    });
    return { state: this.getState(), validation, report };
  }

  listNativeImports(): NativeImportReport[] {
    return this.requireNativeImports().list();
  }

  prepareNativeImport(sourcePath: string): Promise<NativeImportProposal> {
    return this.requireNativeImports().prepare(sourcePath);
  }

  async executeNativeImport(
    proposal: NativeImportProposal,
    approvalId: string,
  ): Promise<{ state: AppState; validation: ValidationRun; report: NativeImportReport }> {
    this.requireNativeImports().validateProposal(proposal);
    const { snapshot } = await this.requireSceneState().refresh();
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
    const report = this.requireNativeImports().markStaged(proposal.report, execution.result, execution.postRevision);
    await this.requireSceneState().refresh();
    const validation = await this.requireValidation().run();
    this.requireActivities().record('import', 'native-import-staged', `Blender staged ${report.objectCount} ${report.source.format} objects`, {
      importId: report.importId,
      format: report.source.format,
      sourceSha256: report.source.sha256,
      objectCount: report.objectCount,
      checkpointId: execution.checkpointId,
      sceneRevision: report.sceneRevision,
      externalReferencesAccepted: false,
    });
    return { state: this.getState(), validation, report };
  }

  nativeImportDecisionProposal(importId: string, accept: boolean): NativeImportDecisionProposal {
    return this.requireNativeImports().decisionProposal(importId, accept);
  }

  async executeNativeImportDecision(
    proposal: NativeImportDecisionProposal,
    approvalId: string,
  ): Promise<{ state: AppState; validation: ValidationRun; report: NativeImportReport }> {
    this.requireNativeImports().validateDecisionProposal(proposal);
    const { snapshot } = await this.requireSceneState().refresh();
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
    const accepted = proposal.toolId === 'import.accept_native';
    const report = this.requireNativeImports().markDecision(proposal.report, accepted, execution.postRevision);
    await this.requireSceneState().refresh();
    const validation = await this.requireValidation().run();
    this.requireActivities().record('import', accepted ? 'native-import-accepted' : 'native-import-rejected', proposal.summary, {
      importId: report.importId,
      format: report.source.format,
      objectCount: report.objectCount,
      checkpointId: execution.checkpointId,
      sceneRevision: report.sceneRevision,
    });
    return { state: this.getState(), validation, report };
  }

  warehouseProposal(): {
    planHash: string;
    toolId: 'scene.materialize_assembly';
    args: { robotGraph: RobotGraph; environmentGraph: EnvironmentGraph };
    robotGraph: RobotGraph;
    environmentGraph: EnvironmentGraph;
    summary: string;
  } {
    const robotGraph = warehouseMobileManipulatorGraph();
    const environmentGraph = warehouseEnvironmentGraph();
    const args = { robotGraph, environmentGraph };
    return {
      planHash: sha256({ toolId: 'scene.materialize_assembly', args }),
      toolId: 'scene.materialize_assembly',
      args,
      robotGraph,
      environmentGraph,
      summary: `${robotGraph.links.length} links / ${robotGraph.joints.length} joints / ${robotGraph.sensors.length} sensors / ${environmentGraph.objects.length} warehouse objects`,
    };
  }

  async buildWarehouseScene(approvalId: string): Promise<{
    state: AppState;
    validation: ValidationRun;
  }> {
    const { snapshot } = await this.requireSceneState().refresh();
    const proposal = this.warehouseProposal();
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
      id: `robot-graph:${proposal.robotGraph.robotId}:${execution.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: {
        type: 'robot-graph',
        graph: proposal.robotGraph,
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
    project.repository.saveProjectRecord({
      id: `environment-graph:${proposal.environmentGraph.environmentId}:${execution.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: {
        type: 'environment-graph',
        graph: proposal.environmentGraph,
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
    this.requireActivities().record('robotics', 'warehouse-assembly-materialized', 'Warehouse mobile manipulator assembly materialized and validated', {
      robotId: proposal.robotGraph.robotId,
      environmentId: proposal.environmentGraph.environmentId,
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
    const environment = this.requireValidation().latestEnvironmentGraph();
    return this.requireReviews().render(graph.robotId, label, environment?.environmentId);
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

  getIsaacEnvironment(): Promise<IsaacEnvironmentStatus> {
    return this.requireIsaac().environment();
  }

  getIsaacExperimentProposal(): IsaacExperimentProposal {
    return this.requireIsaac().proposal();
  }

  runIsaacExperiment(
    proposal: IsaacExperimentProposal,
    approvalId: string,
  ): Promise<IsaacExperiment> {
    return this.requireIsaac().execute(proposal, approvalId);
  }

  listIsaacExperiments(): IsaacExperiment[] {
    return this.requireIsaac().list();
  }

  getIsaacExperimentImage(experimentId: string): Promise<string> {
    return this.requireIsaac().imageData(experimentId);
  }

  getIsaacExperimentImages(experimentId: string): Promise<string[]> {
    return this.requireIsaac().imageDataList(experimentId);
  }

  openIsaacExperiment(experimentId: string): Promise<{ opened: true; processId: number }> {
    return this.requireIsaac().openInteractive(experimentId);
  }

  async analyzeIsaacExperiment(experimentId: string): Promise<IsaacExperimentAnalysis> {
    const deterministic = this.requireIsaac().analysis(experimentId);
    const project = this.requireProject();
    const settings = this.requireWorkspace().settings();
    const route = await this.requireModelRouter().select(settings, 'validation-review', ['text', 'streaming']);
    const requestId = randomUUID();
    const request = {
      requestId,
      modelId: route.modelId,
      purpose: 'Advisory analysis of deterministic Isaac Sim evidence',
      messages: [{
        role: 'user' as const,
        parts: [{
          type: 'text' as const,
          text: [
            'Review the following deterministic Isaac Sim check evidence.',
            'Explain the failure plainly and assess the displayed bounded correction. Do not claim simulation evidence beyond this JSON.',
            JSON.stringify({
              experimentId,
              status: deterministic.status,
              failedCheckIds: deterministic.failedCheckIds,
              deterministicSummary: deterministic.deterministicSummary,
              stabilityEvidence: deterministic.stabilityEvidence,
            }),
          ].join('\n'),
        }],
      }],
      tools: [],
    };
    this.requireActivities().record('provider', 'dispatch-disclosed', `${route.providerId}/${route.modelId}: ${route.reason}`, {
      providerId: route.providerId,
      modelId: route.modelId,
      purpose: request.purpose,
      dataClasses: ['deterministic simulation findings', 'numeric physics evidence'],
      attachments: [],
      selectionReason: route.reason,
    });
    let responseText = '';
    let usage: { inputTokens: number | null; outputTokens: number | null } | null = null;
    const cloudProvider: CloudProviderId | null = route.providerId === 'local' ? null : route.providerId;
    const stream = cloudProvider
      ? this.requireProviders().stream(cloudProvider, request)
      : this.mockProvider.stream(null, request);
    for await (const event of stream) {
      if (event.type === 'text-delta') responseText += event.text;
      if (event.type === 'usage') usage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
    }
    const narrative = route.providerId === 'local'
      ? `${deterministic.deterministicSummary} Local fixture added no independent physics claims.`
      : responseText.trim() || `${deterministic.deterministicSummary} The selected provider returned no additional narrative.`;
    const analysis: IsaacExperimentAnalysis = {
      ...deterministic,
      model: {
        providerId: route.providerId,
        modelId: route.modelId,
        narrative,
        advisoryOnly: true,
        selectionReason: route.reason,
      },
    };
    const now = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `isaac-analysis:${analysis.analysisId}`,
      projectId: project.manifest.projectId,
      kind: 'validation',
      body: { type: 'isaac-analysis', analysis },
      createdAt: now,
      updatedAt: now,
    });
    project.repository.saveProjectRecord({
      id: `usage:${requestId}`,
      projectId: project.manifest.projectId,
      kind: 'usage',
      body: { type: 'provider-usage', providerId: route.providerId, modelId: route.modelId, usage, costUsd: null, purpose: request.purpose, selectionReason: route.reason },
      createdAt: now,
      updatedAt: now,
    });
    this.requireActivities().record('simulation', 'isaac-analysis-completed', 'AI reviewed retained deterministic simulation evidence', {
      experimentId,
      status: analysis.status,
      providerId: route.providerId,
      modelId: route.modelId,
      advisoryOnly: true,
      failedCheckIds: analysis.failedCheckIds,
    });
    return analysis;
  }

  async getIsaacCorrectionProposal(experimentId: string): Promise<IsaacCorrectionProposal> {
    const { snapshot } = await this.requireSceneState().refresh();
    const analysis = this.requireIsaac().analysis(experimentId);
    const graph = this.requireValidation().latestRobotGraph();
    const environment = this.requireValidation().latestEnvironmentGraph();
    if (!graph || !environment) throw new Error('Current RobotGraph and EnvironmentGraph are required for correction');
    return createIsaacStabilityCorrectionProposal(graph, environment, analysis, snapshot.sceneRevision);
  }

  async applyIsaacCorrection(
    proposal: IsaacCorrectionProposal,
    approvalId: string,
  ): Promise<{ state: AppState; validation: ValidationRun }> {
    if (
      proposal.toolId !== 'robot.retract_subtree' ||
      proposal.risk !== 'structural' ||
      proposal.planHash !== sha256({ toolId: proposal.toolId, args: proposal.args })
    ) throw new Error('Isaac correction proposal is invalid or changed');
    const source = this.requireIsaac().list().find((entry) => entry.experimentId === proposal.sourceExperimentId);
    if (!source || this.requireIsaac().analysis(source.experimentId).status !== 'CORRECTION_PROPOSED') {
      throw new Error('The source experiment no longer supports this correction');
    }
    const { snapshot } = await this.requireSceneState().refresh();
    if (snapshot.sceneRevision !== proposal.sceneRevision) {
      throw new Error('Blender changed after correction review; inspect the simulation proposal again');
    }
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
    this.saveRobotGraph(proposal.args.robotGraph, execution);
    const now = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `environment-graph:${proposal.args.environmentGraph.environmentId}:${execution.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: {
        type: 'environment-graph',
        graph: proposal.args.environmentGraph,
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
    project.repository.saveProjectRecord({
      id: `isaac-correction:${proposal.sourceExperimentId}:${execution.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'validation',
      body: {
        type: 'isaac-correction',
        sourceExperimentId: proposal.sourceExperimentId,
        proposal,
        checkpointId: execution.checkpointId,
        sceneRevision: execution.postRevision,
      },
      createdAt: now,
      updatedAt: now,
    });
    await this.requireSceneState().refresh();
    const validation = await this.requireValidation().run();
    this.requireActivities().record('simulation', 'isaac-correction-applied', 'Applied approved simulation correction in Blender and revalidated the scene', {
      sourceExperimentId: proposal.sourceExperimentId,
      rootLinkId: proposal.args.rootLinkId,
      deltaXM: proposal.args.deltaXM,
      checkpointId: execution.checkpointId,
      sceneRevision: validation.sceneRevision,
      blocker: validation.summary.blocker,
      error: validation.summary.error,
    });
    return { state: this.getState(), validation };
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
    const configuredAuthority = this.requireWorkspace().settings().actionMode;
    if (input.authority && input.authority !== configuredAuthority) {
      throw new Error('Action authority changed; review the action again');
    }
    const automatic = input.authority !== undefined;
    if (automatic) {
      const decision = evaluateAutomaticAuthority({
        authority: configuredAuthority,
        toolId: tool.id,
        risk: tool.risk,
        planBound: Boolean(input.planHash),
      });
      if (!decision.allowed) throw new Error(`${decision.code}: ${decision.reason}`);
    }
    const approvalId = this.requireApprovals().approve({
      projectId: state.projectId,
      planHash: input.planHash,
      toolId: input.toolId,
      args: input.args,
      sceneRevision: state.sceneRevision,
      risk: tool.risk,
    });
    this.requireActivities().record('approval', automatic ? 'approved-plan-authority-used' : 'action-approved', automatic ? `Approved plan continued with ${input.toolId}` : `Approved ${input.toolId}`, {
      approvalId,
      planHash: input.planHash,
      sceneRevision: state.sceneRevision,
      authority: configuredAuthority,
      automatic,
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
      if (task.id === 'build') {
        if (!this.requireValidation().latestRobotGraph() || !this.requireValidation().latestEnvironmentGraph()) {
          throw new Error('Approve and run the checkpointed warehouse build action, then retry this goal task');
        }
        return;
      }
      if (task.id === 'validate') {
        await this.requireValidation().run();
        return;
      }
      if (task.id === 'review') {
        const graph = this.requireValidation().latestRobotGraph();
        if (!graph) throw new Error('Build the warehouse manipulator before rendering review evidence');
        const environment = this.requireValidation().latestEnvironmentGraph();
        await this.requireReviews().render(graph.robotId, `Goal review at scene r${snapshot.sceneRevision}`, environment?.environmentId);
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

  async runEnvironmentDoctor(): Promise<DoctorCheck[]> {
    const [base, nvidia, openai] = await Promise.all([
      runEnvironmentDoctor(this.applicationRoot, this.userDataDirectory),
      this.requireProviders().status('nvidia'),
      this.requireProviders().status('openai'),
    ]);
    const providerCheck = (status: typeof nvidia): DoctorCheck => ({
      id: status.providerId,
      ok: status.configured && status.discoveredModels > 0 && status.lastError === null,
      severity: status.configured && status.discoveredModels > 0 && status.lastError === null ? 'pass' : 'warning',
      summary: status.lastError
        ? `Last discovery failed: ${status.lastError}`
        : status.configured
          ? status.discoveredModels > 0
            ? `${status.discoveredModels} runtime-discovered model${status.discoveredModels === 1 ? '' : 's'} available`
            : 'Credential is protected; run model discovery before cloud use'
          : 'Optional provider credential is not configured',
      path: null,
    });
    const state = this.getState();
    return [
      ...base.slice(0, 2),
      {
        id: 'bridge',
        ok: state.bridgeConnected,
        severity: state.bridgeConnected ? 'pass' : 'warning',
        summary: state.bridgeConnected
          ? `Authenticated Blender bridge connected at scene revision ${state.sceneRevision ?? 0}`
          : 'Blender bridge is waiting; start Blender with the SimForge extension enabled',
        path: null,
      },
      ...base.slice(2),
      providerCheck(nvidia),
      providerCheck(openai),
    ];
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

  private requireIsaac(): IsaacExperimentService {
    if (!this.isaac) throw new Error('Isaac experiment service is not initialized');
    return this.isaac;
  }

  private requirePreviews(): PreviewService {
    if (!this.previews) throw new Error('Preview service is not initialized');
    return this.previews;
  }

  private requireWorkspace(): WorkspaceService {
    if (!this.workspace) throw new Error('Workspace service is not initialized');
    return this.workspace;
  }

  private requireImports(): UrdfImportService {
    if (!this.imports) throw new Error('Import service is not initialized');
    return this.imports;
  }

  private requireNativeImports(): NativeImportService {
    if (!this.nativeImports) throw new Error('Native import service is not initialized');
    return this.nativeImports;
  }

  private saveRobotGraph(
    graph: RobotGraph,
    execution: {
      preRevision: number;
      postRevision: number;
      checkpointId: string | null;
      result: unknown;
    },
  ): void {
    const project = this.requireProject();
    const now = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `robot-graph:${graph.robotId}:${execution.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: {
        type: 'robot-graph',
        graph,
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
