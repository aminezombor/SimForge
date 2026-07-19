import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  access,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  ExportManifest,
  ExportResult,
  EnvironmentGraph,
  IsaacEnvironmentStatus,
  IsaacExperiment,
  RobotGraph,
} from '../../shared/contracts';
import {
  ExportManifestSchema,
  IsaacEnvironmentStatusSchema,
  IsaacExperimentSchema,
  RobotGraphSchema,
} from '../../shared/contracts';
import { sha256 } from '../../shared/hash';
import { assertContract } from '../../shared/validation';
import type { ActivityService } from '../domain/activity-service';
import type { ApprovalService } from '../domain/approval-service';
import type { ExportService } from '../export/export-service';
import type { ProjectHandle } from '../storage/project-repository';

const execFileAsync = promisify(execFile);
const RESULT_PREFIX = 'SIMFORGE_RESULT:';
const PUBLISHED_MINIMUM_RAM_GIB = 32;
const PUBLISHED_MINIMUM_VRAM_GIB = 16;

interface IsaacRuntimeConfiguration {
  schemaVersion: 1;
  pythonPath: string;
  eulaAcceptedAt: string;
  productVersion?: string;
}

interface IsaacRuntimePaths {
  python: string;
  worker: string;
  eulaAcceptedAt: string;
}

interface WorkerEnvelope {
  ok: boolean;
  product?: string;
  version?: string;
  python?: string;
  resultPath?: string;
  result?: Record<string, unknown>;
  error?: string;
  message?: string;
}

export interface IsaacExperimentProposal {
  planHash: string;
  toolId: 'simulation.run';
  risk: 'privileged';
  sceneRevision: number;
  args: {
    sourceExportId: string;
    sourceSceneRevision: number;
    parentExperimentId: string | null;
    task: {
      id: 'drive-to-waypoint-v1';
      seed: number;
      steps: number;
    };
  };
  summary: string;
}

export interface IsaacExperimentAnalysis {
  analysisId: string;
  experimentId: string;
  status: 'NO_ACTION' | 'CORRECTION_PROPOSED' | 'MANUAL_REVIEW';
  deterministicSummary: string;
  failedCheckIds: string[];
  stabilityEvidence: Record<string, unknown> | null;
  model: {
    providerId: string;
    modelId: string;
    narrative: string;
    advisoryOnly: true;
    selectionReason: string;
  } | null;
  createdAt: string;
}

export interface IsaacCorrectionProposal {
  planHash: string;
  toolId: 'robot.retract_subtree';
  risk: 'structural';
  sceneRevision: number;
  sourceExperimentId: string;
  args: {
    robotId: string;
    rootLinkId: string;
    affectedLinkIds: string[];
    deltaXM: number;
    reason: string;
    robotGraph: RobotGraph;
    environmentGraph: EnvironmentGraph;
  };
  summary: string;
}

export function createIsaacStabilityCorrectionProposal(
  graph: RobotGraph,
  environmentGraph: EnvironmentGraph,
  analysis: IsaacExperimentAnalysis,
  sceneRevision: number,
): IsaacCorrectionProposal {
  if (analysis.status !== 'CORRECTION_PROPOSED' || !analysis.stabilityEvidence) {
    throw new Error('The Isaac analysis does not support a bounded stability correction');
  }
  const recommendation = analysis.stabilityEvidence.recommendedCorrection as Record<string, unknown> | undefined;
  const rootLinkId = typeof recommendation?.rootLinkId === 'string' ? recommendation.rootLinkId : '';
  const targetCenterX = Number(recommendation?.targetCenterOfMassXMaxM);
  const center = analysis.stabilityEvidence.centerOfMassM;
  const totalMass = Number(analysis.stabilityEvidence.totalMassKg);
  const centerX = Array.isArray(center) ? Number(center[0]) : Number.NaN;
  if (!rootLinkId || !Number.isFinite(targetCenterX) || !Number.isFinite(centerX) || !Number.isFinite(totalMass)) {
    throw new Error('Isaac stability evidence is incomplete');
  }

  const children = new Map<string, string[]>();
  for (const joint of graph.joints) {
    children.set(joint.parentLinkId, [...(children.get(joint.parentLinkId) ?? []), joint.childLinkId]);
  }
  const affected = new Set<string>();
  const pending = [rootLinkId];
  while (pending.length > 0) {
    const linkId = pending.pop()!;
    if (affected.has(linkId)) continue;
    affected.add(linkId);
    pending.push(...(children.get(linkId) ?? []));
  }
  if (!graph.links.some((link) => link.id === rootLinkId) || affected.size === 0) {
    throw new Error('The proposed correction subtree is absent from the current RobotGraph');
  }
  const subtreeMass = graph.links
    .filter((link) => affected.has(link.id))
    .reduce((sum, link) => sum + (typeof link.massKg.value === 'number' ? link.massKg.value : 0), 0);
  if (!(subtreeMass > 0) || centerX <= targetCenterX) {
    throw new Error('The stability evidence does not describe a forward center-of-mass failure');
  }
  const rawDelta = (targetCenterX - centerX) * totalMass / subtreeMass;
  const deltaXM = Math.round(Math.max(-0.5, Math.min(-0.02, rawDelta)) * 1_000_000) / 1_000_000;
  const reason = `Isaac ${analysis.experimentId} found center-of-mass X ${centerX.toFixed(4)} m beyond the ${targetCenterX.toFixed(4)} m support target; retract ${rootLinkId} by ${Math.abs(deltaXM).toFixed(4)} m.`;

  const shifted = (position: [number, number, number]): [number, number, number] => [
    Math.round((position[0] + deltaXM) * 1_000_000) / 1_000_000,
    position[1],
    position[2],
  ];
  const correctedRobotGraph: RobotGraph = {
    ...graph,
    links: graph.links.map((link) => affected.has(link.id)
      ? { ...link, pose: { ...link.pose, position: shifted(link.pose.position) } }
      : link),
    joints: graph.joints.map((joint) => affected.has(joint.childLinkId)
      ? { ...joint, origin: { ...joint.origin, position: shifted(joint.origin.position) } }
      : joint),
    sensors: graph.sensors.map((sensor) => affected.has(sensor.parentLinkId)
      ? { ...sensor, pose: { ...sensor.pose, position: shifted(sensor.pose.position) } }
      : sensor),
    assumptions: [
      ...graph.assumptions,
      `Checkpointed simulation correction: ${reason}`,
    ],
  };
  assertContract<RobotGraph>(RobotGraphSchema, correctedRobotGraph, 'Isaac-corrected RobotGraph');
  const args: IsaacCorrectionProposal['args'] = {
    robotId: graph.robotId,
    rootLinkId,
    affectedLinkIds: [...affected].sort(),
    deltaXM,
    reason,
    robotGraph: correctedRobotGraph,
    environmentGraph,
  };
  return {
    planHash: sha256({ toolId: 'robot.retract_subtree', args }),
    toolId: 'robot.retract_subtree',
    risk: 'structural',
    sceneRevision,
    sourceExperimentId: analysis.experimentId,
    args,
    summary: `Move the ${affected.size}-link ${rootLinkId} subtree ${deltaXM.toFixed(4)} m on X in Blender, after an automatic checkpoint.`,
  };
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function parseRuntimeConfiguration(userDataDirectory: string): Promise<IsaacRuntimeConfiguration | null> {
  const location = path.join(userDataDirectory, 'runtime', 'isaac-runtime.json');
  try {
    const value = JSON.parse((await readFile(location, 'utf8')).replace(/^\uFEFF/, '')) as Partial<IsaacRuntimeConfiguration>;
    if (
      value.schemaVersion !== 1 ||
      typeof value.pythonPath !== 'string' ||
      typeof value.eulaAcceptedAt !== 'string'
    ) return null;
    return value as IsaacRuntimeConfiguration;
  } catch {
    return null;
  }
}

export async function locateIsaacRuntime(
  applicationRoot: string,
  userDataDirectory: string,
): Promise<IsaacRuntimePaths | null> {
  const worker = path.join(applicationRoot, 'sidecars', 'isaac_worker.py');
  if (!(await exists(worker))) return null;
  const configuration = await parseRuntimeConfiguration(userDataDirectory);
  const candidates = [
    configuration?.pythonPath,
    process.env.SIMFORGE_ISAAC_PYTHON,
    path.join(applicationRoot, '.tools', 'isaacsim-6.0.1', 'Scripts', 'python.exe'),
  ].filter((entry): entry is string => Boolean(entry));
  for (const candidate of candidates) {
    if (!(await exists(candidate))) continue;
    const configured = configuration?.pythonPath
      && path.resolve(configuration.pythonPath) === path.resolve(candidate);
    const environmentAccepted = process.env.SIMFORGE_ISAAC_EULA_ACCEPTED === 'YES';
    if (!configured && !environmentAccepted) continue;
    return {
      python: path.resolve(candidate),
      worker: path.resolve(worker),
      eulaAcceptedAt: configured ? configuration.eulaAcceptedAt : new Date().toISOString(),
    };
  }
  return null;
}

function parseEnvelope(output: string): WorkerEnvelope | null {
  const line = output.split(/\r?\n/).toReversed()
    .find((entry) => entry.startsWith(RESULT_PREFIX));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(RESULT_PREFIX.length)) as WorkerEnvelope;
  } catch {
    return null;
  }
}

async function runtimeDoctor(runtime: IsaacRuntimePaths): Promise<WorkerEnvelope> {
  const { stdout, stderr } = await execFileAsync(runtime.python, [runtime.worker, 'doctor'], {
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const result = parseEnvelope(`${stdout}\n${stderr}`);
  if (!result) throw new Error('Isaac worker doctor did not return a versioned result');
  return result;
}

async function nvidiaHardware(): Promise<{
  gpuName: string | null;
  vramGiB: number | null;
  driverVersion: string | null;
}> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi.exe',
      ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 10_000 },
    );
    const line = stdout.split(/\r?\n/).find(Boolean);
    if (!line) throw new Error('No NVIDIA GPU row');
    const [gpuName, memoryMiB, driverVersion] = line.split(',').map((value) => value.trim());
    const parsedMemory = Number(memoryMiB);
    return {
      gpuName: gpuName || null,
      vramGiB: Number.isFinite(parsedMemory) ? parsedMemory / 1024 : null,
      driverVersion: driverVersion || null,
    };
  } catch {
    return { gpuName: null, vramGiB: null, driverVersion: null };
  }
}

export async function inspectIsaacEnvironment(
  applicationRoot: string,
  userDataDirectory: string,
): Promise<IsaacEnvironmentStatus> {
  const checkedAt = new Date().toISOString();
  const ramGiB = os.totalmem() / 1024 ** 3;
  const hardware = await nvidiaHardware();
  const runtime = await locateIsaacRuntime(applicationRoot, userDataDirectory);
  const issues: string[] = [];
  if (ramGiB < PUBLISHED_MINIMUM_RAM_GIB) {
    issues.push(`System RAM ${ramGiB.toFixed(1)} GiB is below NVIDIA's published 32 GiB minimum.`);
  }
  if (hardware.vramGiB === null) {
    issues.push('NVIDIA GPU memory could not be measured.');
  } else if (hardware.vramGiB < PUBLISHED_MINIMUM_VRAM_GIB) {
    issues.push(`GPU memory ${hardware.vramGiB.toFixed(1)} GiB is below NVIDIA's published 16 GiB minimum.`);
  }
  let doctor: WorkerEnvelope | null = null;
  if (runtime) {
    try {
      doctor = await runtimeDoctor(runtime);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : 'Isaac runtime probe failed.');
    }
  } else {
    issues.push('A configured Isaac Sim Python runtime with recorded EULA acceptance was not found.');
  }
  const version = doctor && typeof doctor.version === 'string' ? doctor.version : null;
  const pythonVersion = doctor && typeof doctor.python === 'string' ? doctor.python : null;
  const runtimeReady = Boolean(runtime && doctor?.ok && version && pythonVersion);
  const compatibility = !runtimeReady
    ? 'UNAVAILABLE'
    : issues.some((issue) => issue.includes('below NVIDIA'))
      ? 'BELOW_PUBLISHED_MINIMUM'
      : 'SUPPORTED';
  const result: IsaacEnvironmentStatus = {
    installed: Boolean(runtime),
    runtimeReady,
    product: 'NVIDIA Isaac Sim',
    version,
    pythonVersion,
    pythonPath: runtime?.python ?? null,
    compatibility,
    hardware: {
      ramGiB,
      gpuName: hardware.gpuName,
      vramGiB: hardware.vramGiB,
      driverVersion: hardware.driverVersion,
    },
    publishedMinimum: { ramGiB: 32, vramGiB: 16 },
    issues,
    checkedAt,
  };
  assertContract<IsaacEnvironmentStatus>(IsaacEnvironmentStatusSchema, result, 'Isaac environment status');
  return result;
}

async function fileSha256(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function inventory(root: string): Promise<Array<{ path: string; bytes: number; sha256: string }>> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      const info = await lstat(target);
      if (info.isSymbolicLink()) throw new Error('Isaac inputs and artifacts may not contain symbolic links');
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  await visit(root);
  const entries = [];
  for (const file of files.sort()) {
    const info = await stat(file);
    entries.push({
      path: path.relative(root, file).split(path.sep).join('/'),
      bytes: info.size,
      sha256: await fileSha256(file),
    });
  }
  return entries;
}

function assertWorkerResult(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Isaac worker result is not an object');
  }
  const result = value as Record<string, unknown>;
  if (
    result.schemaVersion !== 1 ||
    !['PASSED', 'FAILED'].includes(String(result.status)) ||
    !Array.isArray(result.checks) ||
    !result.metrics || typeof result.metrics !== 'object' ||
    !result.runtime || typeof result.runtime !== 'object'
  ) throw new Error('Isaac worker result failed structural validation');
}

async function runWorker(
  runtime: IsaacRuntimePaths,
  requestPath: string,
  logPath: string,
): Promise<WorkerEnvelope> {
  await mkdir(path.dirname(logPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const log = createWriteStream(logPath, { flags: 'wx' });
    const child = spawn(runtime.python, [runtime.worker, 'run', '--request', requestPath], {
      windowsHide: true,
      shell: false,
      env: {
        ...process.env,
        OMNI_KIT_ACCEPT_EULA: 'YES',
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let combined = '';
    const capture = (chunk: Buffer): void => {
      log.write(chunk);
      combined = `${combined}${chunk.toString('utf8')}`.slice(-4 * 1024 * 1024);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    const timeout = setTimeout(() => child.kill(), 10 * 60_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      log.end();
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      log.end(() => {
        const envelope = parseEnvelope(combined);
        if (!envelope) {
          reject(new Error(`Isaac worker exited ${code ?? 'without code'} without a result`));
          return;
        }
        resolve(envelope);
      });
    });
  });
}

function requireCanonicalExport(exports: ExportResult[], exportId?: string): ExportResult {
  const result = exports.find((entry) => (
    entry.kind === 'canonical' && entry.verified && (!exportId || entry.exportId === exportId)
  ));
  if (!result) throw new Error('A verified canonical USD export is required before Isaac simulation');
  return result;
}

export class IsaacExperimentService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly exports: ExportService,
    private readonly approvals: ApprovalService,
    private readonly activities: ActivityService,
    private readonly applicationRoot: string,
    private readonly userDataDirectory: string,
  ) {}

  async environment(): Promise<IsaacEnvironmentStatus> {
    return inspectIsaacEnvironment(this.applicationRoot, this.userDataDirectory);
  }

  proposal(): IsaacExperimentProposal {
    const source = requireCanonicalExport(this.exports.list());
    const parentExperimentId = this.list()[0]?.experimentId ?? null;
    const args: IsaacExperimentProposal['args'] = {
      sourceExportId: source.exportId,
      sourceSceneRevision: source.sceneRevision,
      parentExperimentId,
      task: { id: 'drive-to-waypoint-v1', seed: 20260719, steps: 240 },
    };
    return {
      planHash: `simulation:${sha256(args)}`,
      toolId: 'simulation.run',
      risk: 'privileged',
      sceneRevision: source.sceneRevision,
      args,
      summary: `Run a fixed 240-step stability check plus a 1.2 m drive-to-waypoint task in local Isaac Sim against canonical export ${source.exportId}.`,
    };
  }

  async execute(proposal: IsaacExperimentProposal, approvalId: string): Promise<IsaacExperiment> {
    if (
      proposal.toolId !== 'simulation.run' ||
      proposal.risk !== 'privileged' ||
      proposal.planHash !== `simulation:${sha256(proposal.args)}` ||
      proposal.args.task.id !== 'drive-to-waypoint-v1' ||
      proposal.args.task.steps < 60 || proposal.args.task.steps > 600
    ) throw new Error('Isaac simulation proposal is invalid or changed');
    const source = requireCanonicalExport(this.exports.list(), proposal.args.sourceExportId);
    if (
      source.sceneRevision !== proposal.sceneRevision ||
      source.sceneRevision !== proposal.args.sourceSceneRevision
    ) throw new Error('Isaac source export revision no longer matches the approved proposal');
    const approval = this.approvals.validate({
      approvalId,
      projectId: this.project.manifest.projectId,
      planHash: proposal.planHash,
      toolId: proposal.toolId,
      args: proposal.args,
      sceneRevision: proposal.sceneRevision,
      risk: proposal.risk,
    });
    if (!approval.ok) throw new Error(`Isaac simulation approval failed: ${approval.code}`);
    const environment = await this.environment();
    if (!environment.runtimeReady || environment.compatibility === 'UNAVAILABLE') {
      throw new Error('Isaac Sim runtime is unavailable; run Environment Doctor before simulation');
    }
    const runtime = await locateIsaacRuntime(this.applicationRoot, this.userDataDirectory);
    if (!runtime) throw new Error('Configured Isaac Sim runtime disappeared after environment inspection');

    const experimentId = randomUUID();
    const experimentRoot = path.join(this.project.root, 'experiments', experimentId);
    const packageRoot = path.join(experimentRoot, 'input', 'package');
    const outputRoot = path.join(experimentRoot, 'output');
    const requestPath = path.join(experimentRoot, 'request.json');
    const logPath = path.join(experimentRoot, 'logs', 'isaac.log');
    await mkdir(path.dirname(packageRoot), { recursive: true });
    await cp(source.destination, packageRoot, { recursive: true, errorOnExist: true, force: false });
    const sourceInventory = await inventory(packageRoot);
    const packageSha256 = sha256(sourceInventory);
    const manifestValue = JSON.parse(await readFile(path.join(packageRoot, 'manifest.json'), 'utf8')) as unknown;
    assertContract<ExportManifest>(ExportManifestSchema, manifestValue, 'copied Isaac source export manifest');
    if (
      manifestValue.exportId !== source.exportId ||
      manifestValue.sceneRevision !== source.sceneRevision
    ) throw new Error('Copied canonical export identity does not match the persisted export result');
    const startedAt = new Date().toISOString();
    const request = {
      schemaVersion: 1,
      experimentId,
      experimentRoot,
      packageRoot,
      outputRoot,
      entryPoint: manifestValue.entryPoint,
      task: proposal.args.task,
      source: {
        exportId: source.exportId,
        sceneRevision: source.sceneRevision,
        packageSha256,
      },
    };
    await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    this.activities.record('simulation', 'isaac-experiment-started', 'Approved local Isaac Sim experiment started', {
      experimentId,
      exportId: source.exportId,
      sceneRevision: source.sceneRevision,
      taskId: proposal.args.task.id,
      compatibility: environment.compatibility,
    });
    const envelope = await runWorker(runtime, requestPath, logPath);
    if (!envelope.result) {
      throw new Error(envelope.message ?? envelope.error ?? 'Isaac worker returned no experiment result');
    }
    assertWorkerResult(envelope.result);
    const worker = envelope.result;
    const rawRuntime = worker.runtime as Record<string, unknown>;
    const artifacts: IsaacExperiment['artifacts'] = [];
    for (const entry of [
      { role: 'request' as const, file: requestPath },
      { role: 'result' as const, file: path.join(outputRoot, 'result.json') },
      { role: 'log' as const, file: logPath },
    ]) {
      if (!(await exists(entry.file))) continue;
      const info = await stat(entry.file);
      artifacts.push({
        role: entry.role,
        relativePath: path.relative(this.project.root, entry.file).split(path.sep).join('/'),
        sha256: await fileSha256(entry.file),
        bytes: info.size,
      });
    }
    const mediaRoot = path.join(outputRoot, 'media');
    if (await exists(mediaRoot)) {
      for (const name of (await readdir(mediaRoot)).filter((entry) => /^frame-[0-9]+\.png$/.test(entry)).sort()) {
        const file = path.join(mediaRoot, name);
        const info = await stat(file);
        artifacts.push({
          role: 'image',
          relativePath: path.relative(this.project.root, file).split(path.sep).join('/'),
          sha256: await fileSha256(file),
          bytes: info.size,
        });
      }
    }
    const completedAt = new Date().toISOString();
    const experiment: IsaacExperiment = {
      schemaVersion: 1,
      experimentId,
      projectId: this.project.manifest.projectId,
      sourceExport: {
        exportId: source.exportId,
        sceneRevision: source.sceneRevision,
        packageSha256,
        entryPoint: manifestValue.entryPoint,
      },
      parentExperimentId: proposal.args.parentExperimentId,
      task: worker.task as IsaacExperiment['task'],
      status: worker.status as IsaacExperiment['status'],
      checks: worker.checks as IsaacExperiment['checks'],
      metrics: worker.metrics as Record<string, unknown>,
      runtime: {
        product: 'NVIDIA Isaac Sim',
        version: String(rawRuntime.version),
        python: String(rawRuntime.python),
        headless: true,
        compatibility: environment.compatibility === 'SUPPORTED'
          ? 'SUPPORTED'
          : 'BELOW_PUBLISHED_MINIMUM',
      },
      artifacts,
      experimentRelativePath: path.relative(this.project.root, experimentRoot).split(path.sep).join('/'),
      startedAt,
      completedAt,
    };
    assertContract<IsaacExperiment>(IsaacExperimentSchema, experiment, 'Isaac experiment');
    await writeFile(
      path.join(experimentRoot, 'manifest.json'),
      `${JSON.stringify(experiment, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    this.project.repository.saveProjectRecord({
      id: `isaac-experiment:${experimentId}`,
      projectId: this.project.manifest.projectId,
      kind: 'validation',
      body: { type: 'isaac-experiment', experiment },
      createdAt: startedAt,
      updatedAt: completedAt,
    });
    this.activities.record('simulation', 'isaac-experiment-completed', `Isaac experiment ${experiment.status.toLowerCase()}`, {
      experimentId,
      status: experiment.status,
      checkCount: experiment.checks.length,
      sourceExportId: source.exportId,
      artifacts: experiment.artifacts.length,
    });
    return experiment;
  }

  list(): IsaacExperiment[] {
    return this.project.repository.listProjectRecords(this.project.manifest.projectId)
      .filter((entry) => entry.kind === 'validation' && entry.body.type === 'isaac-experiment')
      .map((entry) => {
        assertContract<IsaacExperiment>(IsaacExperimentSchema, entry.body.experiment, 'stored Isaac experiment');
        return entry.body.experiment;
      })
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  }

  analysis(experimentId: string): IsaacExperimentAnalysis {
    const experiment = this.list().find((entry) => entry.experimentId === experimentId);
    if (!experiment) throw new Error('Isaac experiment was not found');
    const failed = experiment.checks.filter((check) => check.status === 'FAIL');
    const stability = experiment.checks.find((check) => check.id === 'ISAAC-STABILITY-001');
    const correctionAvailable = stability?.status === 'FAIL'
      && stability.evidence.applicable === true
      && typeof (stability.evidence.recommendedCorrection as Record<string, unknown> | undefined)?.rootLinkId === 'string';
    return {
      analysisId: randomUUID(),
      experimentId,
      status: failed.length === 0
        ? 'NO_ACTION'
        : correctionAvailable ? 'CORRECTION_PROPOSED' : 'MANUAL_REVIEW',
      deterministicSummary: failed.length === 0
        ? 'Isaac Sim returned no deterministic failures; no Blender correction is proposed.'
        : correctionAvailable
          ? 'The mass-weighted robot center lies outside the inset wheel/caster support bounds. A checkpointed arm-subtree retraction can be proposed.'
          : `${failed.length} deterministic Isaac check${failed.length === 1 ? '' : 's'} failed without a bounded automatic correction.`,
      failedCheckIds: failed.map((check) => check.id),
      stabilityEvidence: stability?.evidence ?? null,
      model: null,
      createdAt: new Date().toISOString(),
    };
  }

  async imageData(experimentId: string): Promise<string> {
    const images = await this.imageDataList(experimentId);
    const image = images.at(-1);
    if (!image) throw new Error('Isaac experiment has no captured image');
    return image;
  }

  async imageDataList(experimentId: string): Promise<string[]> {
    const experiment = this.list().find((entry) => entry.experimentId === experimentId);
    if (!experiment) throw new Error('Isaac experiment was not found');
    const images = experiment.artifacts.filter((entry) => entry.role === 'image');
    return Promise.all(images.map(async (image) => {
      const target = path.resolve(this.project.root, ...image.relativePath.split('/'));
      if (!target.startsWith(`${path.resolve(this.project.root)}${path.sep}`)) {
        throw new Error('Isaac image path escaped the project');
      }
      const bytes = await readFile(target);
      if (createHash('sha256').update(bytes).digest('hex') !== image.sha256) {
        throw new Error('Isaac image hash no longer matches the experiment manifest');
      }
      return `data:image/png;base64,${bytes.toString('base64')}`;
    }));
  }

  async openInteractive(experimentId: string): Promise<{ opened: true; processId: number }> {
    const experiment = this.list().find((entry) => entry.experimentId === experimentId);
    if (!experiment) throw new Error('Isaac experiment was not found');
    const environment = await this.environment();
    if (!environment.runtimeReady) throw new Error('Isaac Sim runtime is unavailable');
    const runtime = await locateIsaacRuntime(this.applicationRoot, this.userDataDirectory);
    if (!runtime) throw new Error('Configured Isaac Sim runtime disappeared');
    const requestPath = path.resolve(this.project.root, experiment.experimentRelativePath, 'request.json');
    if (!requestPath.startsWith(`${path.resolve(this.project.root)}${path.sep}`) || !(await exists(requestPath))) {
      throw new Error('Isaac experiment request is missing or outside the project');
    }
    const requestArtifact = experiment.artifacts.find((entry) => entry.role === 'request');
    if (!requestArtifact || await fileSha256(requestPath) !== requestArtifact.sha256) {
      throw new Error('Isaac experiment request hash no longer matches its manifest');
    }
    const child = spawn(runtime.python, [runtime.worker, 'view', '--request', requestPath], {
      windowsHide: true,
      shell: false,
      detached: true,
      env: {
        ...process.env,
        OMNI_KIT_ACCEPT_EULA: 'YES',
        PYTHONUNBUFFERED: '1',
      },
      stdio: 'ignore',
    });
    child.unref();
    if (!child.pid) throw new Error('Isaac Sim interactive viewer did not start');
    this.activities.record('simulation', 'isaac-interactive-opened', 'Opened retained experiment in interactive Isaac Sim', {
      experimentId,
      processId: child.pid,
    });
    return { opened: true, processId: child.pid };
  }
}
