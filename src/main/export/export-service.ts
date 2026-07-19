import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  copyFile,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import type {
  ExportCheck,
  ExportKind,
  ExportManifest,
  ExportResult,
  ReviewManifest,
  RobotGraph,
  ValidationRun,
} from '../../shared/contracts';
import {
  ExportCheckSchema,
  ExportManifestSchema,
  ExportResultSchema,
  ReviewManifestSchema,
  RobotGraphSchema,
} from '../../shared/contracts';
import { sha256 } from '../../shared/hash';
import { assertContract } from '../../shared/validation';
import type { SceneStateService } from '../bridge/scene-state';
import type { ActivityService } from '../domain/activity-service';
import type { ToolExecutor } from '../domain/tool-executor';
import type { ProjectHandle } from '../storage/project-repository';
import { locateUsdRuntime, runUsdWorker } from './usd-runtime';

export interface ExportProposal {
  exportId: string;
  kind: ExportKind;
  destination: string;
  overwrite: boolean;
  sceneRevision: number;
  robotId: string;
  planHash: string;
  toolId: 'export.package';
  args: Record<string, unknown>;
  summary: string;
}

export class ExportPolicyError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ExportPolicyError';
  }
}

export class ExportService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly scene: SceneStateService,
    private readonly executor: ToolExecutor,
    private readonly activities: ActivityService,
    private readonly applicationRoot: string,
    private readonly appVersion = '0.1.0',
  ) {}

  async propose(kind: ExportKind, destination: string, overwrite: boolean): Promise<ExportProposal> {
    const normalized = await this.validateDestination(kind, destination, overwrite);
    const { snapshot } = await this.scene.refresh();
    const validation = this.requirePassingValidation(snapshot.sceneRevision);
    const graph = this.requireRobotGraph();
    if (kind === 'canonical') this.requireCurrentReview(snapshot.sceneRevision, graph.robotId);
    const exportId = randomUUID();
    const stagingDirectory = path.join(this.project.root, '.simforge', 'export-staging', exportId);
    const args: Record<string, unknown> = {
      exportId,
      kind,
      robotId: graph.robotId,
      destination: normalized,
      overwrite,
      finalPackage: kind === 'canonical',
      validationRunId: validation.id,
      stagingDirectory,
    };
    return {
      exportId,
      kind,
      destination: normalized,
      overwrite,
      sceneRevision: snapshot.sceneRevision,
      robotId: graph.robotId,
      planHash: `export:${sha256(args)}`,
      toolId: 'export.package',
      args,
      summary: kind === 'quick'
        ? `Create one verified ${path.basename(normalized)} file after exact destination/overwrite approval.`
        : `Create, reopen, move-verify, and promote the canonical package at ${normalized}.`,
    };
  }

  async execute(proposal: ExportProposal, approvalId: string): Promise<ExportResult> {
    this.validateProposal(proposal);
    const { snapshot } = await this.scene.refresh();
    if (snapshot.sceneRevision !== proposal.sceneRevision) {
      throw new ExportPolicyError('STALE_EXPORT_PROPOSAL', 'Blender changed after export approval; create a fresh proposal');
    }
    const validation = this.requirePassingValidation(snapshot.sceneRevision);
    if (validation.id !== proposal.args.validationRunId) {
      throw new ExportPolicyError('VALIDATION_CHANGED', 'Export validation changed after approval');
    }
    const graph = this.requireRobotGraph();
    const execution = await this.executor.execute('export.package', proposal.args, {
      projectId: this.project.manifest.projectId,
      mode: this.project.repository.getMode(),
      planHash: proposal.planHash,
      planApproved: true,
      sceneRevision: snapshot.sceneRevision,
      approvalId,
      origin: 'general',
    });
    const bridgeResult = record(execution.result, 'Blender export result');
    const stagingRoot = path.resolve(String(proposal.args.stagingDirectory));
    const packageRoot = path.resolve(String(bridgeResult.packageRoot));
    this.assertWithin(path.resolve(this.project.root, '.simforge', 'export-staging'), stagingRoot);
    this.assertWithin(stagingRoot, packageRoot);
    await this.copySupplementalEvidence(packageRoot, snapshot.sceneRevision, graph.robotId);
    const runtime = await locateUsdRuntime(this.applicationRoot);
    const requestPath = path.join(stagingRoot, 'export-request.json');
    const quickOutput = path.join(stagingRoot, 'quick.usdc');
    const createdAt = new Date().toISOString();
    const request = {
      schemaVersion: 1,
      exportId: proposal.exportId,
      kind: proposal.kind,
      stagingRoot,
      packageRoot,
      quickOutput,
      appVersion: this.appVersion,
      createdAt,
      project: { id: this.project.manifest.projectId, name: this.project.manifest.name },
      sceneRevision: snapshot.sceneRevision,
      graph,
      sourceValidation: validation,
      limitations: [
        'Physical values marked ASSUMED are not measured hardware data.',
        'Primitive collision/contact checks are not simulator proof.',
        'Isaac Sim execution is a V2 extension and is not required for this export.',
      ],
    };
    await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    const authored = await runUsdWorker(runtime, ['export', '--request', requestPath]);
    const manifest = authored.manifest;
    assertContract<ExportManifest>(ExportManifestSchema, manifest, 'OpenUSD export manifest');
    if (manifest.exportId !== proposal.exportId || manifest.sceneRevision !== snapshot.sceneRevision) {
      throw new Error('OpenUSD manifest identity does not match the approved export');
    }
    const authoredPath = proposal.kind === 'quick' ? quickOutput : packageRoot;
    const promoted = await this.promoteAndVerify(
      authoredPath,
      proposal.destination,
      proposal.overwrite,
      proposal.exportId,
      runtime,
    );
    const checks = promoted.checks;
    const reportPaths = await this.persistReports(packageRoot, manifest, proposal.exportId);
    const completedAt = new Date().toISOString();
    const result: ExportResult = {
      exportId: proposal.exportId,
      kind: proposal.kind,
      destination: promoted.destination,
      sceneRevision: snapshot.sceneRevision,
      verified: true,
      checkpointId: execution.checkpointId,
      manifest,
      checks,
      machineResultsPath: reportPaths.machine,
      readinessReportPath: reportPaths.human,
      completedAt,
    };
    assertContract<ExportResult>(ExportResultSchema, result, 'verified export result');
    this.project.repository.saveProjectRecord({
      id: `export:${proposal.exportId}`,
      projectId: this.project.manifest.projectId,
      kind: 'export',
      body: { type: 'verified-usd-export', result },
      createdAt,
      updatedAt: completedAt,
    });
    this.activities.record('export', 'usd-export-verified', 'USD export reopened and verified', {
      exportId: proposal.exportId,
      kind: proposal.kind,
      destination: promoted.destination,
      sceneRevision: snapshot.sceneRevision,
      checkCount: checks.length,
      checkpointId: execution.checkpointId,
    });
    await rm(stagingRoot, { recursive: true, force: true });
    return result;
  }

  list(): ExportResult[] {
    return this.project.repository.listProjectRecords(this.project.manifest.projectId)
      .filter((entry) => entry.kind === 'export' && entry.body.type === 'verified-usd-export')
      .map((entry) => {
        assertContract<ExportResult>(ExportResultSchema, entry.body.result, 'stored export result');
        return entry.body.result;
      })
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  }

  private validateProposal(proposal: ExportProposal): void {
    if (!proposal || proposal.toolId !== 'export.package' || !proposal.exportId) {
      throw new ExportPolicyError('INVALID_EXPORT_PROPOSAL', 'Export proposal is invalid');
    }
    if (proposal.planHash !== `export:${sha256(proposal.args)}`) {
      throw new ExportPolicyError('EXPORT_PLAN_CHANGED', 'Export proposal no longer matches its approved action');
    }
    const scopeMatches = proposal.args.exportId === proposal.exportId
      && proposal.args.kind === proposal.kind
      && proposal.args.destination === proposal.destination
      && proposal.args.overwrite === proposal.overwrite
      && proposal.args.robotId === proposal.robotId
      && proposal.args.finalPackage === (proposal.kind === 'canonical')
      && proposal.args.stagingDirectory === path.join(
        this.project.root,
        '.simforge',
        'export-staging',
        proposal.exportId,
      );
    if (!scopeMatches) {
      throw new ExportPolicyError('EXPORT_SCOPE_CHANGED', 'Export identity, kind, destination, or overwrite scope changed');
    }
  }

  private requirePassingValidation(sceneRevision: number): ValidationRun {
    const latest = this.project.repository.latestValidationRun(this.project.manifest.projectId);
    if (!latest || latest.sceneRevision !== sceneRevision) {
      throw new ExportPolicyError('FRESH_VALIDATION_REQUIRED', 'Run deterministic validation for the current Blender revision');
    }
    if (!latest.channels.includes('deterministic-robotics')) {
      throw new ExportPolicyError('ROBOTICS_VALIDATION_REQUIRED', 'Robotics validation is required before export');
    }
    if (latest.summary.blocker + latest.summary.error > 0) {
      throw new ExportPolicyError('BLOCKING_FINDINGS', 'Resolve deterministic blockers/errors before export');
    }
    return latest;
  }

  private requireRobotGraph(): RobotGraph {
    const entry = this.project.repository.listProjectRecords(this.project.manifest.projectId)
      .toReversed()
      .find((candidate) => candidate.kind === 'asset' && candidate.body.type === 'robot-graph');
    if (!entry) throw new ExportPolicyError('ROBOT_GRAPH_REQUIRED', 'A validated RobotGraph is required before export');
    assertContract<RobotGraph>(RobotGraphSchema, entry.body.graph, 'stored RobotGraph');
    return entry.body.graph;
  }

  private requireCurrentReview(sceneRevision: number, robotId: string): ReviewManifest {
    const review = this.findCurrentReview(sceneRevision, robotId);
    if (review) return review;
    throw new ExportPolicyError('CURRENT_REVIEW_REQUIRED', 'Render a materialized review for the current Blender revision');
  }

  private findCurrentReview(sceneRevision: number, robotId: string): ReviewManifest | null {
    const reviews = this.project.repository.listProjectRecords(this.project.manifest.projectId)
      .filter((candidate) => candidate.kind === 'validation' && candidate.body.type === 'materialized-review')
      .reverse();
    for (const entry of reviews) {
      assertContract<ReviewManifest>(ReviewManifestSchema, entry.body.manifest, 'stored review manifest');
      if (entry.body.manifest.sceneRevision === sceneRevision && entry.body.manifest.robotId === robotId) {
        return entry.body.manifest;
      }
    }
    return null;
  }

  private async copySupplementalEvidence(packageRoot: string, sceneRevision: number, robotId: string): Promise<void> {
    const sourceRoot = path.join(packageRoot, 'source');
    const validationRoot = path.join(packageRoot, 'validation');
    await mkdir(validationRoot, { recursive: true });
    await copyFile(
      path.join(this.project.root, 'simforge.project.json'),
      path.join(sourceRoot, 'simforge.project.json'),
    );
    const scripts = path.join(this.project.root, 'scripts');
    if (await exists(scripts)) await this.copySafeTree(scripts, path.join(sourceRoot, 'scripts'));
    await writeFile(
      path.join(sourceRoot, 'actions.json'),
      `${JSON.stringify({ schemaVersion: 1, activities: this.activities.list(500) }, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    const noticeSource = path.join(this.applicationRoot, 'THIRD_PARTY_NOTICES.md');
    if (await exists(noticeSource)) {
      await copyFile(noticeSource, path.join(packageRoot, 'THIRD_PARTY_NOTICES.md'));
    } else {
      await writeFile(
        path.join(packageRoot, 'THIRD_PARTY_NOTICES.md'),
        '# Third-Party Notices\n\nSee the SimForge distribution notices. No external asset is embedded.\n',
        { encoding: 'utf8', flag: 'wx' },
      );
    }
    const review = this.findCurrentReview(sceneRevision, robotId);
    if (!review) return;
    const previewRoot = path.join(validationRoot, 'preview-images');
    await mkdir(previewRoot, { recursive: true });
    for (const image of review.images) {
      const source = path.resolve(this.project.root, ...image.relativePath.split('/'));
      this.assertWithin(path.resolve(this.project.root, 'previews'), source);
      const bytes = await readFile(source);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== image.sha256) throw new Error('Review image failed integrity verification during export');
      await writeFile(path.join(previewRoot, `${safeName(image.view)}.png`), bytes, { flag: 'wx' });
    }
    await writeFile(
      path.join(previewRoot, 'review-manifest.json'),
      `${JSON.stringify(review, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
  }

  private async persistReports(
    packageRoot: string,
    manifest: ExportManifest,
    exportId: string,
  ): Promise<{ machine: string; human: string }> {
    const reportRoot = path.join(this.project.root, 'reports', 'exports', exportId);
    await mkdir(reportRoot, { recursive: true });
    await copyFile(
      path.join(packageRoot, 'validation', 'validation-results.json'),
      path.join(reportRoot, 'validation-results.json'),
    );
    await copyFile(
      path.join(packageRoot, 'validation', 'readiness-report.md'),
      path.join(reportRoot, 'readiness-report.md'),
    );
    await writeFile(
      path.join(reportRoot, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    return {
      machine: path.relative(this.project.root, path.join(reportRoot, 'validation-results.json')).replaceAll('\\', '/'),
      human: path.relative(this.project.root, path.join(reportRoot, 'readiness-report.md')).replaceAll('\\', '/'),
    };
  }

  private parseChecks(value: unknown): ExportCheck[] {
    if (!Array.isArray(value)) throw new Error('OpenUSD verification checks are missing');
    return value.map((entry) => {
      assertContract<ExportCheck>(ExportCheckSchema, entry, 'OpenUSD verification check');
      return entry;
    });
  }

  private async promoteAndVerify(
    source: string,
    destination: string,
    overwrite: boolean,
    exportId: string,
    runtime: Awaited<ReturnType<typeof locateUsdRuntime>>,
  ): Promise<{ destination: string; checks: ExportCheck[] }> {
    const destinationPath = path.resolve(destination);
    const sourceIsDirectory = (await stat(source)).isDirectory();
    const suffix = sourceIsDirectory ? '' : '.usdc';
    const temporary = `${destinationPath}.simforge-${exportId}.tmp${suffix}`;
    const backup = `${destinationPath}.simforge-${exportId}.backup`;
    if (await exists(temporary) || await exists(backup)) {
      throw new Error('Export promotion workspace already exists');
    }
    const destinationExists = await exists(destinationPath);
    if (destinationExists && !overwrite) throw new ExportPolicyError('OVERWRITE_APPROVAL_REQUIRED', 'Destination already exists');
    if (destinationExists) {
      const destinationIsDirectory = (await stat(destinationPath)).isDirectory();
      if (destinationIsDirectory !== sourceIsDirectory) {
        throw new ExportPolicyError('DESTINATION_TYPE_MISMATCH', 'Destination type changed after export approval');
      }
    }
    if (sourceIsDirectory) await cp(source, temporary, { recursive: true, errorOnExist: true });
    else await copyFile(source, temporary, 0);
    try {
      const stagedVerification = await runUsdWorker(runtime, ['verify', '--path', temporary]);
      if (this.parseChecks(stagedVerification.checks).some((check) => check.status === 'FAIL')) {
        throw new Error('Staged USD artifact failed deterministic reopen verification');
      }
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
    let backupCreated = false;
    let promoted = false;
    try {
      if (destinationExists) {
        await rename(destinationPath, backup);
        backupCreated = true;
      }
      await rename(temporary, destinationPath);
      promoted = true;
      const verification = await runUsdWorker(runtime, ['verify', '--path', destinationPath]);
      const checks = this.parseChecks(verification.checks);
      if (checks.some((check) => check.status === 'FAIL')) {
        throw new Error('Promoted USD artifact failed deterministic reopen verification');
      }
      if (backupCreated) await rm(backup, { recursive: true, force: true });
      return { destination: destinationPath, checks };
    } catch (error) {
      if (promoted && await exists(destinationPath)) {
        await rm(destinationPath, { recursive: true, force: true });
      }
      if (backupCreated && await exists(backup)) await rename(backup, destinationPath);
      if (await exists(temporary)) await rm(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  private async validateDestination(kind: ExportKind, destination: string, overwrite: boolean): Promise<string> {
    if (!['quick', 'canonical'].includes(kind) || typeof destination !== 'string' || !path.isAbsolute(destination)) {
      throw new ExportPolicyError('INVALID_DESTINATION', 'Choose an absolute local export destination');
    }
    const resolved = path.resolve(destination);
    if (resolved === path.parse(resolved).root || resolved.startsWith('\\\\')) {
      throw new ExportPolicyError('UNSAFE_DESTINATION', 'Drive roots and network paths are not export destinations');
    }
    if (kind === 'quick' && path.extname(resolved).toLowerCase() !== '.usdc') {
      throw new ExportPolicyError('QUICK_EXTENSION_REQUIRED', 'Quick export destination must end in .usdc');
    }
    const present = await exists(resolved);
    if (present && !overwrite) {
      throw new ExportPolicyError('OVERWRITE_APPROVAL_REQUIRED', 'Destination exists; explicitly enable overwrite');
    }
    if (present) {
      const info = await stat(resolved);
      if (kind === 'quick' && !info.isFile()) throw new ExportPolicyError('DESTINATION_TYPE_MISMATCH', 'Quick export requires a file destination');
      if (kind === 'canonical' && !info.isDirectory()) throw new ExportPolicyError('DESTINATION_TYPE_MISMATCH', 'Canonical export requires a directory destination');
    }
    await mkdir(path.dirname(resolved), { recursive: true });
    return resolved;
  }

  private async copySafeTree(source: string, destination: string): Promise<void> {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);
      const info = await lstat(from);
      if (info.isSymbolicLink()) throw new Error('Symlinks are not allowed in exported source scripts');
      if (info.isDirectory()) await this.copySafeTree(from, to);
      else if (info.isFile()) await copyFile(from, to);
    }
  }

  private assertWithin(root: string, candidate: string): void {
    const normalizedRoot = path.resolve(root);
    const normalizedCandidate = path.resolve(candidate);
    if (normalizedCandidate !== normalizedRoot && !normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error('Path escaped the approved export root');
    }
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value as Record<string, unknown>;
}

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'preview';
}
