import { copyFile, mkdir, readFile, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JobOrchestrator } from '../../src/main/domain/job-orchestrator';
import { GlobalRepository } from '../../src/main/storage/global-repository';
import { ProjectManager } from '../../src/main/storage/project-repository';

const sandboxes: string[] = [];

afterEach(async () => {
  for (const sandbox of sandboxes.splice(0)) {
    await rm(sandbox, { recursive: true, force: true });
  }
});

describe('portable project persistence', () => {
  it('keeps a global project index separate from portable project databases', async () => {
    const sandbox = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp(path.join(os.tmpdir(), 'simforge-global-')),
    );
    sandboxes.push(sandbox);
    const global = new GlobalRepository(path.join(sandbox, 'appdata'));
    global.registerProject({ projectId: 'one', name: 'One', root: path.join(sandbox, 'one'), lastOpenedAt: '2026-01-01T00:00:00.000Z' });
    global.registerProject({ projectId: 'two', name: 'Two', root: path.join(sandbox, 'two'), lastOpenedAt: '2026-01-02T00:00:00.000Z' });
    global.setState('provider:nvidia:models', [{ modelId: 'runtime-model' }]);
    global.close();
    const reopened = new GlobalRepository(path.join(sandbox, 'appdata'));
    expect(reopened.listProjects().map((project) => project.projectId)).toEqual(['two', 'one']);
    expect(reopened.getState<Array<{ modelId: string }>>('provider:nvidia:models'))
      .toEqual([{ modelId: 'runtime-model' }]);
    reopened.close();
  });

  it('moves and reopens provider-neutral project records and messages', async () => {
    const sandbox = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp(path.join(os.tmpdir(), 'simforge-portable-')),
    );
    sandboxes.push(sandbox);
    const manager = new ProjectManager();
    const original = path.join(sandbox, 'original');
    const moved = path.join(sandbox, 'moved');
    const project = await manager.create(original, 'Portable robot');
    const now = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: 'brief-1',
      projectId: project.manifest.projectId,
      kind: 'brief',
      body: { goal: 'robot', providerNeutral: true },
      createdAt: now,
      updatedAt: now,
    });
    const durableArtifactKinds = ['blender-source', 'script', 'action', 'validation'] as const;
    for (const kind of durableArtifactKinds) {
      project.repository.saveProjectRecord({
        id: `${kind}-1`,
        projectId: project.manifest.projectId,
        kind,
        body: { fixture: kind },
        createdAt: now,
        updatedAt: now,
      });
    }
    project.repository.saveSceneSnapshot({
      protocolVersion: 1,
      projectId: project.manifest.projectId,
      sceneRevision: 7,
      sceneName: 'Persisted scene',
      blenderFile: 'scene/main.blend',
      capturedAt: now,
      unitSystem: 'METRIC',
      unitScale: 1,
      lengthUnit: 'METERS',
      upAxis: 'Z',
      externalFiles: [],
      objects: [],
    }, 'bridge');
    project.repository.saveConversation({
      id: 'conversation-1',
      projectId: project.manifest.projectId,
      title: 'Build robot',
      createdAt: now,
      updatedAt: now,
    });
    project.repository.addMessage({
      id: 'message-1',
      conversationId: 'conversation-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Create a safe plan' }],
      createdAt: now,
    });
    project.repository.close();
    await rename(original, moved);
    const reopened = await manager.open(moved);
    const records = reopened.repository.listProjectRecords(reopened.manifest.projectId);
    expect(records.find((record) => record.kind === 'brief')?.body)
      .toEqual({ goal: 'robot', providerNeutral: true });
    expect(records.map((record) => record.kind)).toEqual(expect.arrayContaining([...durableArtifactKinds]));
    expect(reopened.repository.latestSceneSnapshot(reopened.manifest.projectId)).toMatchObject({
      sceneRevision: 7,
      sceneName: 'Persisted scene',
    });
    expect(reopened.repository.listMessages('conversation-1')[0]?.parts)
      .toEqual([{ type: 'text', text: 'Create a safe plan' }]);
    expect(await readFile(path.join(moved, 'simforge.project.json'), 'utf8')).not.toContain('api-key');
    reopened.repository.close();
  });

  it('creates a consistent SQLite backup that can recover state', async () => {
    const sandbox = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp(path.join(os.tmpdir(), 'simforge-backup-')),
    );
    sandboxes.push(sandbox);
    const manager = new ProjectManager();
    const root = path.join(sandbox, 'project');
    const project = await manager.create(root, 'Recoverable');
    project.repository.setMode('build');
    const backupDirectory = path.join(root, 'reports', 'backups');
    await mkdir(backupDirectory, { recursive: true });
    const backup = path.join(backupDirectory, 'project.sqlite');
    project.repository.backupTo(backup);
    project.repository.setMode('plan');
    project.repository.close();
    await copyFile(backup, path.join(root, '.simforge', 'project.sqlite'));
    const recovered = await manager.open(root);
    expect(recovered.repository.getMode()).toBe('build');
    recovered.repository.close();
  });
});

describe('persistent goal jobs', () => {
  it('enforces plan hashes and persists pause, retry, rewind, branch, and restart', async () => {
    const sandbox = await import('node:fs/promises').then(({ mkdtemp }) =>
      mkdtemp(path.join(os.tmpdir(), 'simforge-job-')),
    );
    sandboxes.push(sandbox);
    const manager = new ProjectManager();
    const root = path.join(sandbox, 'project');
    const project = await manager.create(root, 'Jobs');
    const jobs = new JobOrchestrator(project.manifest.projectId, project.repository);
    const created = jobs.create('Build safely', [
      { id: 'inspect', description: 'Inspect' },
      { id: 'act', description: 'Act' },
    ]);
    expect(() => jobs.approvePlan(created.job.id, 'changed')).toThrow('Plan hash changed');
    jobs.approvePlan(created.job.id, created.job.planHash);
    jobs.start(created.job.id);
    project.repository.saveConversation({
      id: 'concurrent-chat',
      projectId: project.manifest.projectId,
      title: 'Chat while running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    project.repository.addMessage({
      id: 'concurrent-message',
      conversationId: 'concurrent-chat',
      role: 'user',
      parts: [{ type: 'text', text: 'Status?' }],
      createdAt: new Date().toISOString(),
    });
    expect(jobs.get(created.job.id).job.status).toBe('running');
    jobs.pause(created.job.id);
    jobs.start(created.job.id);
    await jobs.runNext(created.job.id, async () => Promise.resolve());
    const failed = await jobs.runNext(created.job.id, async () => {
      await Promise.resolve();
      throw new Error('deterministic failure');
    });
    expect(failed.job.status).toBe('failed');
    jobs.retry(created.job.id);
    jobs.start(created.job.id);
    await jobs.runNext(created.job.id, async () => Promise.resolve());
    jobs.rewind(created.job.id, 1);
    const branch = jobs.branch(created.job.id);
    expect(branch.job.branchOf).toBe(created.job.id);
    jobs.approvePlan(branch.job.id, branch.job.planHash);
    jobs.start(branch.job.id);
    expect(jobs.cancel(branch.job.id).job.status).toBe('cancelled');
    project.repository.close();

    const reopened = await manager.open(root);
    const restored = new JobOrchestrator(reopened.manifest.projectId, reopened.repository).get(created.job.id);
    expect(restored.job.status).toBe('ready');
    expect(restored.job.currentTaskIndex).toBe(1);
    reopened.repository.close();
  });
});
