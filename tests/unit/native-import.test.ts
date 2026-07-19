import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NativeImportService } from '../../src/main/import/native-import-service';
import { ProjectManager, type ProjectHandle } from '../../src/main/storage/project-repository';

let sandbox: string | null = null;
let project: ProjectHandle | null = null;

afterEach(async () => {
  project?.repository.close();
  project = null;
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
  sandbox = null;
});

describe('native 3D import quarantine', () => {
  it('copies, hashes, exact-binds, stages, and decides a self-contained OBJ', async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-native-import-'));
    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Native Import');
    const source = path.join(sandbox, 'triangle.obj');
    await writeFile(source, 'o Triangle\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n', 'utf8');
    const service = new NativeImportService(project);
    const proposal = await service.prepare(source);
    expect(proposal.report.status).toBe('COPIED');
    expect(proposal.report.source).toMatchObject({ format: 'OBJ', name: 'triangle.obj' });
    expect(proposal.report.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(proposal.args.sourcePath).toContain(path.join('references', 'imports', proposal.report.importId));
    expect(() => service.validateProposal(proposal)).not.toThrow();
    expect(() => service.validateProposal({
      ...proposal,
      args: { ...proposal.args, sourceSha256: '0'.repeat(64) },
    })).toThrow(/exact staged action/i);

    const staged = service.markStaged(proposal.report, {
      objectCount: 1,
      changedEntityIds: [`native-import:${proposal.report.importId}:0000`],
      warnings: [],
    }, 2);
    expect(staged).toMatchObject({ status: 'STAGED', objectCount: 1, sceneRevision: 2 });
    const decision = service.decisionProposal(staged.importId, true);
    expect(decision.toolId).toBe('import.accept_native');
    expect(() => service.validateDecisionProposal(decision)).not.toThrow();
    const accepted = service.markDecision(staged, true, 3);
    expect(accepted.status).toBe('ACCEPTED');
    expect(service.list()).toEqual([accepted]);
  });

  it('rejects external references, unsupported types, and malformed staging results', async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-native-security-'));
    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Native Security');
    const service = new NativeImportService(project);
    const obj = path.join(sandbox, 'external.obj');
    await writeFile(obj, 'mtllib remote.mtl\nv 0 0 0\n', 'utf8');
    await expect(service.prepare(obj)).rejects.toThrow(/external material libraries/i);
    const gltf = path.join(sandbox, 'remote.gltf');
    await writeFile(gltf, JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'https://example.invalid/model.bin', byteLength: 4 }] }), 'utf8');
    await expect(service.prepare(gltf)).rejects.toThrow(/external or remote URI/i);
    const usda = path.join(sandbox, 'referenced.usda');
    await writeFile(usda, '#usda 1.0\ndef Xform "Root" (references = @../outside.usda@) {}\n', 'utf8');
    await expect(service.prepare(usda)).rejects.toThrow(/external asset references/i);
    const script = path.join(sandbox, 'unsafe.py');
    await writeFile(script, 'print("no")', 'utf8');
    await expect(service.prepare(script)).rejects.toThrow(/unsupported native import extension/i);

    const safe = path.join(sandbox, 'safe.stl');
    await writeFile(safe, 'solid safe\nendsolid safe\n', 'utf8');
    const proposal = await service.prepare(safe);
    expect(() => service.markStaged(proposal.report, {
      objectCount: 2,
      changedEntityIds: ['one'],
      warnings: [],
    }, 1)).toThrow(/inconsistent/i);
  });
});
