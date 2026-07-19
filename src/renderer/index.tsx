import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import type { AppState, Mode, ModelDescriptor, ReviewManifest, ValidationRun } from '../shared/contracts';
import type {
  ChatMessageView,
  CheckpointView,
  GoalJobView,
  RobotProposal,
} from '../shared/desktop-api';
import type { DoctorCheck } from '../main/environment-doctor';
import type {
  CloudProviderId,
  ProviderProbeResult,
  ProviderStatus,
} from '../main/providers/provider-service';
import './styles.css';

const MODES: Array<{ id: Mode; label: string; help: string }> = [
  { id: 'normal', label: 'Chat', help: 'Discuss and perform permitted small edits.' },
  { id: 'plan', label: 'Plan', help: 'Inspect and plan. Blender mutation is unavailable.' },
  { id: 'build', label: 'Build', help: 'Execute approved or permitted actions.' },
  { id: 'goal', label: 'Goal', help: 'Run a persistent approved task plan.' },
];

const PLAN_TASKS = [
  { id: 'inspect', description: 'Read a fresh Blender scene snapshot.' },
  { id: 'checkpoint', description: 'Create a recovery checkpoint.' },
  { id: 'create', description: 'Create one structured cube primitive.' },
  { id: 'verify', description: 'Refresh scene truth and report the revision.' },
];

function UserChatMessage() {
  return <MessagePrimitive.Root className="chat-message user"><b>user</b><MessagePrimitive.Parts /></MessagePrimitive.Root>;
}

function AssistantChatMessage() {
  return <MessagePrimitive.Root className="chat-message assistant"><b>assistant</b><MessagePrimitive.Parts /><MessagePrimitive.Error /></MessagePrimitive.Root>;
}

function AssistantChat({
  persisted,
  onActivity,
}: {
  persisted: ChatMessageView[];
  onActivity: () => Promise<void>;
}) {
  const adapter = useMemo<ChatModelAdapter>(() => ({
    run: async ({ messages }) => {
      const latest = messages.at(-1);
      const text = latest?.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n') ?? '';
      const stored = await window.simforge.sendChat(text);
      const response = [...stored].reverse().find((message) => message.role === 'assistant');
      await onActivity();
      return { content: [{ type: 'text', text: response?.text ?? 'No response was stored.' }] };
    },
  }), [onActivity]);
  const initialMessages = useMemo<ThreadMessageLike[]>(() => persisted.map((message) => ({
    id: message.id,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: [{ type: 'text', text: message.text }],
    createdAt: new Date(message.createdAt),
  })), [persisted]);
  const runtime = useLocalRuntime(adapter, {
    initialMessages,
    unstable_enableMessageQueue: true,
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="chat-card">
        <div><p className="eyebrow">NORMAL CHAT</p><h2>Discussion stays usable while goal work is running</h2></div>
        <ThreadPrimitive.Viewport className="chat-log">
          <ThreadPrimitive.Empty><p className="muted">No messages yet. Chat has no mutating tools.</p></ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{
            UserMessage: UserChatMessage,
            AssistantMessage: AssistantChatMessage,
          }} />
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Root className="inline-form">
          <ComposerPrimitive.Input aria-label="Chat message" placeholder="Ask about the scene or plan..." />
          <ComposerPrimitive.Send className="secondary">Send locally</ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [goal, setGoal] = useState('');
  const [chat, setChat] = useState<ChatMessageView[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const [job, setJob] = useState<GoalJobView | null>(null);
  const [mockProvider, setMockProvider] = useState<ModelDescriptor | null>(null);
  const [providerId, setProviderId] = useState<CloudProviderId>('nvidia');
  const [credential, setCredential] = useState('');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [providerProbe, setProviderProbe] = useState<ProviderProbeResult | null>(null);
  const [doctor, setDoctor] = useState<DoctorCheck[]>([]);
  const [validation, setValidation] = useState<ValidationRun | null>(null);
  const [validationApprovals, setValidationApprovals] = useState<Record<string, string>>({});
  const [checkpoints, setCheckpoints] = useState<CheckpointView[]>([]);
  const [restoreApprovals, setRestoreApprovals] = useState<Record<string, string>>({});
  const [robotProposal, setRobotProposal] = useState<RobotProposal | null>(null);
  const [robotApproval, setRobotApproval] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewManifest | null>(null);
  const [reviewImages, setReviewImages] = useState<Record<string, string>>({});
  const robotBuilt = validation?.channels.includes('deterministic-robotics') ?? false;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const next = await window.simforge.getState();
    setState(next);
    return next;
  }, []);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      await refreshState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }, [refreshState]);

  useEffect(() => {
    void refreshState().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Unable to read application state');
    });
  }, [refreshState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshState().catch(() => {
        // The next successful poll restores live connection and revision status.
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [refreshState]);

  useEffect(() => {
    if (!state?.activeGoalJobId || job) return;
    void window.simforge.getGoal(state.activeGoalJobId).then(setJob).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Unable to restore goal job');
    });
  }, [job, state?.activeGoalJobId]);

  useEffect(() => {
    void window.simforge.providerStatus(providerId).then(setProviderStatus).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Unable to read provider status');
    });
    setModels([]);
    setSelectedModel('');
    setProviderProbe(null);
  }, [providerId]);

  useEffect(() => {
    void window.simforge.runEnvironmentDoctor().then(setDoctor).catch(() => setDoctor([]));
    void window.simforge.getLatestValidation().then(setValidation).catch(() => setValidation(null));
    void window.simforge.listCheckpoints().then(setCheckpoints).catch(() => setCheckpoints([]));
    void window.simforge.getPrimitiveRobotProposal().then(setRobotProposal).catch(() => setRobotProposal(null));
    void window.simforge.getChat().then((messages) => {
      setChat(messages);
      setChatReady(true);
    }).catch(() => setChatReady(true));
  }, []);

  const activeModeHelp = useMemo(
    () => MODES.find((mode) => mode.id === state?.mode)?.help,
    [state?.mode],
  );

  if (!state) return <main className="loading">Preparing local project services...</main>;

  const runJobCommand = async (
    command: 'start' | 'pause' | 'cancel' | 'retry' | 'rewind' | 'branch',
    taskIndex?: number,
  ) => {
    if (!job) return;
    const result = await window.simforge.commandGoal(job.jobId, command, taskIndex);
    setJob(await window.simforge.getGoal(result.jobId));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">SIMFORGE / MS1 + MS2 + MS3 + MS4</p><h1>{state.projectName}</h1></div>
        <div className="status-cluster">
          <span className={state.bridgeConnected ? 'status good' : 'status quiet'}>
            <i /> Blender {state.bridgeConnected ? 'connected' : 'waiting'}
          </span>
          <span className="revision">Scene r{state.sceneRevision ?? '-'}</span>
        </div>
      </header>

      <section className="modebar" aria-label="Operating mode">
        {MODES.map((mode) => (
          <button
            className={state.mode === mode.id ? 'mode active' : 'mode'}
            key={mode.id}
            title={mode.help}
            disabled={busy}
            onClick={() => void run(async () => setState(await window.simforge.setMode(mode.id)))}
          >{mode.label}</button>
        ))}
        <p>{activeModeHelp}</p>
      </section>

      <div className="preview-banner" role="note">
        <strong>Engineering preview</strong>
        <span>This milestone harness proves connection, policy, persistence, and deterministic correction. MS6 delivers the final SimForge workspace.</span>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="workspace">
        <section className="conversation panel">
          {chatReady && <AssistantChat persisted={chat} onActivity={async () => { await refreshState(); }} />}

          <div className="panel-heading">
            <div><p className="eyebrow">GOAL</p><h2>Approved, persistent execution</h2></div>
            <button className="secondary" disabled={busy} onClick={() => void run(async () => {
              setMockProvider(await window.simforge.probeMockProvider());
            })}>Probe local fixture</button>
          </div>

          <textarea
            value={goal}
            disabled={busy || Boolean(job)}
            onChange={(event) => setGoal(event.target.value)}
            aria-label="Goal description"
            placeholder="Describe a goal, for example: Create one inspection cube in the current Blender scene."
          />
          {!job ? (
            <button className="primary" disabled={busy || !goal.trim()} onClick={() => void run(async () => {
              const created = await window.simforge.createGoal({ goal, tasks: PLAN_TASKS });
              setJob(await window.simforge.getGoal(created.jobId));
            })}>Create task plan</button>
          ) : (
            <div className="plan-card">
              <div className="plan-title">
                <strong>Plan: {job.status}</strong><span>{job.planHash.slice(0, 10)}</span>
              </div>
              <ol>{job.tasks.map((task) => (
                <li className={task.status} key={task.taskIndex}>
                  {task.description} <small>{task.status}{task.attempts ? ` / attempt ${task.attempts}` : ''}</small>
                </li>
              ))}</ol>
              <p className="validation-state">Validation gate: {validation
                ? `r${validation.sceneRevision} / ${validation.summary.error + validation.summary.blocker} blocking`
                : 'not run for this project'}.</p>
              <div className="actions wrap">
                {job.status === 'awaiting-approval' && <button className="primary" disabled={busy} onClick={() => void run(async () => {
                  await window.simforge.approveGoal(job.jobId, job.planHash);
                  setJob(await window.simforge.getGoal(job.jobId));
                })}>Approve exact plan</button>}
                {(job.status === 'ready' || job.status === 'paused') && <button className="primary" disabled={busy} onClick={() => void run(() => runJobCommand('start'))}>Start / resume</button>}
                {job.status === 'running' && <>
                  <button className="primary" disabled={busy} onClick={() => void run(async () => setJob(await window.simforge.runNextGoalTask(job.jobId)))}>Run next task</button>
                  <button className="secondary top" disabled={busy} onClick={() => void run(() => runJobCommand('pause'))}>Pause</button>
                </>}
                {job.status === 'failed' && <button className="primary" disabled={busy} onClick={() => void run(() => runJobCommand('retry'))}>Retry failed task</button>}
                {!['completed', 'cancelled'].includes(job.status) && <button className="secondary top" disabled={busy} onClick={() => void run(() => runJobCommand('cancel'))}>Cancel</button>}
                <button className="secondary top" disabled={busy} onClick={() => void run(() => runJobCommand('rewind', 0))}>Rewind</button>
                <button className="secondary top" disabled={busy} onClick={() => void run(() => runJobCommand('branch'))}>Branch</button>
              </div>
            </div>
          )}

          <div className="foundation-actions">
            <button className="secondary" disabled={busy || !state.bridgeConnected} onClick={() => void run(async () => {
              setState(await window.simforge.refreshScene());
            })}>Refresh live scene</button>
            <button className="secondary" disabled={busy || !state.bridgeConnected || state.sceneRevision === null || state.mode === 'plan'} onClick={() => void run(async () => {
              setState(await window.simforge.executeTool({
                toolId: 'object.create_primitive',
                args: { primitive: 'CUBE', name: 'SimForge Cube', location: [0, 0, 1] },
                planHash: job?.planHash ?? null,
                planApproved: Boolean(job && job.status !== 'awaiting-approval'),
                approvalId: null,
              }));
            })}>Create checkpointed cube</button>
            <button className="secondary" disabled={busy || !state.bridgeConnected || state.mode === 'plan' || state.mode === 'goal'} onClick={() => void run(async () => {
              setState(await window.simforge.runMockThinSlice(goal));
            })}>Run local AI-to-Blender slice</button>
          </div>

          <section className="robot-card">
            <div className="panel-heading compact">
              <div><p className="eyebrow">ROBOTICS BUILD</p><h2>Versioned primitive wheeled robot</h2></div>
              <span className="robot-schema">RobotGraph v{robotProposal?.graph.schemaVersion ?? '-'}</span>
            </div>
            <p className="muted">{robotProposal?.summary ?? 'Preparing deterministic RobotGraph...'}. Physical values remain labeled assumptions.</p>
            {robotBuilt && <p className="validation-state">Robot is materialized in Blender and the deterministic robotics channel is active.</p>}
            {robotProposal && <ul className="robot-facts">
              <li>{robotProposal.graph.materials.length} assigned materials</li>
              <li>{robotProposal.graph.links.filter((link) => link.collision).length} collision primitives</li>
              <li>{robotProposal.graph.assumptions.length} explicit assumptions</li>
            </ul>}
            <div className="actions wrap">
              {!robotBuilt && !robotApproval && <button className="primary" disabled={busy || !robotProposal || !['build', 'goal'].includes(state.mode)} onClick={() => void run(async () => {
                if (!robotProposal) return;
                setRobotApproval(await window.simforge.approveAction({
                  planHash: robotProposal.planHash,
                  toolId: robotProposal.toolId,
                  args: robotProposal.args,
                }));
              })}>Approve exact robot build</button>}
              {!robotBuilt && robotApproval && <button className="primary" disabled={busy} onClick={() => void run(async () => {
                const built = await window.simforge.buildPrimitiveRobot(robotApproval);
                setState(built.state);
                setValidation(built.validation);
                setRobotApproval(null);
                setCheckpoints(await window.simforge.listCheckpoints());
              })}>Build approved robot</button>}
              <button className="secondary top" disabled={busy || !state.bridgeConnected || state.mode === 'plan' || !robotBuilt} onClick={() => void run(async () => {
                const manifest = await window.simforge.renderPrimitiveRobotReview('Primitive robot readiness');
                setReview(manifest);
                const entries = await Promise.all(manifest.images.map(async (image) => [
                  image.view,
                  await window.simforge.getReviewImage(manifest.reviewId, image.view),
                ] as const));
                setReviewImages(Object.fromEntries(entries));
              })}>Render materialized review</button>
            </div>
            {review && <div className="review-result">
              <div className="review-heading"><b>{review.label}</b><span>scene r{review.sceneRevision} / advisory images</span></div>
              <div className="review-grid">{review.images.map((image) => <figure key={image.view}>
                {reviewImages[image.view] && <img src={reviewImages[image.view]} alt={`${image.view} materialized robot review`} />}
                <figcaption>{image.view}</figcaption>
              </figure>)}</div>
            </div>}
          </section>

          <section className="settings-card">
            <div className="panel-heading compact">
              <div><p className="eyebrow">AI PROVIDER</p><h2>NVIDIA-first runtime discovery</h2></div>
              <select value={providerId} onChange={(event) => setProviderId(event.target.value as CloudProviderId)}>
                <option value="nvidia">NVIDIA</option><option value="openai">OpenAI (optional)</option>
              </select>
            </div>
            <p className="muted">Credential: {providerStatus?.configured ? 'stored with Windows protection' : 'not configured'}. It is never returned to this UI.</p>
            <div className="inline-form">
              <input type="password" autoComplete="off" value={credential} placeholder={`${providerId} API key`} onChange={(event) => setCredential(event.target.value)} />
              <button className="secondary" disabled={busy || credential.length < 8} onClick={() => void run(async () => {
                setProviderStatus(await window.simforge.configureProvider(providerId, credential));
                setCredential('');
              })}>Save key</button>
              <button className="secondary" disabled={busy || !providerStatus?.configured} onClick={() => void run(async () => {
                setProviderStatus(await window.simforge.removeProvider(providerId));
                setModels([]);
              })}>Remove</button>
            </div>
            <div className="inline-form">
              <button className="secondary" disabled={busy || !providerStatus?.configured} onClick={() => void run(async () => {
                const discovered = await window.simforge.discoverProviderModels(providerId);
                setModels(discovered);
                setSelectedModel(discovered[0]?.modelId ?? '');
                setProviderStatus(await window.simforge.providerStatus(providerId));
              })}>Discover models</button>
              <select value={selectedModel} disabled={!models.length} onChange={(event) => setSelectedModel(event.target.value)}>
                <option value="">Select discovered model</option>
                {models.map((model) => <option value={model.modelId} key={model.modelId}>{model.modelId}</option>)}
              </select>
              <button className="secondary" disabled={busy || !selectedModel} onClick={() => void run(async () => {
                setProviderProbe(await window.simforge.probeProvider(providerId, selectedModel));
              })}>Send disclosed text probe</button>
            </div>
            <p className="disclosure">Before dispatch: provider <b>{providerId}</b>; model <b>{selectedModel || 'not selected'}</b>; data <b>one probe prompt</b>; attachments <b>none</b>; purpose <b>non-mutating capability test</b>.</p>
            {providerProbe && <p className="success">{providerProbe.selectionReason}. Vision: {String(providerProbe.model.capabilities.vision)}.</p>}
          </section>

          <section className="doctor-card">
            <p className="eyebrow">ENVIRONMENT DOCTOR</p>
            <ul>{doctor.map((check) => <li key={check.id} className={check.ok ? 'ok' : 'missing'}><b>{check.id}</b>: {check.summary}</li>)}</ul>
          </section>

          <div className="provider-card">
            <span className="icon-dot" />
            <div><strong>{mockProvider ? `${mockProvider.providerId} / ${mockProvider.modelId}` : 'Local deterministic fixture idle'}</strong>
              <p>No cloud data is sent by the fixture. Cloud dispatches use the disclosure shown above.</p></div>
          </div>
        </section>

        <aside className="activity panel">
          <section className="validation-dock">
            <div className="panel-heading">
              <div><p className="eyebrow">VALIDATION</p><h2>Deterministic scene evidence</h2></div>
              <button className="icon-button" disabled={busy || !state.bridgeConnected} onClick={() => void run(async () => {
                setValidation(await window.simforge.runValidation());
                setValidationApprovals({});
                setCheckpoints(await window.simforge.listCheckpoints());
              })}>Run fresh</button>
            </div>
            {!validation ? <p className="validation-empty">No validation run yet. Connect Blender and inspect the current revision.</p> : <>
              <div className="validation-summary">
                <span className="blocker">{validation.summary.blocker} blocker</span>
                <span className="error">{validation.summary.error} errors</span>
                <span className="warning">{validation.summary.warning} warnings</span>
                <span>{validation.summary.info} info</span>
                <small>fresh scene r{validation.sceneRevision}</small>
              </div>
              <ul className="finding-list">
                {validation.findings.length === 0 && <li className="finding-pass">No deterministic geometry findings.</li>}
                {validation.findings.map((finding) => {
                  const fix = finding.proposedFix;
                  const approvalId = validationApprovals[finding.id];
                  const planHash = `validation:${validation.id}`;
                  return <li key={finding.id} className={`finding ${finding.severity}`}>
                    <div className="finding-title"><b>{finding.ruleId}</b><span>{finding.severity}</span></div>
                    <p>{finding.message}</p>
                    <small>{finding.entityPath}</small>
                    {finding.assumptions.map((assumption) => <small key={assumption}>Assumption: {assumption}</small>)}
                    {fix?.fixClass === 'SAFE_LOCAL' && <button className="finding-action" disabled={busy || state.mode === 'plan'} onClick={() => void run(async () => {
                      setValidation(await window.simforge.applyValidationFix({
                        findingId: finding.id,
                        planHash: null,
                        approvalId: null,
                      }));
                      setCheckpoints(await window.simforge.listCheckpoints());
                    })}>Apply reversible safe fix</button>}
                    {fix && fix.fixClass !== 'SAFE_LOCAL' && !approvalId && <button className="finding-action approval" disabled={busy || !['build', 'goal'].includes(state.mode)} onClick={() => void run(async () => {
                      const approved = await window.simforge.approveAction({
                        planHash,
                        toolId: fix.toolId,
                        args: fix.args,
                      });
                      setValidationApprovals((current) => ({ ...current, [finding.id]: approved }));
                    })}>Approve exact {fix.fixClass.toLowerCase()} fix</button>}
                    {fix && fix.fixClass !== 'SAFE_LOCAL' && approvalId && <button className="finding-action" disabled={busy} onClick={() => void run(async () => {
                      setValidation(await window.simforge.applyValidationFix({
                        findingId: finding.id,
                        planHash,
                        approvalId,
                      }));
                      setValidationApprovals({});
                      setCheckpoints(await window.simforge.listCheckpoints());
                    })}>Apply approved fix</button>}
                  </li>;
                })}
              </ul>
              <button className="secondary validation-undo" disabled={busy || state.mode === 'plan'} onClick={() => void run(async () => {
                setValidation(await window.simforge.undoLatestValidationFix());
                setCheckpoints(await window.simforge.listCheckpoints());
              })}>Undo latest safe fix</button>
            </>}
            <details className="checkpoint-history">
              <summary>Recovery checkpoints ({checkpoints.length})</summary>
              <ul>{checkpoints.slice(0, 8).map((checkpoint) => {
                const planHash = `restore:${checkpoint.id}`;
                const approvalId = restoreApprovals[checkpoint.id];
                return <li key={checkpoint.id}>
                  <div><b>{checkpoint.label}</b><small>r{checkpoint.sceneRevision} / {new Date(checkpoint.createdAt).toLocaleTimeString()}</small></div>
                  {!checkpoint.completeProjectState && <small>Blender-only legacy checkpoint</small>}
                  {checkpoint.completeProjectState && !approvalId && <button disabled={busy || !['build', 'goal'].includes(state.mode)} onClick={() => void run(async () => {
                    const approved = await window.simforge.approveCheckpointRestore(checkpoint.id, planHash);
                    setRestoreApprovals((current) => ({ ...current, [checkpoint.id]: approved }));
                  })}>Approve restore</button>}
                  {checkpoint.completeProjectState && approvalId && <button disabled={busy} onClick={() => void run(async () => {
                    setValidation(await window.simforge.restoreCheckpoint(checkpoint.id, planHash, approvalId));
                    setRestoreApprovals({});
                    setCheckpoints(await window.simforge.listCheckpoints());
                  })}>Restore approved checkpoint</button>}
                </li>;
              })}</ul>
            </details>
          </section>
          <div className="panel-heading">
            <div><p className="eyebrow">ACTIVITY</p><h2>Auditable state changes</h2></div>
            <button className="icon-button" onClick={() => void refreshState()} aria-label="Refresh activity">Refresh</button>
          </div>
          <ul className="activity-list">
            {state.activities.length === 0 && <li className="empty">No activity yet.</li>}
            {state.activities.map((item) => (
              <li key={item.id}><span className="activity-mark" /><div>
                <div className="activity-meta"><b>{item.phase}</b><time>{new Date(item.createdAt).toLocaleTimeString()}</time></div>
                <p>{item.summary}</p>
                {item.details && <small>{Object.entries(item.details).map(([key, value]) => `${key}: ${String(value)}`).join(' / ')}</small>}
              </div></li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root is missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);
