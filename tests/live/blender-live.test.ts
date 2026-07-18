import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BlenderBridgeServer } from '../../src/main/bridge/blender-bridge';
import { SceneStateService } from '../../src/main/bridge/scene-state';
import { ActivityService } from '../../src/main/domain/activity-service';
import { AiToolCoordinator } from '../../src/main/domain/ai-tool-coordinator';
import { ApprovedScriptArchive } from '../../src/main/domain/approved-script-archive';
import { ApprovalService } from '../../src/main/domain/approval-service';
import { CheckpointService } from '../../src/main/domain/checkpoint-service';
import { ToolExecutor } from '../../src/main/domain/tool-executor';
import { MockProviderAdapter } from '../../src/main/providers/mock-provider';
import { ProjectManager, type ProjectHandle } from '../../src/main/storage/project-repository';
import type { BridgeEvent } from '../../src/shared/contracts';
import { sha256Text } from '../../src/shared/hash';

const blenderPath = process.env.SIMFORGE_BLENDER_PATH;
const liveDescribe = blenderPath ? describe : describe.skip;
let sandbox: string | null = null;
let project: ProjectHandle | null = null;
let server: BlenderBridgeServer | null = null;
const children: ChildProcessWithoutNullStreams[] = [];

function withTimeout<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
    }),
  ]);
}

function startBlender(localAppData: string, control: string, blendFile?: string): ChildProcessWithoutNullStreams {
  if (!blenderPath) throw new Error('SIMFORGE_BLENDER_PATH is missing');
  const args = ['--background'];
  if (blendFile) args.push(blendFile);
  else args.push('--factory-startup');
  args.push(
    '--python', path.resolve('tests/blender/bridge_fixture.py'),
    '--', '--control', control,
  );
  const child = spawn(blenderPath, args, {
    env: {
      ...process.env,
      LOCALAPPDATA: localAppData,
      SIMFORGE_EXTENSION_ROOT: path.resolve('blender-extension'),
      PYTHONUTF8: '1',
    },
    windowsHide: true,
  });
  children.push(child);
  return child;
}

afterEach(async () => {
  for (const child of children.splice(0)) if (!child.killed && child.exitCode === null) child.kill();
  await server?.stop();
  server = null;
  project?.repository.close();
  project = null;
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
  sandbox = null;
});

liveDescribe('real Blender 4.5 LTS acceptance', () => {
  it('connects, checkpoints, mutates, detects manual edits, rejects stale work, and recovers', async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-real-blender-'));
    const localAppData = path.join(sandbox, 'localappdata');
    const runtime = path.join(localAppData, 'SimForge', 'runtime');
    const control = path.join(sandbox, 'control');
    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Real Blender');
    server = new BlenderBridgeServer();
    await server.start(runtime, project.manifest.projectId, project.root);
    const firstConnected = once(server, 'connected');
    const firstBlender = startBlender(localAppData, control);
    await withTimeout(firstConnected, 20_000, 'initial Blender connection');

    const scene = new SceneStateService(project.manifest.projectId, server, project.repository);
    const activities = new ActivityService(project.manifest.projectId, project.repository);
    const approvals = new ApprovalService(project.repository);
    const checkpoints = new CheckpointService(project, server);
    const executor = new ToolExecutor(
      server,
      approvals,
      checkpoints,
      activities,
      new ApprovedScriptArchive(project),
    );
    const initial = await scene.refresh();
    expect(initial.snapshot.sceneRevision).toBe(0);

    await expect(executor.execute('object.create_primitive', {}, {
      projectId: project.manifest.projectId,
      mode: 'plan',
      planHash: 'plan',
      planApproved: true,
      sceneRevision: initial.snapshot.sceneRevision,
      approvalId: null,
    })).rejects.toMatchObject({ code: 'MODE_DENIED' });
    const afterPlanRead = await scene.refresh();
    expect(afterPlanRead.snapshot.sceneRevision).toBe(0);

    await new AiToolCoordinator().run(
      new MockProviderAdapter(),
      null,
      {
        requestId: 'real-ai-slice',
        modelId: 'mock-planner',
        purpose: 'Real Blender AI-to-tool acceptance',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Create a visible cube' }] }],
        tools: [{ name: 'object.create_primitive', description: 'Create cube', inputSchema: {} }],
      },
      new Set(['object.create_primitive']),
      (name, args) => executor.execute(name, {
        ...args, primitive: 'CUBE', name: 'Real SimForge Cube', location: [0, 0, 1],
      }, {
        projectId: project!.manifest.projectId,
        mode: 'build',
        planHash: 'plan',
        planApproved: true,
        sceneRevision: 0,
        approvalId: null,
      }),
    );
    const afterCreate = await scene.refresh();
    expect(afterCreate.snapshot.sceneRevision).toBeGreaterThan(0);
    expect(afterCreate.snapshot.objects.some((object) => object.name === 'Real SimForge Cube')).toBe(true);

    const staleRevision = afterCreate.snapshot.sceneRevision;
    const manualEventPromise = once(server, 'scene-event');
    await writeFile(path.join(control, 'manual-edit.request'), 'edit', 'utf8');
    const eventValues = await withTimeout(
      manualEventPromise as Promise<unknown[]>,
      20_000,
      'manual edit event',
    );
    const event = eventValues[0] as BridgeEvent;
    expect(event.summary).toBe('Manual Blender edit detected');
    const manualDiff = await scene.handleSceneEvent(event);
    expect(manualDiff?.added.some((object) => object.name === 'Manual Sphere')).toBe(true);
    await expect(server.request('object.create_primitive', { primitive: 'CUBE' }, staleRevision))
      .rejects.toMatchObject({ code: 'STALE_SCENE' });

    const recovery = await checkpoints.create('Recovery after manual edit', scene.current!.sceneRevision);
    expect(await readFile(path.join(recovery.directory, 'checkpoint.json'), 'utf8')).toContain('Recovery after manual edit');

    const firstDisconnected = once(server, 'disconnected');
    const firstExit = once(firstBlender, 'exit');
    firstBlender.kill();
    await withTimeout(firstExit, 20_000, 'first Blender exit');
    await withTimeout(firstDisconnected, 10_000, 'first Blender disconnect');

    const reconnectControl = path.join(sandbox, 'reconnect-control');
    const reconnected = once(server, 'connected');
    const secondBlender = startBlender(localAppData, reconnectControl, recovery.blenderPath);
    await withTimeout(reconnected, 20_000, 'Blender reconnect');
    const recovered = await scene.refresh();
    expect(recovered.snapshot.sceneRevision).toBeGreaterThanOrEqual(event.sceneRevision);
    expect(recovered.snapshot.objects.some((object) => object.name === 'Manual Sphere')).toBe(true);

    const rejectedScript = "bpy.context.scene['should_not_run'] = True";
    const rejectedArgs = {
      intent: 'Path traversal security fixture',
      script: rejectedScript,
      scriptHash: sha256Text(rejectedScript),
      allowedPaths: [path.join(sandbox, 'outside-project')],
    };
    const rejectedApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: 'rejected-python-plan',
      toolId: 'python.execute',
      args: rejectedArgs,
      sceneRevision: recovered.snapshot.sceneRevision,
      risk: 'privileged',
    });
    await expect(executor.execute('python.execute', rejectedArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: 'rejected-python-plan',
      planApproved: true,
      sceneRevision: recovered.snapshot.sceneRevision,
      approvalId: rejectedApproval,
    })).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });

    const failingScript = "raise RuntimeError('approved fixture failure')";
    const failingArgs = {
      intent: 'Prove approved Python failure remains recoverable',
      script: failingScript,
      scriptHash: sha256Text(failingScript),
      allowedPaths: [project.root],
    };
    const failingApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: 'failing-python-plan',
      toolId: 'python.execute',
      args: failingArgs,
      sceneRevision: recovered.snapshot.sceneRevision,
      risk: 'privileged',
    });
    await expect(executor.execute('python.execute', failingArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: 'failing-python-plan',
      planApproved: true,
      sceneRevision: recovered.snapshot.sceneRevision,
      approvalId: failingApproval,
    })).rejects.toMatchObject({ code: 'BLENDER_OPERATION_FAILED' });
    expect((await scene.refresh()).snapshot.objects.some((object) => object.name === 'Manual Sphere')).toBe(true);

    const script = "obj = bpy.data.objects.new('Approved Python Object', None); bpy.context.collection.objects.link(obj)";
    const pythonArgs = {
      intent: 'Create one named empty object after explicit approval',
      script,
      scriptHash: sha256Text(script),
      allowedPaths: [project.root],
    };
    const approvalId = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: 'python-plan',
      toolId: 'python.execute',
      args: pythonArgs,
      sceneRevision: recovered.snapshot.sceneRevision,
      risk: 'privileged',
    });
    await executor.execute('python.execute', pythonArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: 'python-plan',
      planApproved: true,
      sceneRevision: recovered.snapshot.sceneRevision,
      approvalId,
    });
    const inspected = await scene.refresh();
    expect(inspected.snapshot.sceneRevision).toBeGreaterThan(recovered.snapshot.sceneRevision);
    expect(inspected.snapshot.objects.some((object) => object.name === 'Approved Python Object')).toBe(true);

    const finalExit = once(secondBlender, 'exit');
    await writeFile(path.join(reconnectControl, 'stop.request'), 'stop', 'utf8');
    await withTimeout(finalExit, 20_000, 'second Blender exit');
  }, 90_000);
});
