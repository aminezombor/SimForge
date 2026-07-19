import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ActivityService } from '../../src/main/domain/activity-service';
import { GlobalRepository } from '../../src/main/storage/global-repository';
import { ProjectManager } from '../../src/main/storage/project-repository';
import { WorkspaceService } from '../../src/main/workspace/workspace-service';

const sandboxes: string[] = [];

afterEach(async () => {
  for (const sandbox of sandboxes.splice(0)) await rm(sandbox, { recursive: true, force: true });
});

async function fixture() {
  const sandbox = await import('node:fs/promises').then(({ mkdtemp }) =>
    mkdtemp(path.join(os.tmpdir(), 'simforge-workspace-')),
  );
  sandboxes.push(sandbox);
  const project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Workspace');
  const global = new GlobalRepository(path.join(sandbox, 'appdata'));
  const activities = new ActivityService(project.manifest.projectId, project.repository);
  return { sandbox, project, global, service: new WorkspaceService(project, global, activities) };
}

describe('MS6 project workspace', () => {
  it('persists searchable conversation lifecycle and exact branch cutoffs', async () => {
    const { project, global, service } = await fixture();
    const source = service.ensureInitialConversation();
    project.repository.addMessage({ id: 'm1', conversationId: source.id, role: 'user', parts: [{ type: 'text', text: 'first' }], createdAt: '2026-01-01T00:00:00.000Z' });
    project.repository.addMessage({ id: 'm2', conversationId: source.id, role: 'assistant', parts: [{ type: 'text', text: 'second' }], createdAt: '2026-01-01T00:00:01.000Z' });
    expect(service.renameConversation(source.id, 'Robot authoring').title).toBe('Robot authoring');
    expect(service.listConversations('robot')).toHaveLength(1);

    const throughFirst = service.branchConversation(source.id, 'm1');
    expect(project.repository.listMessages(throughFirst.id).map((message) => message.parts)).toEqual([
      [{ type: 'text', text: 'first' }],
    ]);
    const emptyBranch = service.branchConversation(source.id, null);
    expect(project.repository.listMessages(emptyBranch.id)).toEqual([]);
    expect(service.deleteConversation(emptyBranch.id).some((entry) => entry.id === emptyBranch.id)).toBe(false);
    global.close();
    project.repository.close();
  });

  it('imports bounded attachments with provenance and compacts without deleting messages', async () => {
    const { sandbox, project, global, service } = await fixture();
    const conversation = service.ensureInitialConversation();
    project.repository.addMessage({ id: 'message', conversationId: conversation.id, role: 'user', parts: [{ type: 'text', text: 'Keep this source message' }], createdAt: new Date().toISOString() });
    const source = path.join(sandbox, 'robot.json');
    await writeFile(source, '{"robot":true}\n', 'utf8');
    const [attachment] = await service.importAttachments(conversation.id, [source]);
    expect(attachment).toMatchObject({ conversationId: conversation.id, name: 'robot.json', mediaType: 'application/json' });
    expect(attachment?.relativePath).toMatch(/^references\/conversations\//);
    expect(attachment?.sha256).toMatch(/^[a-f0-9]{64}$/);
    const context = service.compact(conversation.id);
    expect(context.summary).toContain('retained messages');
    expect(project.repository.listMessages(conversation.id)).toHaveLength(1);
    expect(project.repository.listProjectRecords(project.manifest.projectId).some((record) => record.kind === 'memory')).toBe(true);
    global.close();
    project.repository.close();
  });

  it('persists explicit privacy controls, named versions, and unified timeline evidence', async () => {
    const { project, global, service } = await fixture();
    service.ensureInitialConversation();
    const settings = service.updateSettings({
      ...service.settings(),
      actionMode: 'autonomous',
      activeProvider: 'nvidia',
      activeModel: 'nvidia/nemotron-test',
      cloudProcessing: true,
      monthlyBudgetUsd: 15,
    });
    expect(settings).toMatchObject({ actionMode: 'autonomous', activeProvider: 'nvidia', cloudProcessing: true, monthlyBudgetUsd: 15 });
    expect(() => service.updateSettings({ ...settings, actionMode: 'unbounded' as never })).toThrow('action mode');
    await mkdir(path.join(project.root, 'checkpoints', 'cp'), { recursive: true });
    project.repository.saveCheckpoint({
      id: 'cp', projectId: project.manifest.projectId, label: 'Before correction', sceneRevision: 9,
      blenderPath: 'checkpoints/cp/scene.blend', manifest: {}, createdAt: '2026-01-01T00:00:00.000Z',
    });
    const version = service.createVersion('Stable robot', 'cp');
    expect(version).toMatchObject({ name: 'Stable robot', checkpointId: 'cp', sceneRevision: 9 });
    const branch = service.createVersion('Sensor branch', 'cp', version.id);
    expect(branch).toMatchObject({ branchOf: version.id, checkpointId: 'cp', sceneRevision: 9 });
    expect(service.timeline([]).map((entry) => entry.kind)).toEqual(expect.arrayContaining(['activity', 'checkpoint', 'version']));
    global.close();
    project.repository.close();
  });

  it('compacts dispatch context automatically while retaining source messages', async () => {
    const { project, global, service } = await fixture();
    const conversation = service.ensureInitialConversation();
    for (let index = 0; index < 180; index += 1) {
      project.repository.addMessage({
        id: `long-${index}`,
        conversationId: conversation.id,
        role: index % 2 === 0 ? 'user' : 'assistant',
        parts: [{ type: 'text', text: `${index}:${'context '.repeat(180)}` }],
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      });
    }
    expect(service.context(conversation.id).percentUsed).toBeGreaterThanOrEqual(80);
    const compacted = service.autoCompactIfNeeded(conversation.id);
    expect(compacted.compactedAt).not.toBeNull();
    expect(service.dispatchMessages(conversation.id)[0]).toMatchObject({ role: 'system' });
    expect(project.repository.listMessages(conversation.id)).toHaveLength(180);
    expect(service.context(conversation.id).percentUsed).toBeLessThan(10);
    global.close();
    project.repository.close();
  });

  it('supports inspectable editable scoped memory, export, deletion, and usage totals', async () => {
    const { sandbox, project, global, service } = await fixture();
    service.ensureInitialConversation();
    const projectMemory = service.saveMemory('project', 'Units', 'Use meters and Z-up.');
    const globalMemory = service.saveMemory('global', 'Tone', 'Keep explanations concise.');
    expect(service.saveMemory('project', 'Units', 'Use meters, Z-up, and X-forward.', projectMemory.id).content)
      .toContain('X-forward');
    expect(service.listMemories('global')).toEqual([globalMemory]);
    expect(JSON.stringify(service.dispatchMessages(service.ensureInitialConversation().id))).toContain('X-forward');
    expect(JSON.stringify(service.dispatchMessages(service.ensureInitialConversation().id))).not.toContain('Keep explanations concise');
    service.updateSettings({ ...service.settings(), globalMemory: true });
    expect(JSON.stringify(service.dispatchMessages(service.ensureInitialConversation().id))).toContain('Keep explanations concise');
    const exportPath = path.join(sandbox, 'project-memory.json');
    await service.exportMemories('project', exportPath);
    expect(await import('node:fs/promises').then(({ readFile }) => readFile(exportPath, 'utf8')))
      .toContain('Use meters, Z-up, and X-forward.');
    const projectExport = path.join(sandbox, 'portable-project-copy');
    await service.exportProject(projectExport);
    expect(await import('node:fs/promises').then(({ readFile }) => readFile(path.join(projectExport, 'PROJECT_EXPORT.json'), 'utf8')))
      .toContain('"includesProviderCredentials": false');
    const reopened = await new ProjectManager().open(projectExport);
    expect(reopened.repository.listProjectRecords(reopened.manifest.projectId).some((record) => record.id === projectMemory.id)).toBe(true);
    expect(JSON.stringify(reopened.repository.listProjectRecords(reopened.manifest.projectId))).not.toContain('Keep explanations concise.');
    reopened.repository.close();
    const syntheticSecret = ['sk', 'this-is-a-synthetic-secret-value-123456'].join('-');
    expect(() => service.saveMemory('project', 'Secret', syntheticSecret)).toThrow('secret');
    expect(service.deleteMemory('global', globalMemory.id)).toEqual([]);
    project.repository.saveProjectRecord({
      id: 'usage-test', projectId: project.manifest.projectId, kind: 'usage',
      body: { type: 'provider-usage', usage: { inputTokens: 12, outputTokens: 7 }, costUsd: null },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    expect(service.usageSummary()).toMatchObject({ inputTokens: 12, outputTokens: 7, unpricedRequests: 1, requestCount: 1 });
    global.close();
    project.repository.close();
  });
});
