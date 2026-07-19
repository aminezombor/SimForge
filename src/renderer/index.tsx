/* React event handlers delegate rejected work to the shared run() error boundary; demo methods intentionally resolve synchronously. */
/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/require-await */
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsClockwise,
  Atom,
  GitBranch,
  CaretDown,
  Check,
  CheckCircle,
  ClockCounterClockwise,
  CubeFocus,
  Database,
  Export,
  FilePlus,
  GearSix,
  HardDrives,
  ImageSquare,
  ListChecks,
  MagnifyingGlass,
  Paperclip,
  PaperPlaneTilt,
  Pause,
  Play,
  Plus,
  Robot,
  SidebarSimple,
  SlidersHorizontal,
  Sparkle,
  Stop,
  Trash,
  UserCircle,
  Warning,
  X,
} from '@phosphor-icons/react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  AppState,
  ExportKind,
  ExportResult,
  IsaacEnvironmentStatus,
  IsaacExperiment,
  ImportReport,
  Mode,
  ModelDescriptor,
  ReviewManifest,
  SceneObject,
  ScenePreviewManifest,
  NativeImportReport,
  ValidationRun,
} from '../shared/contracts';
import type {
  AttachmentView,
  ChatMessageView,
  CheckpointView,
  ConversationContextView,
  ConversationSummaryView,
  ExportProposal,
  GoalJobView,
  ImportedRobotModificationProposal,
  ImportedRobotProposal,
  IsaacCorrectionProposal,
  IsaacExperimentAnalysis,
  IsaacExperimentProposal,
  NativeImportDecisionProposal,
  NativeImportProposal,
  MemoryView,
  SimForgeDesktopApi,
  TimelineEventView,
  UsageSummaryView,
  VersionView,
  WarehouseProposal,
  WorkspaceSettings,
} from '../shared/desktop-api';
import { classifyChatIntent, type ChatIntent } from '../shared/chat-intents';
import type { DoctorCheck } from '../main/environment-doctor';
import type { CloudProviderId, ProviderStatus } from '../main/providers/provider-service';
import './styles.css';

const PLAN_TASKS = [
  { id: 'inspect', description: 'Read a fresh Blender scene snapshot.' },
  { id: 'checkpoint', description: 'Create a recovery checkpoint.' },
  { id: 'build', description: 'Materialize the exact-approved robot and warehouse graphs.' },
  { id: 'validate', description: 'Run deterministic geometry, robotics, and environment checks.' },
  { id: 'review', description: 'Render materialized robot and warehouse evidence.' },
  { id: 'verify', description: 'Refresh scene truth and report the revision.' },
];

type DockTab = 'activity' | 'validation' | 'simulation' | 'export' | 'history';
type SettingsTab = 'providers' | 'privacy' | 'environment';
type ChatActionStatus = { state: 'working' | 'done'; detail: string };

const demoApi = createDemoApi();
const desktop: SimForgeDesktopApi = window.simforge ?? demoApi;

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [conversations, setConversations] = useState<ConversationSummaryView[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  const [context, setContext] = useState<ConversationContextView | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [composer, setComposer] = useState('');
  const [search, setSearch] = useState('');
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 980);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>('activity');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [chatActionStatus, setChatActionStatus] = useState<Record<string, ChatActionStatus>>({});
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('providers');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [job, setJob] = useState<GoalJobView | null>(null);
  const [robotProposal, setRobotProposal] = useState<WarehouseProposal | null>(null);
  const [robotApproval, setRobotApproval] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importProposal, setImportProposal] = useState<ImportedRobotProposal | null>(null);
  const [importApproval, setImportApproval] = useState<string | null>(null);
  const [importModification, setImportModification] = useState<ImportedRobotModificationProposal | null>(null);
  const [importModificationApproval, setImportModificationApproval] = useState<string | null>(null);
  const [nativeImports, setNativeImports] = useState<NativeImportReport[]>([]);
  const [nativeProposal, setNativeProposal] = useState<NativeImportProposal | null>(null);
  const [nativeApproval, setNativeApproval] = useState<string | null>(null);
  const [nativeDecision, setNativeDecision] = useState<NativeImportDecisionProposal | null>(null);
  const [nativeDecisionApproval, setNativeDecisionApproval] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationRun | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointView[]>([]);
  const [versions, setVersions] = useState<VersionView[]>([]);
  const [timeline, setTimeline] = useState<TimelineEventView[]>([]);
  const [exports, setExports] = useState<ExportResult[]>([]);
  const [isaacEnvironment, setIsaacEnvironment] = useState<IsaacEnvironmentStatus | null>(null);
  const [isaacExperiments, setIsaacExperiments] = useState<IsaacExperiment[]>([]);
  const [isaacProposal, setIsaacProposal] = useState<IsaacExperimentProposal | null>(null);
  const [isaacApproval, setIsaacApproval] = useState<string | null>(null);
  const [isaacAnalysis, setIsaacAnalysis] = useState<IsaacExperimentAnalysis | null>(null);
  const [isaacCorrection, setIsaacCorrection] = useState<IsaacCorrectionProposal | null>(null);
  const [isaacCorrectionApproval, setIsaacCorrectionApproval] = useState<string | null>(null);
  const [isaacNotice, setIsaacNotice] = useState<string | null>(null);
  const [isaacImages, setIsaacImages] = useState<string[]>([]);
  const [preview, setPreview] = useState<ScenePreviewManifest | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<'live' | 'review'>('live');
  const [review, setReview] = useState<ReviewManifest | null>(null);
  const [reviews, setReviews] = useState<ReviewManifest[]>([]);
  const [reviewImages, setReviewImages] = useState<Record<string, string>>({});
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The operation could not be completed');
    } finally {
      setBusy('');
    }
  }, []);

  const refreshState = useCallback(async () => {
    const next = await desktop.getState();
    setState(next);
    return next;
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const [nextState, nextConversations, nextValidation, nextCheckpoints, nextVersions, nextTimeline, nextExports, nextSettings, nextReviews, nextImport, nextNativeImports, nextIsaacEnvironment, nextIsaacExperiments] = await Promise.all([
      desktop.getState(), desktop.listConversations(search), desktop.getLatestValidation(),
      desktop.listCheckpoints(), desktop.listVersions(), desktop.getTimeline(), desktop.listExports(),
      desktop.getWorkspaceSettings(), desktop.listReviews(), desktop.getLatestImportReport(), desktop.listNativeImports(),
      desktop.getIsaacEnvironment(), desktop.listIsaacExperiments(),
    ]);
    setState(nextState);
    setConversations(nextConversations);
    setValidation(nextValidation);
    setCheckpoints(nextCheckpoints);
    setVersions(nextVersions);
    setTimeline(nextTimeline);
    setExports(nextExports);
    setSettings(nextSettings);
    setReviews(nextReviews);
    setImportReport(nextImport);
    setNativeImports(nextNativeImports);
    setIsaacEnvironment(nextIsaacEnvironment);
    setIsaacExperiments(nextIsaacExperiments);
    const active = nextConversations.some((entry) => entry.id === activeConversationId)
      ? activeConversationId
      : nextConversations[0]?.id ?? '';
    if (active && active !== activeConversationId) setActiveConversationId(active);
    if (nextState.activeGoalJobId) {
      desktop.getGoal(nextState.activeGoalJobId).then(setJob).catch(() => setJob(null));
    }
    desktop.getWarehouseProposal().then(setRobotProposal).catch(() => setRobotProposal(null));
    if (nextImport?.status === 'STAGED') {
      desktop.getImportedRobotProposal().then(setImportProposal).catch(() => setImportProposal(null));
      setImportModification(null);
    } else if (nextImport?.status === 'MATERIALIZED') {
      setImportProposal(null);
      desktop.getImportedRobotModificationProposal().then(setImportModification).catch(() => setImportModification(null));
    } else {
      setImportProposal(null);
      setImportModification(null);
    }
  }, [activeConversationId, search]);

  const loadConversation = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    const [nextMessages, nextAttachments, nextContext] = await Promise.all([
      desktop.getChat(conversationId),
      desktop.listAttachments(conversationId),
      desktop.getConversationContext(conversationId),
    ]);
    setMessages(nextMessages);
    setAttachments(nextAttachments);
    setContext(nextContext);
    setPendingAttachmentIds([]);
  }, []);

  useEffect(() => {
    void run('loading', refreshWorkspace);
  }, []);

  useEffect(() => {
    if (activeConversationId) void run('conversation', () => loadConversation(activeConversationId));
  }, [activeConversationId, loadConversation, run]);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshState().catch(() => undefined), 1_500);
    return () => window.clearInterval(timer);
  }, [refreshState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void desktop.listConversations(search).then(setConversations).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const latest = isaacExperiments[0];
    if (dockTab !== 'simulation' || !latest) {
      if (!latest) setIsaacImages([]);
      return;
    }
    void desktop.getIsaacExperimentImages(latest.experimentId).then(setIsaacImages).catch(() => setIsaacImages([]));
  }, [dockTab, isaacExperiments]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [activeConversationId, messages.length, chatActionStatus]);

  if (!state || !settings) {
    return <main className="loading-screen"><CubeFocus size={28} weight="duotone" /><span>Preparing your robotics workspace…</span></main>;
  }

  const activeConversation = conversations.find((entry) => entry.id === activeConversationId) ?? null;
  const previewStale = Boolean(preview && (preview.sceneRevision !== state.sceneRevision || !state.bridgeConnected));
  const routeLabel = settings.activeProvider === 'local'
    ? 'Local fixture'
    : `${settings.activeProvider.toUpperCase()} · ${settings.activeModel.split('/').at(-1)}`;

  const selectPreviewObject = (objectId: string | null) => {
    setSelectedObjectId(objectId);
    if (!objectId || !preview || previewStale) return;
    void run('selection-link', async () => { await desktop.selectSceneObject(preview.previewId, objectId); });
  };
  const selectConversation = (id: string) => setActiveConversationId(id);
  const createConversation = () => run('new-chat', async () => {
    const created = await desktop.createConversation();
    setConversations(await desktop.listConversations(search));
    setActiveConversationId(created.id);
  });
  const renameConversation = (conversation: ConversationSummaryView) => {
    const title = window.prompt('Rename conversation', conversation.title);
    if (!title || title.trim() === conversation.title) return;
    void run('rename-chat', async () => {
      await desktop.renameConversation(conversation.id, title);
      setConversations(await desktop.listConversations(search));
    });
  };
  const deleteConversation = (conversation: ConversationSummaryView) => {
    if (!window.confirm(`Delete “${conversation.title}” and its messages?`)) return;
    void run('delete-chat', async () => {
      const next = await desktop.deleteConversation(conversation.id);
      setConversations(next);
      setActiveConversationId(next[0]?.id ?? '');
    });
  };
  const branchConversation = (conversationId: string, throughMessageId?: string) => run('branch-chat', async () => {
    const branch = await desktop.branchConversation(conversationId, throughMessageId);
    setConversations(await desktop.listConversations(search));
    setActiveConversationId(branch.id);
  });
  const send = () => run('sending', async () => {
    if (!activeConversationId || !composer.trim()) return;
    const text = composer;
    setComposer('');
    const next = await desktop.sendChat(activeConversationId, text, pendingAttachmentIds);
    setMessages(next);
    setPendingAttachmentIds([]);
    setContext(await desktop.getConversationContext(activeConversationId));
    setConversations(await desktop.listConversations(search));
    setTimeline(await desktop.getTimeline());
  });
  const executeChatAction = (actionKey: string, intent: ChatIntent) => run(`chat-action:${actionKey}`, async () => {
    const setAction = (state: ChatActionStatus['state'], detail: string) => {
      setChatActionStatus((current) => ({ ...current, [actionKey]: { state, detail } }));
    };
    const clearAction = () => setChatActionStatus((current) => {
      const next = { ...current };
      delete next[actionKey];
      return next;
    });
    try {
      if (intent.kind === 'build-robot') {
        const proposal = await desktop.getWarehouseProposal();
        if (!window.confirm(`Approve this checkpointed Blender build?\n\n${proposal.summary}\n\nIncludes the generated warehouse environment.`)) return;
        setAction('working', 'Building the approved robot and workcell in Blender...');
        const buildState = await desktop.setMode('build');
        if (!buildState.bridgeConnected) throw new Error('Blender is not connected. Start it from the SimForge desktop launcher, then try again.');
        await desktop.refreshScene();
        const approvalId = await desktop.approveAction({ planHash: proposal.planHash, toolId: proposal.toolId, args: proposal.args });
        const result = await desktop.buildWarehouseScene(approvalId);
        setState(result.state);
        setValidation(result.validation);
        const manifest = await desktop.generateScenePreview();
        setPreview(manifest);
        setPreviewData(await desktop.getScenePreviewData(manifest.previewId));
        setDockTab('validation');
        setAction('done', `Built in Blender at scene r${result.validation.sceneRevision}; ${result.validation.findings.length} deterministic findings recorded.`);
      } else if (intent.kind === 'add-primitive') {
        if (!window.confirm(`Add ${intent.name} at [${intent.location.join(', ')}] metres?\n\nA Blender checkpoint will be created first.`)) return;
        setAction('working', 'Creating the approved object in Blender...');
        await desktop.setMode('normal');
        const next = await desktop.executeTool({
          toolId: 'object.create_primitive',
          args: { primitive: intent.primitive, name: intent.name, location: intent.location },
          planHash: null,
          planApproved: false,
          approvalId: null,
        });
        setState(next);
        const manifest = await desktop.generateScenePreview();
        setPreview(manifest);
        setPreviewData(await desktop.getScenePreviewData(manifest.previewId));
        setAction('done', `${intent.name} is visible in Blender at scene r${next.sceneRevision ?? 'unknown'}.`);
      } else if (intent.kind === 'export-usd') {
        setAction('working', 'Refreshing deterministic evidence and preparing the USD package...');
        await desktop.setMode('build');
        let nextValidation = await desktop.runValidation();
        setValidation(nextValidation);
        const blockingFindings = nextValidation.findings.filter((finding) => (
          finding.status === 'OPEN' && (finding.severity === 'blocker' || finding.severity === 'error')
        ));
        if (blockingFindings.length > 0) {
          const safeCorrections = blockingFindings.every((finding) => (
            finding.proposedFix?.fixClass === 'SAFE_LOCAL' &&
            finding.proposedFix.reversible &&
            !finding.proposedFix.approvalRequired
          ));
          if (!safeCorrections) {
            setDockTab('validation');
            throw new Error(`${blockingFindings.length} deterministic blocker(s) need a reviewed correction before export. Open Validate to inspect them.`);
          }
          const correctionSummary = blockingFindings
            .map((finding) => `- ${finding.message}\n  Proposed: ${finding.proposedFix?.label}`)
            .join('\n');
          if (!window.confirm(`Deterministic validation found ${blockingFindings.length} reversible issue(s):\n\n${correctionSummary}\n\nApprove these checkpointed corrections before export?`)) {
            setDockTab('validation');
            setAction('done', 'Export paused. Review the deterministic finding in Validate, then ask to export again.');
            return;
          }
          for (const sourceFinding of blockingFindings) {
            const currentFinding = nextValidation.findings.find((finding) => (
              finding.status === 'OPEN' &&
              finding.ruleId === sourceFinding.ruleId &&
              finding.entityPath === sourceFinding.entityPath
            ));
            if (!currentFinding) continue;
            nextValidation = await desktop.applyValidationFix({
              findingId: currentFinding.id,
              planHash: null,
              approvalId: null,
            });
          }
          setValidation(nextValidation);
          if (nextValidation.summary.blocker + nextValidation.summary.error > 0) {
            setDockTab('validation');
            throw new Error('A correction ran, but deterministic validation still reports a blocker. Review Validate before export.');
          }
        }
        const destination = await desktop.chooseExportDestination('canonical');
        if (!destination) {
          clearAction();
          return;
        }
        nextValidation = await desktop.runValidation();
        setValidation(nextValidation);
        if (nextValidation.summary.blocker + nextValidation.summary.error > 0) {
          setDockTab('validation');
          throw new Error('The Blender scene changed while choosing a destination. Review the fresh deterministic findings, then ask to export again.');
        }
        await desktop.renderPrimitiveRobotReview(`Chat export review at scene r${nextValidation.sceneRevision}`);
        const proposal = await desktop.proposeExport('canonical', destination, false);
        if (!window.confirm(`Approve this exact canonical USD export?\n\n${proposal.summary}\n\nOverwrite: no`)) {
          clearAction();
          return;
        }
        const approvalId = await desktop.approveAction({ planHash: proposal.planHash, toolId: proposal.toolId, args: proposal.args });
        const result = await desktop.executeExport(proposal, approvalId);
        setExports(await desktop.listExports());
        setDockTab('export');
        setAction('done', `Verified canonical USD written to ${result.destination}. Reopen checks: ${result.checks.length}; physics and composition layers included.`);
      } else if (intent.kind === 'simulate-isaac') {
        const environment = await desktop.getIsaacEnvironment();
        setIsaacEnvironment(environment);
        if (!environment.runtimeReady) throw new Error(`Isaac Sim is not ready. ${environment.issues.join(' ')}`);
        const proposal = await desktop.getIsaacExperimentProposal();
        if (!window.confirm(`Approve this local Isaac Sim run?\n\n${proposal.summary}\n\nThe latest verified USD package will be copied into an isolated experiment.`)) return;
        setAction('working', 'Running the approved USD package in Isaac Sim and collecting evidence...');
        await desktop.setMode('build');
        const approvalId = await desktop.approveAction({ planHash: proposal.planHash, toolId: proposal.toolId, args: proposal.args });
        const experiment = await desktop.runIsaacExperiment(proposal, approvalId);
        const analysis = await desktop.analyzeIsaacExperiment(experiment.experimentId);
        setIsaacExperiments(await desktop.listIsaacExperiments());
        setIsaacImages(await desktop.getIsaacExperimentImages(experiment.experimentId));
        setIsaacAnalysis(analysis);
        await desktop.openIsaacExperiment(experiment.experimentId);
        setDockTab('simulation');
        setAction('done', `${experiment.status}: ${analysis.deterministicSummary}`);
      }
      setTimeline(await desktop.getTimeline());
      setCheckpoints(await desktop.listCheckpoints());
    } catch (reason) {
      clearAction();
      throw reason;
    }
  });
  const attach = () => run('attach', async () => {
    const imported = await desktop.chooseAttachments(activeConversationId);
    setAttachments(await desktop.listAttachments(activeConversationId));
    setPendingAttachmentIds((current) => [...new Set([...current, ...imported.map((entry) => entry.id)])]);
  });
  const generatePreview = () => run('preview', async () => {
    const manifest = await desktop.generateScenePreview();
    setPreview(manifest);
    setPreviewData(await desktop.getScenePreviewData(manifest.previewId));
    setState(await desktop.getState());
  });
  const runValidation = () => run('validation', async () => {
    setValidation(await desktop.runValidation());
    setDockTab('validation');
    await refreshWorkspace();
  });
  const buildRobot = () => run('robot', async () => {
    if (!robotProposal) return;
    if (!robotApproval) {
      setRobotApproval(await desktop.approveAction({
        planHash: robotProposal.planHash,
        toolId: robotProposal.toolId,
        args: robotProposal.args,
      }));
      return;
    }
    const result = await desktop.buildWarehouseScene(robotApproval);
    setState(result.state);
    setValidation(result.validation);
    setRobotApproval(null);
    setDockTab('validation');
    await generatePreview();
    await refreshWorkspace();
  });
  const stageImport = () => run('import-stage', async () => {
    const report = await desktop.stageBundledRobotImport();
    setImportReport(report);
    setImportProposal(await desktop.getImportedRobotProposal());
    setImportApproval(null);
    setImportModification(null);
    setImportModificationApproval(null);
    await refreshWorkspace();
  });
  const buildImportedRobot = () => run('import-build', async () => {
    if (!importProposal) return;
    if (!importApproval) {
      setImportApproval(await desktop.approveAction({
        planHash: importProposal.planHash,
        toolId: importProposal.toolId,
        args: importProposal.args,
      }));
      return;
    }
    const result = await desktop.buildImportedRobot(importApproval);
    setState(result.state);
    setValidation(result.validation);
    setImportReport(result.report);
    setImportProposal(null);
    setImportApproval(null);
    setImportModification(await desktop.getImportedRobotModificationProposal());
    setDockTab('validation');
    await generatePreview();
    await refreshWorkspace();
  });
  const modifyImportedRobot = () => run('import-modify', async () => {
    if (!importModification) return;
    if (!importModificationApproval) {
      setImportModificationApproval(await desktop.approveAction({
        planHash: importModification.planHash,
        toolId: importModification.toolId,
        args: importModification.args,
      }));
      return;
    }
    const result = await desktop.modifyImportedRobot(importModificationApproval);
    setState(result.state);
    setValidation(result.validation);
    setImportReport(result.report);
    setImportModification(null);
    setImportModificationApproval(null);
    setDockTab('validation');
    await generatePreview();
    await refreshWorkspace();
  });
  const chooseNativeImport = () => run('native-choose', async () => {
    const proposal = await desktop.chooseNativeImport();
    if (!proposal) return;
    setNativeProposal(proposal);
    setNativeApproval(null);
    setNativeDecision(null);
    setNativeDecisionApproval(null);
    setNativeImports(await desktop.listNativeImports());
  });
  const stageNativeImport = () => run('native-stage', async () => {
    if (!nativeProposal) return;
    if (!nativeApproval) {
      setNativeApproval(await desktop.approveAction({
        planHash: nativeProposal.planHash,
        toolId: nativeProposal.toolId,
        args: nativeProposal.args,
      }));
      return;
    }
    const result = await desktop.executeNativeImport(nativeProposal, nativeApproval);
    setState(result.state);
    setValidation(result.validation);
    setNativeImports(await desktop.listNativeImports());
    setNativeProposal(null);
    setNativeApproval(null);
    setDockTab('validation');
    await generatePreview();
  });
  const decideNativeImport = (accept: boolean) => run(accept ? 'native-accept' : 'native-reject', async () => {
    const staged = nativeImports.find((entry) => entry.status === 'STAGED');
    if (!staged) return;
    if (!nativeDecision || nativeDecision.toolId !== (accept ? 'import.accept_native' : 'import.reject_native')) {
      setNativeDecision(await desktop.getNativeImportDecisionProposal(staged.importId, accept));
      setNativeDecisionApproval(null);
      return;
    }
    if (!nativeDecisionApproval) {
      setNativeDecisionApproval(await desktop.approveAction({
        planHash: nativeDecision.planHash,
        toolId: nativeDecision.toolId,
        args: nativeDecision.args,
      }));
      return;
    }
    const result = await desktop.executeNativeImportDecision(nativeDecision, nativeDecisionApproval);
    setState(result.state);
    setValidation(result.validation);
    setNativeImports(await desktop.listNativeImports());
    setNativeDecision(null);
    setNativeDecisionApproval(null);
    setDockTab('validation');
    await generatePreview();
  });
  const renderReview = () => run('review', async () => {
    const manifest = await desktop.renderPrimitiveRobotReview(`Review at scene r${state.sceneRevision ?? 0}`);
    const pairs: Array<[string, string]> = await Promise.all(manifest.images.map(async (image) => [
      image.view,
      await desktop.getReviewImage(manifest.reviewId, image.view),
    ]));
    const images: Record<string, string> = Object.fromEntries(pairs);
    setReview(manifest);
    setReviews(await desktop.listReviews());
    setReviewImages(Object.fromEntries(Object.entries(images).map(([view, data]) => [`${manifest.reviewId}:${view}`, data])));
    setViewportMode('review');
  });
  const showReviewComparison = () => run('review-load', async () => {
    const selected = reviews.slice(0, 2);
    if (selected.length === 0) return;
    const pairs: Array<[string, string]> = await Promise.all(selected.map(async (manifest) => [
      `${manifest.reviewId}:three-quarter`,
      await desktop.getReviewImage(manifest.reviewId, 'three-quarter'),
    ]));
    setReview(selected[0] ?? null);
    setReviewImages(Object.fromEntries(pairs));
    setViewportMode('review');
  });
  const createPlan = () => run('plan', async () => {
    if (!goalText.trim()) return;
    const created = await desktop.createGoal({ goal: goalText, tasks: PLAN_TASKS });
    await desktop.approveGoal(created.jobId, created.planHash);
    await desktop.commandGoal(created.jobId, 'start');
    setJob(await desktop.getGoal(created.jobId));
    setState(await desktop.setMode('goal'));
  });
  const runNextTask = () => run('goal-task', async () => {
    if (!job) return;
    setJob(await desktop.runNextGoalTask(job.jobId));
    setState(await desktop.getState());
    await refreshWorkspace();
  });
  const runIsaacSimulation = () => run('isaac', async () => {
    if (!isaacProposal) {
      setIsaacProposal(await desktop.getIsaacExperimentProposal());
      setIsaacApproval(null);
      setDockTab('simulation');
      return;
    }
    if (!isaacApproval) {
      setIsaacApproval(await desktop.approveAction({
        planHash: isaacProposal.planHash,
        toolId: isaacProposal.toolId,
        args: isaacProposal.args,
      }));
      return;
    }
    const experiment = await desktop.runIsaacExperiment(isaacProposal, isaacApproval);
    setIsaacExperiments(await desktop.listIsaacExperiments());
    setIsaacImages(await desktop.getIsaacExperimentImages(experiment.experimentId));
    setTimeline(await desktop.getTimeline());
    setIsaacProposal(null);
    setIsaacApproval(null);
    setIsaacAnalysis(null);
    setIsaacCorrection(null);
    setIsaacCorrectionApproval(null);
    setIsaacNotice(experiment.status === 'PASSED'
      ? 'Rerun passed. The experiment lineage and evidence are retained.'
      : 'A deterministic check failed. Analyze the evidence before proposing any Blender correction.');
    setDockTab('simulation');
  });
  const analyzeIsaacSimulation = () => run('isaac-analyze', async () => {
    const latest = isaacExperiments[0];
    if (!latest) return;
    setIsaacAnalysis(await desktop.analyzeIsaacExperiment(latest.experimentId));
    setIsaacCorrection(null);
    setIsaacCorrectionApproval(null);
    setIsaacNotice(null);
  });
  const advanceIsaacCorrection = () => run('isaac-correct', async () => {
    const latest = isaacExperiments[0];
    if (!latest || !isaacAnalysis) return;
    const apply = async (proposal: IsaacCorrectionProposal, approvalId: string) => {
      const result = await desktop.applyIsaacCorrection(proposal, approvalId);
      setState(result.state);
      setValidation(result.validation);
      setIsaacCorrection(null);
      setIsaacCorrectionApproval(null);
      setIsaacNotice('Correction applied after a recoverable checkpoint. Export the corrected scene, then rerun Isaac Sim to close the loop.');
      await refreshWorkspace();
      setDockTab('export');
    };
    if (!isaacCorrection) {
      const next = await desktop.getIsaacCorrectionProposal(latest.experimentId);
      if (settings.actionMode === 'autonomous') {
        const approvalId = await desktop.approveAction({
          planHash: next.planHash,
          toolId: next.toolId,
          args: next.args,
          authority: 'autonomous',
        });
        await apply(next, approvalId);
        return;
      }
      setIsaacCorrection(next);
      setIsaacCorrectionApproval(null);
      return;
    }
    if (!isaacCorrectionApproval) {
      setIsaacCorrectionApproval(await desktop.approveAction({
        planHash: isaacCorrection.planHash,
        toolId: isaacCorrection.toolId,
        args: isaacCorrection.args,
      }));
      return;
    }
    await apply(isaacCorrection, isaacCorrectionApproval);
  });

  return (
    <main className={`app-frame ${leftOpen ? '' : 'rail-closed'} ${inspectionOpen ? 'inspector-open' : ''}`}>
      <header className="command-bar">
        <div className="brand-block">
          <button className="icon-button mobile-rail-toggle" onClick={() => setLeftOpen((value) => !value)} aria-label="Toggle conversation rail"><SidebarSimple size={19} /></button>
          <span className="brand-mark"><CubeFocus size={24} weight="duotone" /></span>
          <span><strong>SimForge</strong><small>{state.projectName}</small></span>
        </div>
        <div className="connection-strip" aria-label="Connections">
          <button className="connection-button" onClick={() => { setSettingsTab('environment'); setSettingsOpen(true); }}>
            <span className={`connection-dot ${state.bridgeConnected ? 'online' : ''}`} />
            Blender {state.bridgeConnected ? `live · r${state.sceneRevision ?? 0}` : 'waiting'}
            <CaretDown size={13} />
          </button>
          <span className="service-chip"><HardDrives size={14} /> USD local</span>
          <button className={`service-chip service-button ${isaacEnvironment?.runtimeReady ? 'ready' : 'unavailable'}`} onClick={() => setDockTab('simulation')} title={isaacEnvironment?.issues.join(' ') || 'Inspect the local Isaac Sim runtime'}>
            <Atom size={14} /> Isaac {isaacEnvironment?.runtimeReady ? (isaacEnvironment.compatibility === 'SUPPORTED' ? 'ready' : 'limited') : 'unavailable'}
          </button>
        </div>
        <div className="command-actions">
          <button className="icon-button mobile-inspector-toggle" onClick={() => setInspectionOpen((value) => !value)} aria-label="Toggle inspection panel"><CubeFocus size={19} /></button>
          <button className="model-route" onClick={() => { setSettingsTab('providers'); setSettingsOpen(true); }}>
            <Sparkle size={15} weight="fill" />
            <span><small>MODEL ROUTE</small>{routeLabel}</span>
            <CaretDown size={13} />
          </button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><GearSix size={20} /></button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="conversation-rail">
          <button className="new-chat" onClick={createConversation} disabled={Boolean(busy)}><Plus size={17} weight="bold" /> New conversation</button>
          <label className="search-field"><MagnifyingGlass size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history" /></label>
          <div className="rail-section-title"><span>PROJECT CHATS</span><span>{conversations.length}</span></div>
          <nav className="conversation-list" aria-label="Conversation history">
            {conversations.map((conversation) => (
              <div className={`conversation-item ${conversation.id === activeConversationId ? 'active' : ''}`} key={conversation.id}>
                <button className="conversation-main" onClick={() => selectConversation(conversation.id)}>
                  <span>{conversation.title}</span>
                  <small>{conversation.messageCount} messages · {relativeTime(conversation.updatedAt)}</small>
                </button>
                <div className="conversation-tools">
                  <button onClick={() => void branchConversation(conversation.id)} aria-label="Branch conversation"><GitBranch size={14} /></button>
                  <button onClick={() => renameConversation(conversation)} aria-label="Rename conversation"><FilePlus size={14} /></button>
                  <button onClick={() => deleteConversation(conversation)} aria-label="Delete conversation"><Trash size={14} /></button>
                </div>
              </div>
            ))}
          </nav>
          <div className="rail-footer">
            <Database size={16} />
            <span><strong>Local project memory</strong><small>{settings.projectMemory ? 'Enabled · portable' : 'Disabled'}</small></span>
          </div>
        </aside>

        <section className="authoring-column">
          <header className="conversation-header">
            <div><small>AUTHORING CONVERSATION</small><h1>{activeConversation?.title ?? 'Workspace'}</h1></div>
            <div className="journey-strip" aria-label="Authoring progress">
              <span className={messages.length ? 'complete' : 'active'}><small>1</small>Plan</span><i />
              <span className={validation ? 'complete' : messages.length ? 'active' : ''}><small>2</small>Build</span><i />
              <span className={exports.length ? 'complete' : validation ? 'active' : ''}><small>3</small>Export</span><i />
              <span className={isaacExperiments.length ? 'complete' : exports.length ? 'active' : ''}><small>4</small>Simulate</span>
            </div>
            <div className="conversation-header-actions">
              {activeConversation?.branchOf && <span className="branch-badge"><GitBranch size={13} /> branch</span>}
              <button className="icon-button" onClick={() => activeConversation && renameConversation(activeConversation)} aria-label="Rename active conversation"><SlidersHorizontal size={18} /></button>
            </div>
          </header>

          <div className="conversation-canvas">
            {messages.length === 0 && <WelcomePanel connected={state.bridgeConnected} />}
            {messages.map((message, index) => (
              <article className={`message-row ${message.role}`} key={message.id}>
                <div className="message-avatar">{message.role === 'assistant' ? <Sparkle size={16} weight="fill" /> : <UserCircle size={17} weight="duotone" />}</div>
                <div className="message-body">
                  <div className="message-meta"><strong>{message.role === 'assistant' ? 'SimForge' : 'You'}</strong><time>{formatTime(message.createdAt)}</time></div>
                  <p>{message.text || 'Attached project context'}</p>
                  <div className="message-actions">
                    <button onClick={() => void branchConversation(activeConversationId, message.id)}><GitBranch size={13} /> Branch here</button>
                    {message.role === 'user' && <button onClick={() => {
                      const previous = messages[index - 1];
                      void run('edit-branch', async () => {
                        const branch = await desktop.branchConversation(activeConversationId, previous?.id ?? null);
                        setConversations(await desktop.listConversations(search));
                        setActiveConversationId(branch.id);
                        setComposer(message.text);
                      });
                    }}><ArrowCounterClockwise size={13} /> Edit & resend</button>}
                    {message.role === 'assistant' && index > 0 && <button onClick={() => setComposer(messages[index - 1]?.text ?? '')}><ArrowClockwise size={13} /> Retry</button>}
                  </div>
                  {message.role === 'assistant' && messages[index - 1]?.role === 'user' && <ChatActionCard
                    intent={classifyChatIntent(messages[index - 1]!.text)}
                    status={chatActionStatus[message.id] ?? null}
                    busy={busy === `chat-action:${message.id}`}
                    onExecute={() => void executeChatAction(message.id, classifyChatIntent(messages[index - 1]!.text))}
                  />}
                </div>
              </article>
            ))}
            {advancedOpen && state.mode === 'plan' && <PlanCard goal={goalText} setGoal={setGoalText} onCreate={createPlan} busy={busy === 'plan'} />}
            {advancedOpen && state.mode === 'goal' && <GoalCard job={job} onNext={runNextTask} onCommand={(command) => void run(`goal-${command}`, async () => {
              if (!job) return;
              const result = await desktop.commandGoal(job.jobId, command);
              setJob(await desktop.getGoal(result.jobId));
            })} />}
            {advancedOpen && state.mode === 'goal' && <BuildCard proposal={robotProposal} approved={Boolean(robotApproval)} validation={validation} onBuild={buildRobot} onValidate={runValidation} onPreview={generatePreview} busy={busy} />}
            {advancedOpen && state.mode === 'build' && <BuildCard proposal={robotProposal} approved={Boolean(robotApproval)} validation={validation} onBuild={buildRobot} onValidate={runValidation} onPreview={generatePreview} busy={busy} />}
            {advancedOpen && ['build', 'goal'].includes(state.mode) && <ImportCard
              report={importReport}
              proposal={importProposal}
              proposalApproved={Boolean(importApproval)}
              modification={importModification}
              modificationApproved={Boolean(importModificationApproval)}
              busy={busy}
              onStage={stageImport}
              onBuild={buildImportedRobot}
              onModify={modifyImportedRobot}
              onValidate={runValidation}
              onPreview={generatePreview}
            />}
            {advancedOpen && ['build', 'goal'].includes(state.mode) && <NativeImportCard
              reports={nativeImports}
              proposal={nativeProposal}
              proposalApproved={Boolean(nativeApproval)}
              decision={nativeDecision}
              decisionApproved={Boolean(nativeDecisionApproval)}
              busy={busy}
              onChoose={chooseNativeImport}
              onStage={stageNativeImport}
              onDecision={decideNativeImport}
              onPreview={generatePreview}
            />}
            <div ref={conversationEndRef} aria-hidden="true" />
          </div>

          <div className="composer-dock">
            {pendingAttachmentIds.length > 0 && <div className="attachment-strip">
              {attachments.filter((entry) => pendingAttachmentIds.includes(entry.id)).map((entry) => (
                <span key={entry.id}><Paperclip size={12} />{entry.name}<button onClick={() => setPendingAttachmentIds((current) => current.filter((id) => id !== entry.id))}><X size={11} /></button></span>
              ))}
            </div>}
            <div className="composer-row">
              <button className="composer-tool" onClick={attach} disabled={!activeConversationId || Boolean(busy)} aria-label="Attach project files"><Paperclip size={19} /></button>
              <textarea value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); }
              }} placeholder="Describe the robot, scene change, USD export, or simulation you want…" />
              {busy === 'sending'
                ? <button className="send-button stop" onClick={() => void desktop.stopChat(activeConversationId)} aria-label="Stop response"><Stop size={18} weight="fill" /></button>
                : <button className="send-button" onClick={send} disabled={!composer.trim() || Boolean(busy)} aria-label="Send message"><PaperPlaneTilt size={19} weight="fill" /></button>}
            </div>
            <div className="composer-footer">
              <button onClick={() => { setSettingsTab('providers'); setSettingsOpen(true); }}><SlidersHorizontal size={13} /> {settings.actionMode.toUpperCase()} authority</button>
              <button onClick={() => { setSettingsTab('providers'); setSettingsOpen(true); }}><Sparkle size={13} /> {routeLabel}</button>
              <button onClick={() => setAdvancedOpen((value) => !value)}><GearSix size={13} /> {advancedOpen ? 'Hide advanced' : 'Advanced'}</button>
              <button onClick={() => void run('compact', async () => setContext(await desktop.compactConversation(activeConversationId)))}><ArrowsClockwise size={13} /> Context {context?.percentUsed ?? 0}%</button>
              <span>{settings.cloudProcessing ? 'Cloud dispatch disclosed before send' : 'Local-only · cloud disabled'}</span>
            </div>
          </div>
        </section>

        <aside className="inspection-column">
          <section className="viewport-panel">
            <header className="panel-header">
              <div><small>LIVE 3D INSPECTION</small><strong>{preview ? `Scene r${preview.sceneRevision}` : 'No preview yet'}</strong></div>
              <div><button className={`icon-button ${viewportMode === 'review' ? 'active' : ''}`} onClick={() => viewportMode === 'review' ? setViewportMode('live') : reviews[0]?.sceneRevision === state.sceneRevision ? void showReviewComparison() : void renderReview()} disabled={(!validation && reviews.length === 0) || busy === 'review' || busy === 'review-load'} aria-label={reviews[0]?.sceneRevision === state.sceneRevision ? 'Show before and after materialized reviews' : 'Render a materialized review for the current scene revision'}><ImageSquare size={17} /></button><button className="icon-button" onClick={generatePreview} disabled={!state.bridgeConnected || busy === 'preview'} aria-label="Refresh 3D preview"><ArrowsClockwise size={17} /></button><button className="icon-button" onClick={() => void desktop.openSceneInBlender().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not open Blender'))} aria-label="Open scene in Blender"><CubeFocus size={17} /></button></div>
            </header>
            <div className="viewport-stage">
              {viewportMode === 'review' && review
                ? <div className="review-gallery comparison-gallery">{reviews.slice(0, 2).reverse().map((manifest, index) => <figure key={manifest.reviewId}><img src={reviewImages[`${manifest.reviewId}:three-quarter`]} alt={`${manifest.label} materialized review at scene revision ${manifest.sceneRevision}`} /><figcaption>{reviews.length > 1 ? (index === 0 ? 'Before' : 'After') : manifest.label} · r{manifest.sceneRevision}</figcaption></figure>)}</div>
                : previewData && preview
                ? <ThreeViewport dataUrl={previewData} manifest={preview} selectedId={selectedObjectId} onSelect={selectPreviewObject} />
                : <div className="viewport-empty"><CubeFocus size={40} weight="duotone" /><strong>{state.bridgeConnected ? 'Capture the live Blender scene' : 'Waiting for Blender'}</strong><p>{state.bridgeConnected ? 'Orbit, pan, zoom, and inspect exact scene objects.' : 'Start Blender from the SimForge launcher to connect.'}</p><button onClick={generatePreview} disabled={!state.bridgeConnected}>Generate preview</button></div>}
              {previewStale && <div className="stale-banner"><Warning size={15} weight="fill" /> Preview is stale. Refresh before trusting it.</div>}
            </div>
            {preview && <ObjectInspector objects={preview.objects} selectedId={selectedObjectId} onSelect={selectPreviewObject} />}
            <div className="viewport-footer">
              <span><span className={`connection-dot ${state.bridgeConnected ? 'online' : ''}`} /> {state.bridgeConnected ? 'Blender live' : 'Disconnected'}</span>
              <span>{preview ? `${preview.objects.length} objects · ${(preview.bytes / 1024).toFixed(0)} KB` : 'GLB preview is generated on demand'}</span>
            </div>
          </section>

          <section className="dock-panel">
            <nav className="dock-tabs">
              <DockButton id="activity" label="Activity" icon={<ClockCounterClockwise size={15} />} active={dockTab} set={setDockTab} />
              <DockButton id="validation" label="Validate" icon={<ListChecks size={15} />} active={dockTab} set={setDockTab} {...(validation ? { badge: validation.summary.blocker + validation.summary.error } : {})} />
              <DockButton id="simulation" label="Simulate" icon={<Atom size={15} />} active={dockTab} set={setDockTab} {...(isaacExperiments[0]?.status === 'FAILED' ? { badge: 1 } : {})} />
              <DockButton id="export" label="Export" icon={<Export size={15} />} active={dockTab} set={setDockTab} />
              <DockButton id="history" label="History" icon={<GitBranch size={15} />} active={dockTab} set={setDockTab} />
            </nav>
            <div className="dock-content">
              {dockTab === 'activity' && <ActivityDock timeline={timeline} onRefresh={() => void run('refresh', refreshWorkspace)} />}
              {dockTab === 'validation' && <ValidationDock validation={validation} busy={busy} onRun={runValidation} onFix={(findingId) => void run('fix', async () => {
                setValidation(await desktop.applyValidationFix({ findingId, planHash: null, approvalId: null }));
                await refreshWorkspace();
              })} onUndo={() => void run('undo', async () => { setValidation(await desktop.undoLatestValidationFix()); await refreshWorkspace(); })} />}
              {dockTab === 'simulation' && <SimulationDock environment={isaacEnvironment} experiments={isaacExperiments} images={isaacImages} proposal={isaacProposal} approved={Boolean(isaacApproval)} analysis={isaacAnalysis} correction={isaacCorrection} correctionApproved={Boolean(isaacCorrectionApproval)} notice={isaacNotice} actionMode={settings.actionMode} busy={busy} onRun={runIsaacSimulation} onAnalyze={analyzeIsaacSimulation} onCorrect={advanceIsaacCorrection} onOpen={(experimentId) => void run('isaac-open', async () => { await desktop.openIsaacExperiment(experimentId); })} />}
              {dockTab === 'export' && <ExportDock exports={exports} validation={validation} onComplete={async () => { setExports(await desktop.listExports()); setTimeline(await desktop.getTimeline()); }} run={run} />}
              {dockTab === 'history' && <HistoryDock checkpoints={checkpoints} versions={versions} timeline={timeline} run={run} onRefresh={refreshWorkspace} />}
            </div>
          </section>

          <section className="review-strip">
            <div><small>VERIFIED USD DELIVERY</small><strong>{exports[0] ? `${exports[0].kind} package · scene r${exports[0].sceneRevision}` : 'Choose destination, approve, export, reopen'}</strong><span>{exports[0]?.verified ? 'Latest package passed deterministic reopen checks' : 'Validation evidence is required before delivery'}</span></div>
            <button onClick={() => setDockTab('export')}><Export size={16} /> {exports[0] ? 'Export again' : 'Open export'}</button>
          </section>
        </aside>
      </div>

      {error && <div className="error-toast" role="alert"><Warning size={18} weight="fill" /><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><X size={16} /></button></div>}
      {settingsOpen && <SettingsModal settings={settings} setSettings={setSettings} tab={settingsTab} setTab={setSettingsTab} close={() => setSettingsOpen(false)} run={run} />}
    </main>
  );
}

function WelcomePanel({ connected }: { connected: boolean }) {
  return <section className="welcome-panel">
    <span className="welcome-icon"><Robot size={30} weight="duotone" /></span>
    <small>AI-DRIVEN BLENDER ROBOTICS</small>
    <h2>What should we build?</h2>
    <p>Describe the result you want. SimForge proposes each Blender, USD, and Isaac step here, and waits for your approval before it acts.</p>
    <div className="prompt-example">Try: "Prepare for me in Blender a wheeled robot with a gripper hand."</div>
    <span className={`welcome-status ${connected ? 'ready' : ''}`}><span className="connection-dot online" />{connected ? 'Blender is connected and ready' : 'Blender will connect automatically when available'}</span>
  </section>;
}

function ChatActionCard({ intent, status, busy, onExecute }: {
  intent: ChatIntent;
  status: ChatActionStatus | null;
  busy: boolean;
  onExecute: () => void;
}) {
  if (intent.kind === 'general') return null;
  const content = intent.kind === 'build-robot'
    ? { eyebrow: 'PLAN READY', title: 'Wheeled robot + gripper + default workcell', detail: 'Build 12 links, 11 joints, collision geometry, physics metadata, sensors, and generated warehouse assets.', button: 'Approve plan & build', icon: <Robot size={18} weight="duotone" /> }
    : intent.kind === 'export-usd'
      ? { eyebrow: 'EXPORT', title: 'Canonical OpenUSD package', detail: 'Choose a destination, bind approval to the current scene revision, add physics layers, export, and reopen-verify.', button: 'Choose destination & approve', icon: <Export size={18} weight="duotone" /> }
      : intent.kind === 'simulate-isaac'
        ? { eyebrow: 'SIMULATE', title: 'Run the latest verified USD', detail: 'Copy the approved package into an isolated experiment, run deterministic checks, open Isaac Sim, and return evidence.', button: 'Approve & run simulation', icon: <Atom size={18} weight="duotone" /> }
        : { eyebrow: 'BUILD EDIT', title: `Add ${intent.name}`, detail: `${intent.primitive} at [${intent.location.join(', ')}] metres with a checkpoint before mutation.`, button: 'Approve & add to Blender', icon: <CubeFocus size={18} weight="duotone" /> };
  return <section className={`chat-action-card ${status?.state ?? ''}`}>
    <header><span>{content.icon}</span><div><small>{content.eyebrow}</small><strong>{content.title}</strong></div>{status?.state === 'done' && <CheckCircle size={18} weight="fill" />}</header>
    <p>{status?.detail ?? content.detail}</p>
    {status?.state !== 'done' && <button className="primary-action" onClick={onExecute} disabled={busy}>{busy || status?.state === 'working' ? 'Working...' : content.button}</button>}
  </section>;
}

function PlanCard({ goal, setGoal, onCreate, busy }: { goal: string; setGoal: (value: string) => void; onCreate: () => void; busy: boolean }) {
  return <section className="workflow-card"><header><span><ListChecks size={19} weight="duotone" /></span><div><small>PLAN MODE · READ ONLY</small><h3>Prepare a reviewable task plan</h3></div></header><textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Describe the robot, scene, or correction you want to create…" /><ol>{PLAN_TASKS.map((task) => <li key={task.id}><Check size={13} />{task.description}</li>)}</ol><button className="primary-action" onClick={onCreate} disabled={!goal.trim() || busy}>{busy ? 'Preparing…' : 'Create and approve plan'}</button></section>;
}

function GoalCard({ job, onNext, onCommand }: { job: GoalJobView | null; onNext: () => void; onCommand: (command: 'pause' | 'start' | 'cancel' | 'retry' | 'branch') => void }) {
  if (!job) return <section className="workflow-card"><p>No active goal. Switch to Plan to create one.</p></section>;
  return <section className="workflow-card"><header><span><Play size={19} weight="fill" /></span><div><small>GOAL MODE · PERSISTENT</small><h3>{job.status === 'completed' ? 'Goal completed' : 'Approved execution plan'}</h3></div><span className={`job-status ${job.status}`}>{job.status}</span></header><ol className="task-list">{job.tasks.map((task) => <li className={task.status} key={`${task.taskIndex}-${task.id}`}><span>{task.status === 'completed' ? <Check size={13} /> : task.taskIndex + 1}</span><div>{task.description}<small>{task.status}{task.error ? ` · ${task.error}` : ''}</small></div></li>)}</ol><div className="card-actions"><button className="primary-action" onClick={onNext} disabled={!['running', 'approved'].includes(job.status)}><Play size={15} /> Run next task</button>{job.status === 'running' ? <button onClick={() => onCommand('pause')}><Pause size={15} /> Pause</button> : <button onClick={() => onCommand('start')}><Play size={15} /> Resume</button>}<button onClick={() => onCommand('branch')}><GitBranch size={15} /> Branch</button></div></section>;
}

function BuildCard({ proposal, approved, validation, onBuild, onValidate, onPreview, busy }: { proposal: WarehouseProposal | null; approved: boolean; validation: ValidationRun | null; onBuild: () => void; onValidate: () => void; onPreview: () => void; busy: string }) {
  const verified = validation?.channels.includes('deterministic-robotics') && validation.channels.includes('deterministic-environment');
  return <section className="workflow-card"><header><span><Robot size={20} weight="duotone" /></span><div><small>STRUCTURED ASSEMBLY · CHECKPOINTED</small><h3>Warehouse mobile manipulator</h3></div>{verified && <span className="verified-pill"><CheckCircle size={14} weight="fill" /> built</span>}</header><p>{proposal?.summary ?? 'Loading deterministic robot and environment graphs…'}</p><div className="card-actions"><button className="primary-action" onClick={onBuild} disabled={!proposal || busy === 'robot'}>{approved ? <><Robot size={15} /> Build checkpointed scene</> : <><Check size={15} /> Review & approve build</>}</button><button onClick={onValidate}><ListChecks size={15} /> Validate</button><button onClick={onPreview}><CubeFocus size={15} /> Preview</button></div></section>;
}

function ImportCard({ report, proposal, proposalApproved, modification, modificationApproved, busy, onStage, onBuild, onModify, onValidate, onPreview }: {
  report: ImportReport | null;
  proposal: ImportedRobotProposal | null;
  proposalApproved: boolean;
  modification: ImportedRobotModificationProposal | null;
  modificationApproved: boolean;
  busy: string;
  onStage: () => void;
  onBuild: () => void;
  onModify: () => void;
  onValidate: () => void;
  onPreview: () => void;
}) {
  const completed = report?.status === 'MODIFIED';
  const primary = !report
    ? { action: onStage, label: 'Stage verified BSD robot', icon: <FilePlus size={15} />, disabled: busy === 'import-stage' }
    : report.status === 'STAGED'
      ? { action: onBuild, label: proposalApproved ? 'Build checkpointed import' : 'Review & approve import', icon: proposalApproved ? <Robot size={15} /> : <Check size={15} />, disabled: !proposal || busy === 'import-build' }
      : report.status === 'MATERIALIZED'
        ? { action: onModify, label: modificationApproved ? 'Add inspection camera' : 'Review camera modification', icon: modificationApproved ? <CubeFocus size={15} /> : <Check size={15} />, disabled: !modification || busy === 'import-modify' }
        : null;
  return <section className="workflow-card import-card">
    <header><span><FilePlus size={20} weight="duotone" /></span><div><small>LICENSED IMPORT · QUARANTINED</small><h3>Open Robotics R2-D2 tutorial robot</h3></div>{completed && <span className="verified-pill"><CheckCircle size={14} weight="fill" /> modified</span>}</header>
    <p>{modification?.summary ?? proposal?.summary ?? (completed ? report.modification?.summary : 'Hash-verify a pinned BSD-3-Clause URDF and contained mesh sources before Blender receives structured geometry.')}</p>
    {report && <div className="import-facts"><span><strong>{report.robotGraph?.links.length ?? 0}</strong><small>links</small></span><span><strong>{report.robotGraph?.joints.length ?? 0}</strong><small>joints</small></span><span><strong>{report.losses.length}</strong><small>disclosed losses</small></span><span><strong>{report.source.license}</strong><small>license</small></span></div>}
    {report && <p className="import-provenance">Pinned source {report.source.sourceCommit.slice(0, 10)} · SHA-256 {report.source.sourceSha256.slice(0, 12)}… · remote references rejected</p>}
    <div className="card-actions">{primary && <button className="primary-action" onClick={primary.action} disabled={primary.disabled}>{primary.icon}{primary.label}</button>}{report && <button onClick={onValidate}><ListChecks size={15} /> Validate</button>}{report?.materializedSceneRevision !== null && <button onClick={onPreview}><CubeFocus size={15} /> Preview</button>}</div>
  </section>;
}

function NativeImportCard({ reports, proposal, proposalApproved, decision, decisionApproved, busy, onChoose, onStage, onDecision, onPreview }: {
  reports: NativeImportReport[];
  proposal: NativeImportProposal | null;
  proposalApproved: boolean;
  decision: NativeImportDecisionProposal | null;
  decisionApproved: boolean;
  busy: string;
  onChoose: () => void;
  onStage: () => void;
  onDecision: (accept: boolean) => void;
  onPreview: () => void;
}) {
  const latest = reports[0] ?? null;
  const staged = reports.find((entry) => entry.status === 'STAGED') ?? null;
  const decisionLabel = !decision
    ? 'Review acceptance'
    : !decisionApproved
      ? 'Approve exact staged objects'
      : 'Accept into project';
  return <section className="workflow-card native-import-card">
    <header><span><Database size={20} weight="duotone" /></span><div><small>NATIVE FORMAT MATRIX · EXACT APPROVAL</small><h3>Stage a local engineering asset</h3></div>{latest?.status === 'ACCEPTED' && <span className="verified-pill"><CheckCircle size={14} weight="fill" /> accepted</span>}</header>
    <p>{proposal?.summary ?? (staged ? `${staged.objectCount} ${staged.source.format} objects are isolated for inspection. Accept or reject the exact collection.` : 'Supports self-contained Blender, USD, GLB/GLTF, FBX, OBJ, and STL files. Files are copied, hashed, and checked before Blender access.')}</p>
    {latest && <div className="native-import-status"><span>{latest.source.format}</span><strong>{latest.source.name}</strong><small>{latest.status.toLowerCase()} · {latest.objectCount} objects · {latest.source.sha256.slice(0, 12)}…</small></div>}
    <div className="card-actions">
      {!proposal && !staged && <button className="primary-action" onClick={onChoose} disabled={busy === 'native-choose'}><FilePlus size={15} /> Choose local 3D file</button>}
      {proposal && <button className="primary-action" onClick={onStage} disabled={busy === 'native-stage'}>{proposalApproved ? <><Database size={15} /> Stage in Blender</> : <><Check size={15} /> Review & approve staging</>}</button>}
      {staged && <><button className="primary-action" onClick={() => onDecision(true)} disabled={busy === 'native-accept'}><Check size={15} /> {decision?.toolId === 'import.accept_native' ? decisionLabel : 'Review acceptance'}</button><button onClick={() => onDecision(false)} disabled={busy === 'native-reject'}><Trash size={15} /> {decision?.toolId === 'import.reject_native' && decisionApproved ? 'Reject staged objects' : 'Review rejection'}</button><button onClick={onPreview}><CubeFocus size={15} /> Inspect preview</button></>}
      {latest?.status === 'ACCEPTED' && <button onClick={onChoose}><Plus size={15} /> Import another</button>}
    </div>
  </section>;
}

function ThreeViewport({ dataUrl, manifest, selectedId, onSelect }: { dataUrl: string; manifest: ScenePreviewManifest; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071019');
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    camera.position.set(4.2, -5.2, 3.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    scene.add(new THREE.HemisphereLight(0xc9f8ff, 0x14202b, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(5, -3, 7);
    key.castShadow = true;
    scene.add(key);
    const grid = new THREE.GridHelper(12, 24, 0x24515d, 0x142a34);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let root: THREE.Object3D | null = null;
    let selectionHelper: THREE.BoxHelper | null = null;
    let frame = 0;
    new GLTFLoader().load(dataUrl, (gltf) => {
      root = gltf.scene;
      scene.add(root);
      root.traverse((object) => { if ((object as THREE.Mesh).isMesh) { (object as THREE.Mesh).castShadow = true; (object as THREE.Mesh).receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(size.length() * 0.75, 1);
      controls.target.copy(center);
      camera.position.copy(center).add(new THREE.Vector3(radius, -radius * 1.25, radius * 0.8));
      camera.near = Math.max(radius / 1000, 0.01);
      camera.far = radius * 100;
      camera.updateProjectionMatrix();
      controls.update();
    });
    const click = (event: PointerEvent) => {
      if (!root) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(root, true)[0]?.object;
      if (selectionHelper) { scene.remove(selectionHelper); selectionHelper.dispose(); selectionHelper = null; }
      if (!hit) { onSelect(null); return; }
      let candidate: THREE.Object3D | null = hit;
      while (candidate?.parent && candidate.parent !== root && !manifest.objects.some((entry) => entry.name === candidate?.name)) candidate = candidate.parent;
      const record = manifest.objects.find((entry) => entry.name === candidate?.name || entry.name === hit.name);
      onSelect(record?.id ?? null);
      selectionHelper = new THREE.BoxHelper(candidate ?? hit, 0x68ead0);
      scene.add(selectionHelper);
    };
    renderer.domElement.addEventListener('pointerdown', click);
    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const animate = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', click);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach((material) => material.dispose());
      });
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
  }, [dataUrl, manifest, onSelect]);

  useEffect(() => {
    if (!selectedId) return;
    // Selection from the hierarchy remains visible in the inspector even when the GLB has flattened names.
  }, [selectedId]);
  return <div className="three-viewport" ref={host} aria-label="Interactive exact-revision 3D scene preview" />;
}

function ObjectInspector({ objects, selectedId, onSelect }: { objects: SceneObject[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const selected = objects.find((entry) => entry.id === selectedId) ?? null;
  return <div className="object-inspector"><div className="hierarchy-list">{objects.slice(0, 14).map((object) => <button key={object.id} className={object.id === selectedId ? 'active' : ''} style={{ paddingLeft: `${8 + depthOf(object, objects) * 12}px` }} onClick={() => onSelect(object.id)}><CubeFocus size={12} />{object.name}</button>)}</div>{selected && <div className="object-details"><strong>{selected.name}</strong><span>{selected.type} · {selected.materialNames.join(', ') || 'No material'}</span><span>{selected.dimensions.map((value) => value.toFixed(2)).join(' × ')} m</span></div>}</div>;
}

function DockButton({ id, label, icon, active, set, badge }: { id: DockTab; label: string; icon: React.ReactNode; active: DockTab; set: (id: DockTab) => void; badge?: number }) {
  return <button className={active === id ? 'active' : ''} onClick={() => set(id)}>{icon}<span>{label}</span>{badge ? <b>{badge}</b> : null}</button>;
}

function ActivityDock({ timeline, onRefresh }: { timeline: TimelineEventView[]; onRefresh: () => void }) {
  return <><div className="dock-heading"><div><small>AUDITABLE ACTIVITY</small><strong>What changed, and why</strong></div><button className="icon-button" onClick={onRefresh} aria-label="Refresh activity"><ArrowsClockwise size={15} /></button></div><div className="timeline-list">{timeline.filter((entry) => entry.kind === 'activity').slice(0, 20).map((entry) => <div className="timeline-item" key={entry.id}><span className="timeline-dot" /><div><strong>{entry.title}</strong><small>{entry.detail}{entry.sceneRevision !== null ? ` · r${entry.sceneRevision}` : ''}</small></div><time>{formatTime(entry.createdAt)}</time></div>)}</div></>;
}

function ValidationDock({ validation, busy, onRun, onFix, onUndo }: { validation: ValidationRun | null; busy: string; onRun: () => void; onFix: (id: string) => void; onUndo: () => void }) {
  return <><div className="dock-heading"><div><small>DETERMINISTIC VALIDATION</small><strong>{validation ? `Scene r${validation.sceneRevision}` : 'Not run yet'}</strong></div><button onClick={onRun} disabled={busy === 'validation'}><ListChecks size={15} /> Run</button></div>{validation && <div className="severity-grid"><span><b>{validation.summary.blocker}</b> blocker</span><span><b>{validation.summary.error}</b> errors</span><span><b>{validation.summary.warning}</b> warnings</span><span><b>{validation.summary.info}</b> info</span></div>}<div className="finding-list">{validation?.findings.slice(0, 18).map((finding) => <article className={`finding ${finding.severity}`} key={finding.id}><div><span>{finding.ruleId}</span><b>{finding.severity}</b></div><p>{finding.message}</p><small>{finding.entityPath}</small>{finding.proposedFix && <button onClick={() => onFix(finding.id)} disabled={finding.proposedFix.approvalRequired}>Apply {finding.proposedFix.label}</button>}</article>) ?? <div className="dock-empty"><ListChecks size={26} /><p>Run checks to inspect geometry, robotics, physics, and metadata.</p></div>}</div><button className="text-action" onClick={onUndo}><ArrowCounterClockwise size={14} /> Undo latest safe fix</button></>;
}

function SimulationDock({ environment, experiments, images, proposal, approved, analysis, correction, correctionApproved, notice, actionMode, busy, onRun, onAnalyze, onCorrect, onOpen }: {
  environment: IsaacEnvironmentStatus | null;
  experiments: IsaacExperiment[];
  images: string[];
  proposal: IsaacExperimentProposal | null;
  approved: boolean;
  analysis: IsaacExperimentAnalysis | null;
  correction: IsaacCorrectionProposal | null;
  correctionApproved: boolean;
  notice: string | null;
  actionMode: WorkspaceSettings['actionMode'];
  busy: string;
  onRun: () => void;
  onAnalyze: () => void;
  onCorrect: () => void;
  onOpen: (experimentId: string) => void;
}) {
  const latest = experiments[0] ?? null;
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setFrameIndex(0);
    setPlaying(false);
  }, [latest?.experimentId, images.length]);
  useEffect(() => {
    if (!playing || images.length < 2) return;
    const timer = window.setInterval(() => setFrameIndex((current) => (current + 1) % images.length), 650);
    return () => window.clearInterval(timer);
  }, [images.length, playing]);
  const metric = (name: string): string => {
    const value = latest?.metrics[name];
    return typeof value === 'number' ? `${value.toFixed(3)} m` : '—';
  };
  const actionLabel = !proposal ? 'Review local simulation' : !approved ? 'Approve exact run' : 'Run in Isaac Sim';
  const nextRecommendation = !latest
    ? 'Next: create and reopen a verified canonical USD export.'
    : latest.status === 'PASSED'
      ? 'Next: inspect retained evidence or open the exact experiment in native Isaac Sim.'
      : !analysis
        ? 'Next: ask the selected model to review the deterministic failure evidence.'
        : analysis.status !== 'CORRECTION_PROPOSED'
          ? 'Next: review the finding manually; SimForge will not invent a correction.'
          : !correction
            ? actionMode === 'autonomous' ? 'Next: continue the approved loop with a bounded checkpointed correction.' : 'Next: review the exact checkpointed Blender correction.'
            : !correctionApproved ? 'Next: validate the exact correction scope.' : 'Next: apply in Blender, re-export, and rerun.';
  return <>
    <div className="dock-heading simulation-heading">
      <div><small>NVIDIA ISAAC SIM · {actionMode.toUpperCase()} AUTHORITY</small><strong>{latest ? `${latest.status.toLowerCase()} · scene r${latest.sourceExport.sceneRevision}` : 'Canonical USD feedback loop'}</strong></div>
      <span className={`runtime-pill ${environment?.runtimeReady ? environment.compatibility.toLowerCase() : 'unavailable'}`}>{environment?.runtimeReady ? (environment.compatibility === 'SUPPORTED' ? 'ready' : 'limited') : 'unavailable'}</span>
    </div>
    <div className="simulation-guidance"><Sparkle size={14} weight="duotone" /><span><small>RECOMMENDED PLAN</small><strong>{nextRecommendation}</strong></span></div>
    {images.length > 0 && latest
      ? <figure className="simulation-media"><img src={images[Math.min(frameIndex, images.length - 1)]} alt={`Isaac Sim deterministic frame ${frameIndex + 1} for scene revision ${latest.sourceExport.sceneRevision}`} /><figcaption><button onClick={() => setPlaying((current) => !current)} disabled={images.length < 2}>{playing ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />} {playing ? 'Pause' : 'Play evidence'}</button><input type="range" min="0" max={Math.max(images.length - 1, 0)} value={frameIndex} onChange={(event) => { setPlaying(false); setFrameIndex(Number(event.target.value)); }} aria-label="Simulation evidence frame" /><span>step {images.length > 1 ? Math.round(frameIndex * latest.task.steps / (images.length - 1)) : latest.task.steps} / {latest.task.steps}</span></figcaption></figure>
      : <div className="simulation-empty"><Atom size={30} weight="duotone" /><strong>No project experiment yet</strong><p>Export a verified canonical USD package, then run the fixed local physics task.</p></div>}
    {latest && <>
      <div className="simulation-metrics">
        <span><b>{metric('verticalDropM')}</b><small>vertical drop</small></span>
        <span><b>{metric('settledHeightErrorM')}</b><small>settle error</small></span>
        <span><b>{metric('lateralDriftM')}</b><small>lateral drift</small></span>
      </div>
      <div className="simulation-checks">{latest.checks.map((check) => <div key={check.id}><span className={`check-dot ${check.status.toLowerCase()}`}>{check.status === 'PASS' ? <Check size={11} /> : <Warning size={11} />}</span><span><strong>{check.id}</strong><small>{check.status.toLowerCase()} · deterministic evidence retained</small></span></div>)}</div>
    </>}
    {analysis && latest?.experimentId === analysis.experimentId && <div className={`simulation-analysis ${analysis.status.toLowerCase()}`}>
      <span><Sparkle size={15} weight="duotone" /></span>
      <div><strong>{analysis.status === 'CORRECTION_PROPOSED' ? 'Bounded correction available' : analysis.status === 'NO_ACTION' ? 'No correction required' : 'Manual review required'}</strong><p>{analysis.deterministicSummary}</p>{analysis.model && <><p className="advisory-copy">{analysis.model.narrative}</p><small>{analysis.model.providerId}/{analysis.model.modelId} · advisory narrative only</small></>}</div>
    </div>}
    {correction && <div className="simulation-correction">
      <div><strong>Checkpointed Blender correction</strong><span>{correctionApproved ? 'approved' : 'review'}</span></div>
      <p>{correction.summary}</p>
      <small>Source experiment {correction.sourceExperimentId.slice(0, 8)} · exact scene r{correction.sceneRevision} · reversible structural action</small>
    </div>}
    {notice && <div className="simulation-notice"><CheckCircle size={15} weight="fill" /><span>{notice}</span></div>}
    {proposal && <div className="simulation-proposal"><strong>Exact task</strong><p>{proposal.summary}</p><small>Local process · no cloud dispatch · privileged runtime · source locked to scene r{proposal.sceneRevision}</small></div>}
    {environment?.issues.map((issue) => <p className="runtime-warning" key={issue}><Warning size={13} />{issue}</p>)}
    <div className="simulation-actions"><button className="primary-action" onClick={onRun} disabled={!environment?.runtimeReady || busy === 'isaac'}>{busy === 'isaac' ? <><ArrowsClockwise size={15} className="spin" /> Running local simulation…</> : <><Atom size={15} /> {actionLabel}</>}</button>{latest && <button onClick={() => onOpen(latest.experimentId)} disabled={busy === 'isaac-open'}><CubeFocus size={14} /> Open native view</button>}{proposal && <span>Step {approved ? '3' : '2'} of 3</span>}</div>
    {latest?.status === 'FAILED' && <div className="simulation-feedback-actions">
      <button onClick={onAnalyze} disabled={busy === 'isaac-analyze' || busy === 'isaac-correct'}>{busy === 'isaac-analyze' ? <ArrowsClockwise size={14} className="spin" /> : <Sparkle size={14} />} {analysis ? 'Re-analyze evidence' : 'Analyze evidence'}</button>
      {analysis?.status === 'CORRECTION_PROPOSED' && <button className="primary-action" onClick={onCorrect} disabled={busy === 'isaac-correct'}>{busy === 'isaac-correct' ? <ArrowsClockwise size={14} className="spin" /> : <ArrowClockwise size={14} />} {!correction ? (actionMode === 'autonomous' ? 'Continue approved loop' : 'Review Blender correction') : !correctionApproved ? 'Approve checkpointed fix' : 'Apply in Blender'}</button>}
      {correction && <small>Correction step {correctionApproved ? '3' : '2'} of 3</small>}
    </div>}
    {experiments.length > 1 && <div className="experiment-history"><small>RECENT EXPERIMENTS</small>{experiments.slice(1, 4).map((entry) => <div key={entry.experimentId}><span className={`check-dot ${entry.status.toLowerCase()}`}>{entry.status === 'PASSED' ? <Check size={11} /> : <Warning size={11} />}</span><span>r{entry.sourceExport.sceneRevision} · {formatTime(entry.completedAt)}</span></div>)}</div>}
  </>;
}

function ExportDock({ exports, validation, onComplete, run }: { exports: ExportResult[]; validation: ValidationRun | null; onComplete: () => Promise<void>; run: (name: string, action: () => Promise<void>) => Promise<void> }) {
  const [kind, setKind] = useState<ExportKind>('canonical');
  const [destination, setDestination] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [proposal, setProposal] = useState<ExportProposal | null>(null);
  const [approval, setApproval] = useState<string | null>(null);
  const choose = () => run('export-path', async () => { const selected = await desktop.chooseExportDestination(kind); if (selected) { setDestination(selected); setProposal(null); setApproval(null); } });
  const prepare = () => run('export-proposal', async () => { const next = await desktop.proposeExport(kind, destination, overwrite); setProposal(next); setApproval(null); });
  const approve = () => run('export-approval', async () => {
    if (!proposal) return;
    setApproval(await desktop.approveAction({ planHash: proposal.planHash, toolId: proposal.toolId, args: proposal.args }));
  });
  const execute = () => run('export', async () => { if (!proposal || !approval) return; await desktop.executeExport(proposal, approval); setProposal(null); setApproval(null); await onComplete(); });
  return <><div className="dock-heading"><div><small>VERIFIED OPENUSD</small><strong>Export scene package</strong></div>{validation && <span className={validation.summary.blocker + validation.summary.error === 0 ? 'verified-pill' : 'warning-pill'}>{validation.summary.blocker + validation.summary.error === 0 ? 'ready' : 'blocked'}</span>}</div><div className="segmented"><button className={kind === 'quick' ? 'active' : ''} onClick={() => setKind('quick')}>Quick USD</button><button className={kind === 'canonical' ? 'active' : ''} onClick={() => setKind('canonical')}>Canonical package</button></div><label className="path-field"><span>Destination</span><button onClick={choose}>{destination ? shortenPath(destination) : 'Choose…'}</button></label><label className="toggle-row"><input type="checkbox" checked={overwrite} onChange={(event) => { setOverwrite(event.target.checked); setProposal(null); }} /><span>Allow replacing the exact destination</span></label><div className="export-steps"><button className={proposal ? 'done' : ''} onClick={prepare} disabled={!destination}><span>{proposal ? <Check size={13} /> : '1'}</span>Review exact export</button><button className={approval ? 'done' : ''} onClick={approve} disabled={!proposal}><span>{approval ? <Check size={13} /> : '2'}</span>Approve destination</button><button onClick={execute} disabled={!proposal || !approval}><span>3</span>Export and reopen</button></div><div className="recent-exports">{exports.slice(0, 3).map((entry) => <div key={entry.exportId}><CheckCircle size={15} weight="fill" /><span><strong>{entry.kind} · scene r{entry.sceneRevision}</strong><small>{shortenPath(entry.destination)}</small></span></div>)}</div></>;
}

function HistoryDock({ checkpoints, versions, timeline, run, onRefresh }: { checkpoints: CheckpointView[]; versions: VersionView[]; timeline: TimelineEventView[]; run: (name: string, action: () => Promise<void>) => Promise<void>; onRefresh: () => Promise<void> }) {
  const createVersion = (checkpoint: CheckpointView) => {
    const name = window.prompt('Name this version', checkpoint.label);
    if (!name) return;
    void run('version', async () => { await desktop.createVersion(name, checkpoint.id); await onRefresh(); });
  };
  const restore = (checkpoint: CheckpointView) => {
    if (!window.confirm(`Restore checkpoint “${checkpoint.label}”? Current project state will be replaced after approval.`)) return;
    void run('restore', async () => {
      const planHash = `restore:${checkpoint.id}`;
      const approvalId = await desktop.approveCheckpointRestore(checkpoint.id, planHash);
      await desktop.restoreCheckpoint(checkpoint.id, planHash, approvalId);
      await onRefresh();
    });
  };
  const branchVersion = (version: VersionView) => {
    const name = window.prompt('Name this branch', `${version.name} branch`);
    if (!name) return;
    void run('version-branch', async () => {
      await desktop.createVersion(name, version.checkpointId, version.id);
      await onRefresh();
    });
  };
  return <><div className="dock-heading"><div><small>VERSIONS & BRANCHES</small><strong>Recoverable project history</strong></div></div><div className="history-section"><h4>Named versions</h4>{versions.slice(0, 6).map((version) => <div className="history-row" key={version.id}><GitBranch size={15} /><span><strong>{version.name}</strong><small>r{version.sceneRevision}{version.branchOf ? ' · branch' : ''}</small></span><button onClick={() => branchVersion(version)}>Branch</button></div>)}{versions.length === 0 && <p className="muted-copy">Create a named version from any checkpoint below.</p>}</div><div className="history-section"><h4>Checkpoints</h4>{checkpoints.slice(0, 8).map((checkpoint) => <div className="history-row" key={checkpoint.id}><ClockCounterClockwise size={15} /><span><strong>{checkpoint.label}</strong><small>scene r{checkpoint.sceneRevision} · {relativeTime(checkpoint.createdAt)}</small></span><button onClick={() => createVersion(checkpoint)}>Name</button><button onClick={() => restore(checkpoint)}>Restore</button></div>)}</div><div className="history-section"><h4>Recent evidence</h4>{timeline.filter((entry) => entry.kind !== 'activity').slice(0, 6).map((entry) => <div className="history-row" key={`${entry.kind}-${entry.id}`}><CheckCircle size={14} /><span><strong>{entry.title}</strong><small>{entry.kind} · {relativeTime(entry.createdAt)}</small></span></div>)}</div></>;
}

function SettingsModal({ settings, setSettings, tab, setTab, close, run }: { settings: WorkspaceSettings; setSettings: (settings: WorkspaceSettings) => void; tab: SettingsTab; setTab: (tab: SettingsTab) => void; close: () => void; run: (name: string, action: () => Promise<void>) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [providerId, setProviderId] = useState<CloudProviderId>('nvidia');
  const [credential, setCredential] = useState('');
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [doctor, setDoctor] = useState<DoctorCheck[]>([]);
  const [memoryScope, setMemoryScope] = useState<'project' | 'global'>('project');
  const [memories, setMemories] = useState<MemoryView[]>([]);
  const [usage, setUsage] = useState<UsageSummaryView | null>(null);
  useEffect(() => { void desktop.providerStatus(providerId).then(setStatus); }, [providerId]);
  useEffect(() => { if (tab === 'environment') void desktop.runEnvironmentDoctor().then(setDoctor); }, [tab]);
  useEffect(() => {
    if (tab !== 'privacy') return;
    void Promise.all([desktop.listMemories(memoryScope), desktop.getUsageSummary()]).then(([nextMemories, nextUsage]) => {
      setMemories(nextMemories);
      setUsage(nextUsage);
    });
  }, [tab, memoryScope]);
  const save = () => run('settings-save', async () => {
    const normalizedFallback = [...new Set([...draft.fallbackOrder, 'nvidia', 'openai', 'local'])]
      .slice(0, 3) as WorkspaceSettings['fallbackOrder'];
    const normalizedDraft = { ...draft, fallbackOrder: normalizedFallback };
    if (normalizedDraft.routingMode === 'manual' && normalizedDraft.activeProvider !== 'local') {
      await desktop.probeProvider(normalizedDraft.activeProvider, normalizedDraft.activeModel);
    }
    const next = await desktop.updateWorkspaceSettings(normalizedDraft);
    setSettings(next);
    close();
  });
  const discover = () => run('discover', async () => {
    const discovered = await desktop.discoverProviderModels(providerId);
    const sorted = [...discovered].sort((left, right) => modelRank(right, providerId) - modelRank(left, providerId));
    const recommended = sorted[0];
    if (!recommended) { setModels([]); return; }
    const probed = await desktop.probeProvider(providerId, recommended.modelId);
    setModels([probed.model, ...sorted.filter((model) => model.modelId !== recommended.modelId)]);
    setDraft((current) => ({ ...current, activeProvider: providerId, activeModel: probed.model.modelId }));
  });
  const addMemory = () => {
    const title = window.prompt(`New ${memoryScope} memory title`);
    if (!title) return;
    const content = window.prompt('Memory content');
    if (!content) return;
    void run('memory-add', async () => {
      await desktop.saveMemory(memoryScope, title, content);
      setMemories(await desktop.listMemories(memoryScope));
    });
  };
  const editMemory = (memory: MemoryView) => {
    if (memory.source !== 'user') return;
    const title = window.prompt('Memory title', memory.title);
    if (!title) return;
    const content = window.prompt('Memory content', memory.content);
    if (!content) return;
    void run('memory-edit', async () => {
      await desktop.saveMemory(memoryScope, title, content, memory.id);
      setMemories(await desktop.listMemories(memoryScope));
    });
  };
  const deleteMemory = (memory: MemoryView) => {
    if (!window.confirm(`Delete memory “${memory.title}”?`)) return;
    void run('memory-delete', async () => setMemories(await desktop.deleteMemory(memoryScope, memory.id)));
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-label="SimForge settings"><header><div><small>SIMFORGE SETTINGS</small><h2>Connections, models, and privacy</h2></div><button className="icon-button" onClick={close} aria-label="Close settings"><X size={19} /></button></header><nav><button className={tab === 'providers' ? 'active' : ''} onClick={() => setTab('providers')}><Sparkle size={16} />AI providers</button><button className={tab === 'privacy' ? 'active' : ''} onClick={() => setTab('privacy')}><SlidersHorizontal size={16} />Privacy & memory</button><button className={tab === 'environment' ? 'active' : ''} onClick={() => setTab('environment')}><HardDrives size={16} />Environment</button></nav><div className="settings-body">
    {tab === 'providers' && <ActionAuthoritySettings draft={draft} setDraft={setDraft} />}
    {tab === 'providers' && <><div className="settings-section"><h3>Routing</h3><div className="form-grid"><label>Routing mode<select value={draft.routingMode} onChange={(event) => setDraft({ ...draft, routingMode: event.target.value as WorkspaceSettings['routingMode'] })}><option value="automatic">Automatic · capability matched</option><option value="manual">Manual selection</option></select></label><label>Active provider<select value={draft.activeProvider} onChange={(event) => setDraft({ ...draft, activeProvider: event.target.value as WorkspaceSettings['activeProvider'], activeModel: event.target.value === 'local' ? 'mock-planner' : draft.activeModel })}><option value="local">Local fixture</option><option value="nvidia">NVIDIA NIM</option><option value="openai">OpenAI</option></select></label><label className="wide">Active model<select value={draft.activeModel} onChange={(event) => setDraft({ ...draft, activeModel: event.target.value })}><option value="mock-planner">Local deterministic fixture</option>{draft.activeModel !== 'mock-planner' && !models.some((model) => model.modelId === draft.activeModel) && <option value={draft.activeModel}>{draft.activeModel} · saved route</option>}{models.map((model) => <option key={`${model.providerId}-${model.modelId}`} value={model.modelId}>{model.displayName} · {capabilities(model)}</option>)}</select></label></div><div className="provider-enable-row"><Toggle label="Enable NVIDIA" detail="Allow NVIDIA to participate in automatic or manual routing." checked={draft.enabledProviders.nvidia} set={(checked) => setDraft({ ...draft, enabledProviders: { ...draft.enabledProviders, nvidia: checked } })} /><Toggle label="Enable OpenAI" detail="Optional secondary provider; NVIDIA remains the preferred cloud route." checked={draft.enabledProviders.openai} set={(checked) => setDraft({ ...draft, enabledProviders: { ...draft.enabledProviders, openai: checked } })} /></div></div><div className="settings-section"><div className="section-heading"><div><h3>Provider credentials</h3><p>Stored with Windows protection; credentials never enter the renderer after save.</p></div><select value={providerId} onChange={(event) => setProviderId(event.target.value as CloudProviderId)}><option value="nvidia">NVIDIA</option><option value="openai">OpenAI</option></select></div><div className="credential-row"><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder={`${providerId} API key`} /><button onClick={() => void run('credential', async () => { setStatus(await desktop.configureProvider(providerId, credential)); setCredential(''); })}>Save securely</button><button onClick={() => void run('remove-credential', async () => setStatus(await desktop.removeProvider(providerId)))}>Remove</button></div><div className="provider-status"><span className={`connection-dot ${status?.configured ? 'online' : ''}`} />{status?.configured ? 'Credential configured' : 'Not configured'} · {status?.discoveredModels ?? 0} discovered models<button onClick={discover} disabled={!status?.configured}>Discover models</button></div></div><div className="settings-section"><h3>Budget and fallback</h3><div className="form-grid"><label>Monthly limit (USD)<input type="number" min="0" placeholder="No limit" value={draft.monthlyBudgetUsd ?? ''} onChange={(event) => setDraft({ ...draft, monthlyBudgetUsd: event.target.value ? Number(event.target.value) : null })} /></label><label>First fallback<select value={draft.fallbackOrder[0]} onChange={(event) => setDraft({ ...draft, fallbackOrder: [event.target.value as WorkspaceSettings['fallbackOrder'][number], ...draft.fallbackOrder.slice(1)] })}><option value="nvidia">NVIDIA</option><option value="openai">OpenAI</option><option value="local">Local</option></select></label><label>Second fallback<select value={draft.fallbackOrder[1]} onChange={(event) => setDraft({ ...draft, fallbackOrder: [draft.fallbackOrder[0] ?? 'nvidia', event.target.value as WorkspaceSettings['fallbackOrder'][number], draft.fallbackOrder[2] ?? 'local'] })}><option value="nvidia">NVIDIA</option><option value="openai">OpenAI</option><option value="local">Local</option></select></label><label>Final fallback<select value={draft.fallbackOrder[2]} onChange={(event) => setDraft({ ...draft, fallbackOrder: [draft.fallbackOrder[0] ?? 'nvidia', draft.fallbackOrder[1] ?? 'openai', event.target.value as WorkspaceSettings['fallbackOrder'][number]] })}><option value="nvidia">NVIDIA</option><option value="openai">OpenAI</option><option value="local">Local</option></select></label></div></div></>}
    {tab === 'privacy' && <><div className="settings-section privacy-list"><h3>Explicit data controls</h3><p>Cloud dispatch identifies the provider, model, data classes, purpose, and attached files before sending.</p><Toggle label="Allow cloud processing" detail="Required before NVIDIA or OpenAI can receive conversation text." checked={draft.cloudProcessing} set={(checked) => setDraft({ ...draft, cloudProcessing: checked })} /><Toggle label="Allow visual uploads" detail="Images remain local unless this is enabled and a vision route is selected." checked={draft.visualUploads} set={(checked) => setDraft({ ...draft, visualUploads: checked })} /><Toggle label="Allow file uploads" detail="Project files stay local by default." checked={draft.fileUploads} set={(checked) => setDraft({ ...draft, fileUploads: checked })} /><Toggle label="Project memory" detail="Portable summaries are stored in this project." checked={draft.projectMemory} set={(checked) => setDraft({ ...draft, projectMemory: checked })} /><Toggle label="Global memory" detail="Disabled by default; applies across projects on this machine." checked={draft.globalMemory} set={(checked) => setDraft({ ...draft, globalMemory: checked })} /><Toggle label="Diagnostic logging" detail="Sanitized technical events only; secrets are redacted." checked={draft.diagnosticLogging} set={(checked) => setDraft({ ...draft, diagnosticLogging: checked })} /></div><MemoryPanel scope={memoryScope} setScope={setMemoryScope} memories={memories} usage={usage} add={addMemory} edit={editMemory} remove={deleteMemory} exportScope={() => void run('memory-export', async () => { await desktop.exportMemories(memoryScope); })} /></>}
    {tab === 'environment' && <div className="settings-section"><div className="section-heading"><div><h3>Environment Doctor</h3><p>Local dependencies are checked without exposing credentials.</p></div><button onClick={() => void run('doctor', async () => setDoctor(await desktop.runEnvironmentDoctor()))}><ArrowsClockwise size={15} /> Recheck</button></div><div className="doctor-list">{doctor.map((check) => <div key={check.id}><span className={`doctor-icon ${check.severity}`}>{check.severity === 'pass' ? <Check size={13} /> : <Warning size={13} />}</span><span><strong>{doctorLabel(check.id)}</strong><small>{check.summary}{check.path ? ` · ${check.path}` : ''}</small></span></div>)}</div></div>}
  </div><footer><button onClick={close}>Cancel</button><button className="primary-action" onClick={save}>Save settings</button></footer></section></div>;
}

function ActionAuthoritySettings({ draft, setDraft }: { draft: WorkspaceSettings; setDraft: (settings: WorkspaceSettings) => void }) {
  const descriptions: Record<WorkspaceSettings['actionMode'], string> = {
    guided: 'Validate every scene mutation',
    balanced: 'Auto-run only safe reversible fixes',
    autonomous: 'Continue inside approved boundaries',
  };
  return <div className="settings-section"><h3>Action authority</h3><p>SimForge always suggests and plans. This setting controls when an approved plan may continue without another confirmation.</p><div className="authority-options">{(['guided', 'balanced', 'autonomous'] as const).map((value) => <button key={value} className={draft.actionMode === value ? 'active' : ''} onClick={() => setDraft({ ...draft, actionMode: value })}><strong>{value}</strong><small>{descriptions[value]}</small></button>)}</div><p className="authority-hard-gates"><Warning size={13} /> Export/overwrite, destructive, privacy-sensitive, and privileged fallback gates always require you.</p></div>;
}

function doctorLabel(id: DoctorCheck['id']): string {
  const labels: Record<DoctorCheck['id'], string> = {
    blender: 'Blender 4.5 LTS',
    'blender-extension': 'Blender extension',
    bridge: 'Authenticated Blender bridge',
    python: 'Developer Python 3.13',
    usd: 'Bundled OpenUSD sidecar',
    storage: 'Local storage permissions',
    loopback: 'Private loopback port',
    'gpu-driver': 'NVIDIA GPU driver',
    nvidia: 'NVIDIA NIM provider',
    openai: 'Optional OpenAI provider',
    isaac: 'Optional NVIDIA Isaac Sim',
  };
  return labels[id];
}

function Toggle({ label, detail, checked, set }: { label: string; detail: string; checked: boolean; set: (checked: boolean) => void }) {
  return <label className="privacy-toggle"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} /><i /></label>;
}

function MemoryPanel({ scope, setScope, memories, usage, add, edit, remove, exportScope }: { scope: 'project' | 'global'; setScope: (scope: 'project' | 'global') => void; memories: MemoryView[]; usage: UsageSummaryView | null; add: () => void; edit: (memory: MemoryView) => void; remove: (memory: MemoryView) => void; exportScope: () => void }) {
  const deleteProject = async () => {
    const state = await desktop.getState();
    const confirmation = window.prompt(`Type “${state.projectName}” to move this project to the Recycle Bin.`);
    if (!confirmation) return;
    await desktop.deleteCurrentProject(confirmation);
  };
  const reportFailure = (error: unknown) => window.alert(error instanceof Error ? error.message : 'Data operation failed');
  return <><div className="settings-section memory-manager"><div className="section-heading"><div><h3>Inspectable memory</h3><p>Edit, export, disable above, or delete each memory explicitly.</p></div><div className="memory-actions"><button onClick={add}><Plus size={14} /> Add</button><button onClick={exportScope}><Export size={14} /> Export</button></div></div><div className="segmented"><button className={scope === 'project' ? 'active' : ''} onClick={() => setScope('project')}>Project memory</button><button className={scope === 'global' ? 'active' : ''} onClick={() => setScope('global')}>Global memory</button></div><div className="memory-list">{memories.map((memory) => <div className="memory-row" key={memory.id}><span><strong>{memory.title}</strong><small>{memory.content}</small><em>{memory.source} · {relativeTime(memory.updatedAt)}</em></span>{memory.source === 'user' && <button onClick={() => edit(memory)} aria-label={`Edit ${memory.title}`}><FilePlus size={14} /></button>}<button onClick={() => remove(memory)} aria-label={`Delete ${memory.title}`}><Trash size={14} /></button></div>)}{memories.length === 0 && <p className="muted-copy">No {scope} memories are stored.</p>}</div><div className="usage-summary"><span><strong>{usage?.requestCount ?? 0}</strong><small>provider requests</small></span><span><strong>{(usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)}</strong><small>observed tokens</small></span><span><strong>${(usage?.knownCostUsd ?? 0).toFixed(2)}</strong><small>{usage?.unpricedRequests ? `${usage.unpricedRequests} unpriced` : 'known usage'}</small></span></div></div><div className="settings-section data-manager"><h3>Project data</h3><p>Exports exclude provider credentials and global memory. Diagnostics exclude conversation and memory content and are structurally redacted.</p><div><button onClick={() => void desktop.exportProjectData().catch(reportFailure)}><Export size={14} /> Export project copy</button><button onClick={() => void desktop.exportDiagnostics().catch(reportFailure)}><HardDrives size={14} /> Export diagnostics</button><button className="danger-action" onClick={() => void deleteProject().catch(reportFailure)}><Trash size={14} /> Delete current project</button></div></div></>;
}

function depthOf(object: SceneObject, objects: SceneObject[]): number {
  let depth = 0;
  let current = object;
  while (current.parentId && depth < 4) {
    const parent = objects.find((entry) => entry.id === current.parentId);
    if (!parent) break;
    current = parent;
    depth += 1;
  }
  return depth;
}

function formatTime(value: string): string { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function relativeTime(value: string): string { const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000)); return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`; }
function shortenPath(value: string): string { return value.length > 36 ? `…${value.slice(-35)}` : value; }
function capabilities(model: ModelDescriptor): string { return [model.capabilities.text === true ? 'text' : null, model.capabilities.vision === true ? 'vision' : null, model.capabilities.tools === true ? 'tools' : null].filter(Boolean).join(' + ') || 'unprobed'; }
function modelRank(model: ModelDescriptor, provider: CloudProviderId): number { const id = model.modelId.toLowerCase(); return (provider === 'nvidia' && id.includes('nemotron-3-ultra') ? 100 : 0) + (provider === 'openai' && id.includes('gpt-5') ? 90 : 0) + (model.capabilities.tools === true ? 20 : 0) + (model.capabilities.vision === true ? 10 : 0); }

function createDemoApi(): SimForgeDesktopApi {
  const now = new Date().toISOString();
  let mode: Mode = 'normal';
  let demoMessages: ChatMessageView[] = [{ id: 'demo-a', role: 'assistant', text: 'Blender is connected. I can inspect the current scene, prepare a checkpointed plan, and validate each change before export.', createdAt: now }];
  let demoConversations: ConversationSummaryView[] = [{ id: 'demo-conversation', title: 'Warehouse rover concept', branchOf: null, messageCount: 1, createdAt: now, updatedAt: now }, { id: 'demo-history', title: 'Sensor mast exploration', branchOf: null, messageCount: 6, createdAt: now, updatedAt: new Date(Date.now() - 3_600_000).toISOString() }];
  let demoSettings: WorkspaceSettings = { actionMode: 'guided', routingMode: 'automatic', activeProvider: 'nvidia', activeModel: 'nvidia/nemotron-3-ultra-550b-a55b', enabledProviders: { nvidia: true, openai: true }, fallbackOrder: ['nvidia', 'openai', 'local'], monthlyBudgetUsd: 20, cloudProcessing: true, visualUploads: false, fileUploads: false, projectMemory: true, globalMemory: false, diagnosticLogging: true };
  const state = (): AppState => ({ projectId: 'demo-project', projectName: 'Warehouse Robotics Project', mode, bridgeConnected: true, sceneRevision: 12, activeGoalJobId: null, activities: [] });
  const timeline: TimelineEventView[] = [
    { id: 't1', kind: 'activity', title: 'Fresh Blender scene captured', detail: 'scene · scene-refreshed', sceneRevision: 12, actor: 'SimForge', createdAt: now },
    { id: 't2', kind: 'activity', title: 'Robot hierarchy validated', detail: 'validation · completed', sceneRevision: 12, actor: 'SimForge', createdAt: new Date(Date.now() - 80_000).toISOString() },
    { id: 't3', kind: 'checkpoint', title: 'Before wheel correction', detail: 'Recoverable checkpoint', sceneRevision: 11, actor: 'SimForge', createdAt: new Date(Date.now() - 180_000).toISOString() },
  ];
  const demoValidation: ValidationRun = {
    id: 'demo-validation', projectId: 'demo-project', sceneRevision: 12,
    startedAt: now, completedAt: now, status: 'COMPLETED',
    channels: ['fresh-blender-snapshot', 'deterministic-geometry', 'deterministic-robotics', 'deterministic-environment'],
    summary: { blocker: 0, error: 0, warning: 0, info: 4 }, findings: [],
  };
  const demoIsaacEnvironment: IsaacEnvironmentStatus = {
    installed: true,
    runtimeReady: true,
    product: 'NVIDIA Isaac Sim',
    version: '6.0.1.0',
    pythonVersion: '3.12.10',
    pythonPath: 'C:\\SimForge\\.tools\\isaacsim-6.0.1\\Scripts\\python.exe',
    compatibility: 'BELOW_PUBLISHED_MINIMUM',
    hardware: { ramGiB: 29.4, gpuName: 'NVIDIA GeForce RTX 5070', vramGiB: 11.7, driverVersion: '610.62' },
    publishedMinimum: { ramGiB: 32, vramGiB: 16 },
    issues: ['This machine is below NVIDIA\'s published RAM and VRAM minimums; local experiments remain available with reduced scenes.'],
    checkedAt: now,
  };
  const handler: ProxyHandler<Record<string, unknown>> = { get: (_target, property) => {
    const methods: Record<string, (...args: never[]) => unknown> = {
      getState: async () => state(),
      setMode: async (next: Mode) => { mode = next; return state(); },
      listConversations: async () => demoConversations,
      createConversation: async () => { const entry = { id: `demo-${Date.now()}`, title: 'New conversation', branchOf: null, messageCount: 0, createdAt: now, updatedAt: now }; demoConversations = [entry, ...demoConversations]; return entry; },
      renameConversation: async (id: string, title: string) => { demoConversations = demoConversations.map((entry) => entry.id === id ? { ...entry, title } : entry); return demoConversations.find((entry) => entry.id === id); },
      deleteConversation: async (id: string) => { demoConversations = demoConversations.filter((entry) => entry.id !== id); return demoConversations; },
      branchConversation: async (id: string) => { const source = demoConversations.find((entry) => entry.id === id)!; const entry = { ...source, id: `branch-${Date.now()}`, title: `${source.title} — branch`, branchOf: id }; demoConversations = [entry, ...demoConversations]; return entry; },
      getChat: async () => demoMessages,
      sendChat: async (_id: string, text: string) => { demoMessages = [...demoMessages, { id: `u-${Date.now()}`, role: 'user', text, createdAt: now }, { id: `a-${Date.now()}`, role: 'assistant', text: 'I will inspect the current Blender revision and prepare a checkpointed plan before any structural change.', createdAt: now }]; return demoMessages; },
      stopChat: async () => undefined,
      getConversationContext: async () => ({ estimatedTokens: 820, contextLimit: 32_000, percentUsed: 3, compactedAt: null, summary: null }),
      compactConversation: async () => ({ estimatedTokens: 410, contextLimit: 32_000, percentUsed: 1, compactedAt: now, summary: 'Conversation compacted.' }),
      chooseAttachments: async () => [], listAttachments: async () => [],
      getWorkspaceSettings: async () => demoSettings, updateWorkspaceSettings: async (next: WorkspaceSettings) => (demoSettings = next),
      listMemories: async (scope: 'project' | 'global') => scope === 'project' ? [{ id: 'demo-memory', scope, title: 'Robot conventions', content: 'Use Z-up, meters, and X-forward for generated robots.', source: 'user', updatedAt: now }] : [],
      saveMemory: async (scope: 'project' | 'global', title: string, content: string) => ({ id: `demo-memory-${Date.now()}`, scope, title, content, source: 'user', updatedAt: now }),
      deleteMemory: async () => [], exportMemories: async () => 'simforge-project-memory.json',
      getUsageSummary: async () => ({ inputTokens: 1240, outputTokens: 380, knownCostUsd: 0, unpricedRequests: 2, requestCount: 2 }),
      exportProjectData: async () => 'Warehouse-Robotics-Project-SimForge-Project',
      exportDiagnostics: async () => 'simforge-diagnostics.json', deleteCurrentProject: async () => undefined,
      getLatestValidation: async () => null, listCheckpoints: async () => [], listVersions: async () => [], getTimeline: async () => timeline, listExports: async () => [],
      listReviews: async () => [],
      getIsaacEnvironment: async () => demoIsaacEnvironment,
      listIsaacExperiments: async () => [],
      getIsaacExperimentProposal: async () => ({ planHash: 'simulation:demo', toolId: 'simulation.run', risk: 'privileged', sceneRevision: 12, args: { sourceExportId: 'demo-export', sourceSceneRevision: 12, task: { id: 'drive-to-waypoint-v1', seed: 20260719, steps: 240 } }, summary: 'Run a fixed stability check and 1.2 m drive-to-waypoint task in local Isaac Sim against the latest canonical export.' }),
      getPrimitiveRobotProposal: async () => ({ planHash: 'demo', toolId: 'robot.materialize', args: { graph: {} }, graph: {}, summary: '6 links / 5 joints / 2 sensor frames' }),
      getWarehouseProposal: async () => ({ planHash: 'demo-warehouse', toolId: 'scene.materialize_assembly', args: { robotGraph: {}, environmentGraph: {} }, robotGraph: {}, environmentGraph: {}, summary: '12 links / 11 joints / 3 sensors / 15 warehouse objects' }),
      buildWarehouseScene: async () => ({ state: state(), validation: demoValidation }),
      getLatestImportReport: async () => null,
      listNativeImports: async () => [],
      chooseNativeImport: async () => null,
      runEnvironmentDoctor: async () => [
        { id: 'blender', ok: true, severity: 'pass', summary: 'Detected and compatible', path: 'C:\\Program Files\\Blender Foundation\\Blender 4.5' },
        { id: 'python', ok: true, severity: 'pass', summary: 'Python 3.13 runtime is ready', path: null },
        { id: 'usd', ok: true, severity: 'pass', summary: 'usd-core 26.5 is ready', path: null },
        { id: 'isaac', ok: true, severity: 'warning', summary: 'Isaac Sim 6.0.1.0 is ready; hardware is below the published minimum', path: demoIsaacEnvironment.pythonPath },
      ],
      providerStatus: async (id: string) => ({ providerId: id, configured: true, discoveredModels: 4, lastError: null }),
      discoverProviderModels: async () => [],
      refreshScene: async () => state(),
    };
    return methods[String(property)] ?? (async () => { throw new Error(`${String(property)} is unavailable in browser design preview`); });
  }};
  return new Proxy({}, handler) as unknown as SimForgeDesktopApi;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
