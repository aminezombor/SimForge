import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NativeImportReport } from '../../shared/contracts';
import { NativeImportReportSchema } from '../../shared/contracts';
import { sha256 } from '../../shared/hash';
import { assertContract } from '../../shared/validation';
import type { ProjectHandle } from '../storage/project-repository';
import { locateUsdRuntime, runUsdWorker } from '../export/usd-runtime';

const MAX_NATIVE_BYTES = 512 * 1024 * 1024;
const FORMAT_BY_EXTENSION = new Map<string, NativeImportReport['source']['format']>([
  ['.blend', 'BLEND'],
  ['.usd', 'USD'],
  ['.usda', 'USD'],
  ['.usdc', 'USD'],
  ['.usdz', 'USD'],
  ['.glb', 'GLTF'],
  ['.gltf', 'GLTF'],
  ['.fbx', 'FBX'],
  ['.obj', 'OBJ'],
  ['.stl', 'STL'],
]);

export interface NativeImportProposal {
  planHash: string;
  toolId: 'import.stage_native';
  args: {
    importId: string;
    format: NativeImportReport['source']['format'];
    sourcePath: string;
    sourceSha256: string;
    collectionName: string;
  };
  report: NativeImportReport;
  summary: string;
}

export interface NativeImportDecisionProposal {
  planHash: string;
  toolId: 'import.accept_native' | 'import.reject_native';
  args: { importId: string; collectionName: string; reason: string };
  report: NativeImportReport;
  summary: string;
}

export class NativeImportService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly applicationRoot: string = process.cwd(),
  ) {}

  list(): NativeImportReport[] {
    const latest = new Map<string, NativeImportReport>();
    for (const record of this.project.repository.listProjectRecords(this.project.manifest.projectId)) {
      if (record.kind !== 'asset' || record.body.type !== 'native-import-report') continue;
      assertContract<NativeImportReport>(NativeImportReportSchema, record.body.report, 'stored native import report');
      const current = latest.get(record.body.report.importId);
      if (!current || record.body.report.updatedAt > current.updatedAt) {
        latest.set(record.body.report.importId, record.body.report);
      }
    }
    return [...latest.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  get(importId: string): NativeImportReport {
    const report = this.list().find((candidate) => candidate.importId === importId);
    if (!report) throw new Error('Native import report was not found');
    return report;
  }

  async prepare(sourcePath: string): Promise<NativeImportProposal> {
    if (!path.isAbsolute(sourcePath) || sourcePath.startsWith('\\\\')) {
      throw new Error('Native imports require an absolute local file path');
    }
    const resolved = path.resolve(sourcePath);
    const stats = await lstat(resolved);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('Native import source must be a regular non-symlink file');
    if (stats.size <= 0 || stats.size > MAX_NATIVE_BYTES) throw new Error('Native import source is empty or exceeds the 512 MiB staging limit');
    const extension = path.extname(resolved).toLowerCase();
    const format = FORMAT_BY_EXTENSION.get(extension);
    if (!format) throw new Error(`Unsupported native import extension: ${extension || '(none)'}`);
    await this.preflight(resolved, extension);

    const importId = randomUUID();
    const stageRoot = path.resolve(this.project.root, 'references', 'imports', importId);
    this.assertWithin(this.project.root, stageRoot);
    await mkdir(stageRoot, { recursive: true });
    const safeFileName = `source${extension}`;
    const stagedPath = path.join(stageRoot, safeFileName);
    await copyFile(resolved, stagedPath);
    const digest = await fileSha256(stagedPath);
    const now = new Date().toISOString();
    const report: NativeImportReport = {
      schemaVersion: 1,
      importId,
      projectId: this.project.manifest.projectId,
      status: 'COPIED',
      source: {
        name: path.basename(resolved),
        format,
        sha256: digest,
        bytes: stats.size,
        stagedRelativePath: projectRelative(this.project.root, stagedPath),
        licenseNote: 'User-provided local file; SimForge grants no redistribution rights.',
      },
      collectionName: `SF Staging - ${importId.slice(0, 8)} - ${format}`,
      objectCount: 0,
      entityIds: [],
      conversions: [`Copied ${format} source into the portable project quarantine before Blender access.`],
      warnings: ['License and redistribution rights remain the user’s responsibility.'],
      sceneRevision: null,
      createdAt: now,
      updatedAt: now,
    };
    this.save(report);
    const args = {
      importId,
      format,
      sourcePath: stagedPath,
      sourceSha256: digest,
      collectionName: report.collectionName,
    };
    return {
      planHash: sha256({ toolId: 'import.stage_native', args }),
      toolId: 'import.stage_native',
      args,
      report,
      summary: `Stage one hash-verified ${format} file in an isolated Blender collection; no external references or code execution permitted.`,
    };
  }

  validateProposal(proposal: NativeImportProposal): void {
    assertContract<NativeImportReport>(NativeImportReportSchema, proposal.report, 'native import proposal report');
    if (proposal.toolId !== 'import.stage_native' || proposal.planHash !== sha256({ toolId: proposal.toolId, args: proposal.args })) {
      throw new Error('Native import proposal no longer matches its exact staged action');
    }
    if (
      proposal.report.status !== 'COPIED' ||
      proposal.args.importId !== proposal.report.importId ||
      proposal.args.format !== proposal.report.source.format ||
      proposal.args.sourceSha256 !== proposal.report.source.sha256 ||
      proposal.args.collectionName !== proposal.report.collectionName
    ) throw new Error('Native import proposal scope changed');
    const expected = path.resolve(this.project.root, ...proposal.report.source.stagedRelativePath.split('/'));
    this.assertWithin(path.resolve(this.project.root, 'references', 'imports'), expected);
    if (path.resolve(proposal.args.sourcePath) !== expected) throw new Error('Native import staged path changed');
  }

  markStaged(
    report: NativeImportReport,
    result: unknown,
    sceneRevision: number,
  ): NativeImportReport {
    const value = record(result, 'native Blender import result');
    const entityIds = stringArray(value.changedEntityIds, 'native imported entity IDs');
    const objectCount = integer(value.objectCount, 'native imported object count');
    if (objectCount !== entityIds.length || objectCount <= 0) throw new Error('Native import result object count is inconsistent');
    const updated: NativeImportReport = {
      ...report,
      status: 'STAGED',
      objectCount,
      entityIds,
      sceneRevision,
      conversions: [...report.conversions, `Blender ${report.source.format} importer created ${objectCount} staged objects.`],
      warnings: [...report.warnings, ...stringArray(value.warnings ?? [], 'native import warnings')],
      updatedAt: new Date().toISOString(),
    };
    this.save(updated);
    return updated;
  }

  decisionProposal(importId: string, accept: boolean): NativeImportDecisionProposal {
    const report = this.get(importId);
    if (report.status !== 'STAGED') throw new Error('Only a staged native import can be accepted or rejected');
    const toolId = accept ? 'import.accept_native' as const : 'import.reject_native' as const;
    const reason = accept
      ? 'Accept the inspected staged objects into the project scene.'
      : 'Reject and remove the inspected staged objects while retaining the source/report for audit.';
    const args = { importId, collectionName: report.collectionName, reason };
    return {
      planHash: sha256({ toolId, args }),
      toolId,
      args,
      report,
      summary: accept ? `Accept ${report.objectCount} inspected ${report.source.format} objects.` : `Remove ${report.objectCount} staged objects; retain the quarantined source and report.`,
    };
  }

  validateDecisionProposal(proposal: NativeImportDecisionProposal): void {
    assertContract<NativeImportReport>(NativeImportReportSchema, proposal.report, 'native import decision report');
    if (
      !['import.accept_native', 'import.reject_native'].includes(proposal.toolId) ||
      proposal.planHash !== sha256({ toolId: proposal.toolId, args: proposal.args }) ||
      proposal.report.status !== 'STAGED' ||
      proposal.args.importId !== proposal.report.importId ||
      proposal.args.collectionName !== proposal.report.collectionName
    ) throw new Error('Native import decision no longer matches the exact staged objects');
    const latest = this.get(proposal.report.importId);
    if (latest.status !== 'STAGED' || latest.updatedAt !== proposal.report.updatedAt) {
      throw new Error('Native import decision is stale');
    }
  }

  markDecision(report: NativeImportReport, accepted: boolean, sceneRevision: number): NativeImportReport {
    const updated: NativeImportReport = {
      ...report,
      status: accepted ? 'ACCEPTED' : 'REJECTED',
      collectionName: accepted ? `SF Import - ${report.importId.slice(0, 8)}` : report.collectionName,
      sceneRevision,
      updatedAt: new Date().toISOString(),
    };
    this.save(updated);
    return updated;
  }

  private save(report: NativeImportReport): void {
    assertContract<NativeImportReport>(NativeImportReportSchema, report, 'native import report');
    this.project.repository.saveProjectRecord({
      id: `native-import-report:${report.importId}:${report.status}:${report.updatedAt}`,
      projectId: this.project.manifest.projectId,
      kind: 'asset',
      body: { type: 'native-import-report', report },
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    });
  }

  private async preflight(file: string, extension: string): Promise<void> {
    if (extension === '.gltf') {
      const source = JSON.parse(await readFile(file, 'utf8')) as unknown;
      const root = record(source, 'glTF document');
      for (const key of ['buffers', 'images']) {
        const entries = Array.isArray(root[key]) ? root[key] : [];
        for (const entry of entries) {
          const uri = record(entry, `glTF ${key} entry`).uri;
          if (typeof uri === 'string' && !uri.startsWith('data:')) {
            throw new Error('Standalone glTF staging rejects external or remote URI references; use embedded glTF/GLB');
          }
        }
      }
    }
    if (extension === '.obj') {
      const text = await readFile(file, 'utf8');
      if (/^\s*mtllib\s+/im.test(text)) throw new Error('Standalone OBJ staging rejects external material libraries; embed or remove them first');
    }
    if (extension === '.usda') {
      const text = await readFile(file, 'utf8');
      if (/@[^@]+@/.test(text)) throw new Error('Standalone USDA staging rejects external asset references');
    }
    if (['.usd', '.usda', '.usdc', '.usdz'].includes(extension)) {
      const runtime = await locateUsdRuntime(this.applicationRoot);
      const dependencies = await runUsdWorker(runtime, ['dependencies', '--path', file]);
      const layers = stringArray(dependencies.layers, 'USD dependency layers');
      const assets = stringArray(dependencies.assets, 'USD dependency assets');
      const unresolved = stringArray(dependencies.unresolved, 'USD unresolved dependencies');
      const root = path.resolve(file).replaceAll('\\', '/').toLowerCase();
      const externalLayers = layers.filter((entry) => {
        const normalized = path.resolve(entry).replaceAll('\\', '/').toLowerCase();
        return normalized !== root && !normalized.startsWith(`${root}[`);
      });
      const externalAssets = assets.filter((entry) => {
        const normalized = entry.replaceAll('\\', '/').toLowerCase();
        return !normalized.startsWith(`${root}[`);
      });
      if (unresolved.length || externalLayers.length || externalAssets.length) {
        throw new Error('Standalone USD staging rejects external or unresolved layer/asset dependencies');
      }
    }
  }

  private assertWithin(root: string, candidate: string): void {
    const normalizedRoot = path.resolve(root);
    const normalizedCandidate = path.resolve(candidate);
    if (normalizedCandidate !== normalizedRoot && !normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error('Native import path escaped its approved root');
    }
  }
}

async function fileSha256(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

function projectRelative(root: string, file: string): string {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Native import path is not project-contained');
  return relative.replaceAll('\\', '/');
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry)) throw new Error(`${name} are invalid`);
  return value as string[];
}

function integer(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`${name} is invalid`);
  return Number(value);
}
