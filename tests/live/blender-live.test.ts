import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
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
import { ExportService } from '../../src/main/export/export-service';
import { locateUsdRuntime, runUsdWorker } from '../../src/main/export/usd-runtime';
import {
  createIsaacStabilityCorrectionProposal,
  IsaacExperimentService,
} from '../../src/main/isaac/isaac-service';
import { UrdfImportService } from '../../src/main/import/urdf-import-service';
import { NativeImportService } from '../../src/main/import/native-import-service';
import { MockProviderAdapter } from '../../src/main/providers/mock-provider';
import { PreviewService } from '../../src/main/preview/preview-service';
import { primitiveWheeledRobotGraph } from '../../src/main/robotics/primitive-wheeled-robot';
import {
  warehouseEnvironmentGraph,
  warehouseMobileManipulatorGraph,
} from '../../src/main/robotics/warehouse-mobile-manipulator';
import { ReviewService } from '../../src/main/robotics/review-service';
import { ProjectManager, type ProjectHandle } from '../../src/main/storage/project-repository';
import { ValidationService } from '../../src/main/validation/validation-service';
import type { BridgeEvent } from '../../src/shared/contracts';
import { sha256, sha256Text } from '../../src/shared/hash';

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

function startBlender(
  localAppData: string,
  control: string,
  blendFile?: string,
  fixtureFlags: string[] = [],
): ChildProcessWithoutNullStreams {
  if (!blenderPath) throw new Error('SIMFORGE_BLENDER_PATH is missing');
  const args = ['--background'];
  if (blendFile) args.push(blendFile);
  else args.push('--factory-startup');
  args.push(
    '--python', path.resolve('tests/blender/bridge_fixture.py'),
    '--', '--control', control, ...fixtureFlags,
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
    const validation = new ValidationService(
      project,
      scene,
      executor,
      approvals,
      checkpoints,
      activities,
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
        ...args, primitive: 'CUBE', name: 'Real SimForge Cube', location: [0, 0, 2],
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

    const validationRun = await validation.run();
    const realCubeId = afterCreate.snapshot.objects.find((object) => object.name === 'Real SimForge Cube')!.id;
    const contactFinding = validationRun.findings.find((finding) => (
      finding.ruleId === 'GEO-CONTACT-001' &&
      finding.entityPath === `/objects/${realCubeId}`
    ));
    expect(contactFinding?.proposedFix).toMatchObject({
      fixClass: 'SAFE_LOCAL',
      toolId: 'object.set_location',
      reversible: true,
    });
    const correctedRun = await validation.applyFix(contactFinding!.id, null, null);
    expect(correctedRun.findings.some((finding) => (
      finding.ruleId === 'GEO-CONTACT-001' && finding.entityPath === contactFinding!.entityPath
    ))).toBe(false);
    const correctedCube = scene.current!.objects.find((object) => object.name === 'Real SimForge Cube');
    expect(correctedCube?.worldBounds?.min[2]).toBeCloseTo(0, 6);
    const undoneRun = await validation.undoLatestSafeFix();
    expect(undoneRun.findings.some((finding) => (
      finding.ruleId === 'GEO-CONTACT-001' && finding.entityPath === contactFinding!.entityPath
    ))).toBe(true);

    const staleRevision = scene.current!.sceneRevision;
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

    project.repository.setMode('build');
    const restorePlan = `restore:${recovery.id}`;
    const restoreApproval = validation.approveCheckpointRestore(recovery.id, restorePlan);
    const restoredRun = await validation.restoreCheckpoint(recovery.id, restorePlan, restoreApproval);
    expect(restoredRun.sceneRevision).toBeGreaterThan(inspected.snapshot.sceneRevision);
    expect(scene.current!.objects.some((object) => object.name === 'Manual Sphere')).toBe(true);
    expect(scene.current!.objects.some((object) => object.name === 'Approved Python Object')).toBe(false);
    expect(project.repository.listCheckpoints(project.manifest.projectId).length).toBeGreaterThanOrEqual(2);

    const finalExit = once(secondBlender, 'exit');
    await writeFile(path.join(reconnectControl, 'stop.request'), 'stop', 'utf8');
    await withTimeout(finalExit, 20_000, 'second Blender exit');
  }, 90_000);

  it('materializes, validates, reviews, corrects, and exports a primitive wheeled robot', async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-real-robot-'));
    const localAppData = path.join(sandbox, 'localappdata');
    const runtime = path.join(localAppData, 'SimForge', 'runtime');
    const control = path.join(sandbox, 'control');
    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Real Robot');
    project.repository.setMode('build');
    server = new BlenderBridgeServer();
    await server.start(runtime, project.manifest.projectId, project.root);
    const connected = once(server, 'connected');
    const blender = startBlender(localAppData, control, undefined, ['--empty-metric']);
    await withTimeout(connected, 20_000, 'robot Blender connection');

    const scene = new SceneStateService(project.manifest.projectId, server, project.repository);
    const activities = new ActivityService(project.manifest.projectId, project.repository);
    const approvals = new ApprovalService(project.repository);
    const checkpoints = new CheckpointService(project, server);
    const executor = new ToolExecutor(server, approvals, checkpoints, activities);
    const validation = new ValidationService(
      project,
      scene,
      executor,
      approvals,
      checkpoints,
      activities,
    );
    const reviews = new ReviewService(project, scene, executor, activities);
    const previews = new PreviewService(project, server, scene, activities);
    const initial = await scene.refresh();
    expect(initial.snapshot.objects).toEqual([]);
    expect(initial.snapshot.unitSystem).toBe('METRIC');

    const graph = primitiveWheeledRobotGraph();
    const buildArgs = { graph };
    const buildPlan = sha256({ toolId: 'robot.materialize', args: buildArgs });
    const buildApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: buildPlan,
      toolId: 'robot.materialize',
      args: buildArgs,
      sceneRevision: initial.snapshot.sceneRevision,
      risk: 'structural',
    });
    const build = await executor.execute('robot.materialize', buildArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: buildPlan,
      planApproved: true,
      sceneRevision: initial.snapshot.sceneRevision,
      approvalId: buildApproval,
    });
    const now = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `robot-graph:${graph.robotId}:${build.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: { type: 'robot-graph', graph, materialization: build.result },
      createdAt: now,
      updatedAt: now,
    });
    const passing = await validation.run();
    const roboticsFindings = passing.findings.filter((finding) => finding.ruleId.startsWith('ROB-'));
    expect(roboticsFindings.some((finding) => ['blocker', 'error'].includes(finding.severity))).toBe(false);
    expect(passing.channels).toContain('deterministic-robotics');
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'link')).toHaveLength(4);
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'joint')).toHaveLength(3);
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'collision')).toHaveLength(4);
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'sensor')).toHaveLength(2);

    const builtPreview = await previews.generate();
    expect(builtPreview.sceneRevision).toBe(passing.sceneRevision);
    expect(builtPreview.objects.length).toBeGreaterThan(0);
    expect(builtPreview.relativePath).toMatch(/^previews\/live\/scene-r\d+-[a-f0-9-]+\.glb$/);
    expect(await previews.data(builtPreview.previewId)).toMatch(/^data:model\/gltf-binary;base64,/);
    expect(await previews.selectObject(builtPreview.previewId, builtPreview.objects[0]!.id))
      .toBe(builtPreview.objects[0]!.id);

    const rightWheel = graph.links.find((link) => link.id === 'right_wheel_link')!;
    const defectArgs = {
      robotId: graph.robotId,
      linkId: rightWheel.id,
      position: [rightWheel.pose.position[0], rightWheel.pose.position[1], 0.52],
      rotationEuler: rightWheel.pose.rotationEuler,
      reason: 'Acceptance fixture: make one wheel visibly too high before correction',
    };
    const defectPlan = sha256({ toolId: 'robot.set_link_pose', args: defectArgs });
    const defectApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: defectPlan,
      toolId: 'robot.set_link_pose',
      args: defectArgs,
      sceneRevision: passing.sceneRevision,
      risk: 'structural',
    });
    await executor.execute('robot.set_link_pose', defectArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: defectPlan,
      planApproved: true,
      sceneRevision: passing.sceneRevision,
      approvalId: defectApproval,
    });
    const defective = await validation.run();
    expect(defective.sceneRevision).toBeGreaterThan(builtPreview.sceneRevision);
    await expect(previews.selectObject(builtPreview.previewId, builtPreview.objects[0]!.id))
      .rejects.toThrow('stale');
    expect(defective.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'ROB-LINK-POSE-001', severity: 'error' }),
    ]));
    const beforeReview = await reviews.render(graph.robotId, 'Before wheel correction');
    expect(beforeReview.images).toHaveLength(5);
    expect(beforeReview.materialized).toBe(true);
    expect(beforeReview.advisoryOnly).toBe(true);

    const correctionArgs = {
      robotId: graph.robotId,
      linkId: rightWheel.id,
      position: rightWheel.pose.position,
      rotationEuler: rightWheel.pose.rotationEuler,
      reason: 'Restore the exact approved RobotGraph wheel pose after deterministic finding',
    };
    const correctionPlan = sha256({ toolId: 'robot.set_link_pose', args: correctionArgs });
    const correctionApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: correctionPlan,
      toolId: 'robot.set_link_pose',
      args: correctionArgs,
      sceneRevision: defective.sceneRevision,
      risk: 'structural',
    });
    await executor.execute('robot.set_link_pose', correctionArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: correctionPlan,
      planApproved: true,
      sceneRevision: defective.sceneRevision,
      approvalId: correctionApproval,
    });
    const corrected = await validation.run();
    expect(corrected.findings.some((finding) => finding.ruleId === 'ROB-LINK-POSE-001')).toBe(false);
    const afterReview = await reviews.render(graph.robotId, 'After wheel correction');
    expect(reviews.list().slice(0, 2).map((entry) => entry.label)).toEqual([
      'After wheel correction', 'Before wheel correction',
    ]);
    expect(afterReview.images.map((image) => image.view)).toEqual([
      'three-quarter', 'front', 'side', 'close-up', 'sensor',
    ]);
    expect(await reviews.imageData(afterReview.reviewId, 'three-quarter'))
      .toMatch(/^data:image\/png;base64,/);
    const correctedPreview = await previews.generate();
    expect(correctedPreview.sceneRevision).toBe(corrected.sceneRevision);
    expect(correctedPreview.sha256).toMatch(/^[a-f0-9]{64}$/);
    const evidenceDirectory = process.env.SIMFORGE_MS4_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      const beforeImage = beforeReview.images.find((image) => image.view === 'three-quarter')!;
      const afterImage = afterReview.images.find((image) => image.view === 'three-quarter')!;
      const sensorImage = afterReview.images.find((image) => image.view === 'sensor')!;
      await Promise.all([
        copyFile(path.join(project.root, ...beforeImage.relativePath.split('/')), path.join(evidenceDirectory, 'before-wheel-correction.png')),
        copyFile(path.join(project.root, ...afterImage.relativePath.split('/')), path.join(evidenceDirectory, 'after-wheel-correction.png')),
        copyFile(path.join(project.root, ...sensorImage.relativePath.split('/')), path.join(evidenceDirectory, 'sensor-view.png')),
        writeFile(path.join(evidenceDirectory, 'evidence.json'), `${JSON.stringify({
          robotId: graph.robotId,
          before: { sceneRevision: beforeReview.sceneRevision, sha256: beforeImage.sha256 },
          after: { sceneRevision: afterReview.sceneRevision, sha256: afterImage.sha256 },
          sensor: { sceneRevision: afterReview.sceneRevision, sha256: sensorImage.sha256 },
          materialized: true,
          advisoryOnly: true,
        }, null, 2)}\n`, 'utf8'),
      ]);
    }
    expect((await scene.refresh()).snapshot.objects.some((object) => object.name.startsWith('SF Review'))).toBe(false);
    expect(project.repository.listCheckpoints(project.manifest.projectId).length).toBeGreaterThanOrEqual(3);

    const exportService = new ExportService(project, scene, executor, activities, process.cwd());
    const quickDestination = path.join(sandbox, 'verified-quick.usdc');
    const quickProposal = await exportService.propose('quick', quickDestination, false);
    await expect(exportService.execute({ ...quickProposal, kind: 'canonical' }, 'missing-approval'))
      .rejects.toMatchObject({ code: 'EXPORT_SCOPE_CHANGED' });
    await expect(exportService.execute(quickProposal, 'missing-approval')).rejects.toMatchObject({
      code: 'APPROVAL_INVALID',
    });
    await expect(access(quickDestination)).rejects.toBeDefined();
    const quickApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: quickProposal.planHash,
      toolId: quickProposal.toolId,
      args: quickProposal.args,
      sceneRevision: quickProposal.sceneRevision,
      risk: 'structural',
    });
    const quickResult = await exportService.execute(quickProposal, quickApproval);
    expect(quickResult.verified).toBe(true);
    expect(quickResult.kind).toBe('quick');
    expect(quickResult.checks.every((check) => check.status !== 'FAIL')).toBe(true);
    await expect(access(quickDestination)).resolves.toBeUndefined();
    await expect(exportService.propose('quick', quickDestination, false)).rejects.toMatchObject({
      code: 'OVERWRITE_APPROVAL_REQUIRED',
    });
    const overwriteProposal = await exportService.propose('quick', quickDestination, true);
    const overwriteApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: overwriteProposal.planHash,
      toolId: overwriteProposal.toolId,
      args: overwriteProposal.args,
      sceneRevision: overwriteProposal.sceneRevision,
      risk: 'structural',
    });
    expect((await exportService.execute(overwriteProposal, overwriteApproval)).verified).toBe(true);

    const canonicalDestination = path.join(sandbox, 'canonical-package');
    const canonicalProposal = await exportService.propose('canonical', canonicalDestination, false);
    const canonicalApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: canonicalProposal.planHash,
      toolId: canonicalProposal.toolId,
      args: canonicalProposal.args,
      sceneRevision: canonicalProposal.sceneRevision,
      risk: 'structural',
    });
    const canonical = await exportService.execute(canonicalProposal, canonicalApproval);
    expect(canonical.verified).toBe(true);
    expect(canonical.manifest.files.every((file) => !path.isAbsolute(file.path) && !file.path.includes('..'))).toBe(true);
    for (const relative of [
      'scene.usda',
      'robot/robot.usda',
      'robot/geometry/robot_geometry.usdc',
      'robot/materials/robot_materials.usda',
      'robot/physics/robot_physics.usda',
      'robot/sensors/robot_sensors.usda',
      'environment/environment.usda',
      'source/project.blend',
      'validation/validation-results.json',
      'validation/readiness-report.md',
      'manifest.json',
      'THIRD_PARTY_NOTICES.md',
    ]) await expect(access(path.join(canonicalDestination, ...relative.split('/')))).resolves.toBeUndefined();
    const machine = JSON.parse(await readFile(
      path.join(canonicalDestination, 'validation', 'validation-results.json'),
      'utf8',
    )) as { usdChecks: Array<{ id: string; status: string }> };
    const report = await readFile(path.join(canonicalDestination, 'validation', 'readiness-report.md'), 'utf8');
    expect(machine.usdChecks.map((check) => check.id)).toEqual(
      canonical.manifest.validation.checks.map((check) => check.id),
    );
    for (const check of machine.usdChecks) expect(report).toContain(`\`${check.id}\`: **${check.status}**`);
    const movedDestination = path.join(sandbox, 'moved-canonical-package');
    await rename(canonicalDestination, movedDestination);
    const usdRuntime = await locateUsdRuntime(process.cwd());
    const movedVerification = await runUsdWorker(usdRuntime, ['verify', '--path', movedDestination]);
    expect(movedVerification.ok).toBe(true);
    const ms5Evidence = process.env.SIMFORGE_MS5_EVIDENCE_DIR;
    if (ms5Evidence) {
      await mkdir(ms5Evidence, { recursive: true });
      await Promise.all([
        copyFile(path.join(movedDestination, 'manifest.json'), path.join(ms5Evidence, 'manifest.json')),
        copyFile(path.join(movedDestination, 'validation', 'validation-results.json'), path.join(ms5Evidence, 'validation-results.json')),
        copyFile(path.join(movedDestination, 'validation', 'readiness-report.md'), path.join(ms5Evidence, 'readiness-report.md')),
        writeFile(path.join(ms5Evidence, 'acceptance.json'), `${JSON.stringify({
          quick: { verified: quickResult.verified, checks: quickResult.checks },
          canonical: {
            exportId: canonical.exportId,
            sceneRevision: canonical.sceneRevision,
            checks: canonical.checks,
            movedReopen: movedVerification.ok,
          },
        }, null, 2)}\n`, 'utf8'),
      ]);
    }

    const exit = once(blender, 'exit');
    await writeFile(path.join(control, 'stop.request'), 'stop', 'utf8');
    await withTimeout(exit, 20_000, 'robot Blender exit');
  }, 120_000);

  it('materializes, corrects, reviews, and exports the warehouse mobile manipulator assembly', async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-real-warehouse-'));
    const localAppData = path.join(sandbox, 'localappdata');
    const runtime = path.join(localAppData, 'SimForge', 'runtime');
    const control = path.join(sandbox, 'control');
    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Warehouse Manipulator');
    project.repository.setMode('build');
    server = new BlenderBridgeServer();
    await server.start(runtime, project.manifest.projectId, project.root);
    const connected = once(server, 'connected');
    const blender = startBlender(localAppData, control, undefined, ['--empty-metric']);
    await withTimeout(connected, 20_000, 'warehouse Blender connection');

    const scene = new SceneStateService(project.manifest.projectId, server, project.repository);
    const activities = new ActivityService(project.manifest.projectId, project.repository);
    const approvals = new ApprovalService(project.repository);
    const checkpoints = new CheckpointService(project, server);
    const executor = new ToolExecutor(server, approvals, checkpoints, activities);
    const validation = new ValidationService(project, scene, executor, approvals, checkpoints, activities);
    const reviews = new ReviewService(project, scene, executor, activities);
    const previews = new PreviewService(project, server, scene, activities);
    const initial = await scene.refresh();
    expect(initial.snapshot.objects).toEqual([]);

    const robot = warehouseMobileManipulatorGraph();
    const environment = warehouseEnvironmentGraph();
    const buildArgs = { robotGraph: robot, environmentGraph: environment };
    const buildPlan = sha256({ toolId: 'scene.materialize_assembly', args: buildArgs });
    const buildApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: buildPlan,
      toolId: 'scene.materialize_assembly',
      args: buildArgs,
      sceneRevision: initial.snapshot.sceneRevision,
      risk: 'structural',
    });
    const build = await executor.execute('scene.materialize_assembly', buildArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: buildPlan,
      planApproved: true,
      sceneRevision: initial.snapshot.sceneRevision,
      approvalId: buildApproval,
    });
    const now = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `robot-graph:${robot.robotId}:${build.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: { type: 'robot-graph', graph: robot, materialization: build.result },
      createdAt: now,
      updatedAt: now,
    });
    project.repository.saveProjectRecord({
      id: `environment-graph:${environment.environmentId}:${build.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: { type: 'environment-graph', graph: environment, materialization: build.result },
      createdAt: now,
      updatedAt: now,
    });

    const passing = await validation.run();
    expect(passing.channels).toEqual(expect.arrayContaining([
      'deterministic-robotics',
      'deterministic-environment',
    ]));
    expect(passing.findings.filter((finding) => ['blocker', 'error'].includes(finding.severity))).toEqual([]);
    const objects = scene.current!.objects;
    expect(objects.filter((object) => object.metadata['simforge.role'] === 'link')).toHaveLength(12);
    expect(objects.filter((object) => object.metadata['simforge.role'] === 'joint')).toHaveLength(11);
    expect(objects.filter((object) => object.metadata['simforge.role'] === 'collision')).toHaveLength(12);
    expect(objects.filter((object) => object.metadata['simforge.role'] === 'sensor')).toHaveLength(3);
    expect(objects.filter((object) => object.metadata['simforge.role'] === 'environment-object')).toHaveLength(15);
    expect(objects.filter((object) => object.metadata['simforge.role'] === 'environment-collision')).toHaveLength(15);

    const leftFinger = robot.links.find((link) => link.id === 'left_finger_link')!;
    const defectArgs = {
      robotId: robot.robotId,
      linkId: leftFinger.id,
      position: [leftFinger.pose.position[0], leftFinger.pose.position[1] + 0.22, leftFinger.pose.position[2]],
      rotationEuler: leftFinger.pose.rotationEuler,
      reason: 'Acceptance fixture: visibly separate the left gripper finger before deterministic correction',
    };
    const defectPlan = sha256({ toolId: 'robot.set_link_pose', args: defectArgs });
    const defectApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: defectPlan,
      toolId: 'robot.set_link_pose',
      args: defectArgs,
      sceneRevision: passing.sceneRevision,
      risk: 'structural',
    });
    await executor.execute('robot.set_link_pose', defectArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: defectPlan,
      planApproved: true,
      sceneRevision: passing.sceneRevision,
      approvalId: defectApproval,
    });
    const defective = await validation.run();
    expect(defective.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'ROB-LINK-POSE-001', severity: 'error' }),
    ]));
    const beforeReview = await reviews.render(robot.robotId, 'Before gripper correction', environment.environmentId);
    expect(beforeReview.environmentId).toBe(environment.environmentId);
    expect(beforeReview.images.map((image) => image.view)).toContain('warehouse-overview');

    const correctionArgs = {
      robotId: robot.robotId,
      linkId: leftFinger.id,
      position: leftFinger.pose.position,
      rotationEuler: leftFinger.pose.rotationEuler,
      reason: 'Restore the exact approved RobotGraph gripper pose after deterministic finding',
    };
    const correctionPlan = sha256({ toolId: 'robot.set_link_pose', args: correctionArgs });
    const correctionApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: correctionPlan,
      toolId: 'robot.set_link_pose',
      args: correctionArgs,
      sceneRevision: defective.sceneRevision,
      risk: 'structural',
    });
    await executor.execute('robot.set_link_pose', correctionArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: correctionPlan,
      planApproved: true,
      sceneRevision: defective.sceneRevision,
      approvalId: correctionApproval,
    });
    const corrected = await validation.run();
    expect(corrected.findings.some((finding) => finding.ruleId === 'ROB-LINK-POSE-001')).toBe(false);
    expect(corrected.findings.filter((finding) => ['blocker', 'error'].includes(finding.severity))).toEqual([]);
    const afterReview = await reviews.render(robot.robotId, 'After gripper correction', environment.environmentId);
    expect(afterReview.images).toHaveLength(6);
    const preview = await previews.generate();
    expect(preview.sceneRevision).toBe(corrected.sceneRevision);
    expect(preview.objects.length).toBeGreaterThanOrEqual(27);

    const canonicalDestination = path.join(sandbox, 'warehouse-canonical-package');
    const exportService = new ExportService(project, scene, executor, activities, process.cwd());
    const proposal = await exportService.propose('canonical', canonicalDestination, false);
    expect(proposal.environmentId).toBe(environment.environmentId);
    const exportApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: proposal.planHash,
      toolId: proposal.toolId,
      args: proposal.args,
      sceneRevision: proposal.sceneRevision,
      risk: 'structural',
    });
    const exported = await exportService.execute(proposal, exportApproval);
    expect(exported.verified).toBe(true);
    expect(exported.manifest.environmentId).toBe(environment.environmentId);
    expect(exported.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'USD-ENVIRONMENT-001', status: 'PASS' }),
    ]));
    await expect(access(path.join(canonicalDestination, 'environment', 'environment_geometry.usdc')))
      .resolves.toBeUndefined();

    let isaacFeedback: Record<string, unknown> | null = null;
    if (process.env.SIMFORGE_ISAAC_LIVE === '1' && process.env.SIMFORGE_ISAAC_PYTHON) {
      const isaac = new IsaacExperimentService(
        project,
        exportService,
        approvals,
        activities,
        process.cwd(),
        localAppData,
      );
      const beforeProposal = isaac.proposal();
      const beforeApproval = approvals.approve({
        projectId: project.manifest.projectId,
        planHash: beforeProposal.planHash,
        toolId: beforeProposal.toolId,
        args: beforeProposal.args,
        sceneRevision: beforeProposal.sceneRevision,
        risk: beforeProposal.risk,
      });
      const beforeExperiment = await isaac.execute(beforeProposal, beforeApproval);
      expect(beforeExperiment.status).toBe('FAILED');
      expect(beforeExperiment.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'ISAAC-STABILITY-001', status: 'FAIL' }),
      ]));
      const analysis = isaac.analysis(beforeExperiment.experimentId);
      expect(analysis.status).toBe('CORRECTION_PROPOSED');
      const correctionProposal = createIsaacStabilityCorrectionProposal(
        robot,
        environment,
        analysis,
        scene.current!.sceneRevision,
      );
      await expect(executor.execute(correctionProposal.toolId, correctionProposal.args, {
        projectId: project.manifest.projectId,
        mode: 'build',
        planHash: correctionProposal.planHash,
        planApproved: true,
        sceneRevision: correctionProposal.sceneRevision,
        approvalId: null,
      })).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
      const simulationCorrectionApproval = approvals.approve({
        projectId: project.manifest.projectId,
        planHash: correctionProposal.planHash,
        toolId: correctionProposal.toolId,
        args: correctionProposal.args,
        sceneRevision: correctionProposal.sceneRevision,
        risk: correctionProposal.risk,
      });
      const simulationCorrection = await executor.execute(
        correctionProposal.toolId,
        correctionProposal.args,
        {
          projectId: project.manifest.projectId,
          mode: 'build',
          planHash: correctionProposal.planHash,
          planApproved: true,
          sceneRevision: correctionProposal.sceneRevision,
          approvalId: simulationCorrectionApproval,
        },
      );
      const correctionTime = new Date().toISOString();
      project.repository.saveProjectRecord({
        id: `robot-graph:${robot.robotId}:${simulationCorrection.postRevision}`,
        projectId: project.manifest.projectId,
        kind: 'asset',
        body: { type: 'robot-graph', graph: correctionProposal.args.robotGraph, materialization: simulationCorrection.result },
        createdAt: correctionTime,
        updatedAt: correctionTime,
      });
      project.repository.saveProjectRecord({
        id: `environment-graph:${environment.environmentId}:${simulationCorrection.postRevision}`,
        projectId: project.manifest.projectId,
        kind: 'asset',
        body: { type: 'environment-graph', graph: environment, materialization: simulationCorrection.result },
        createdAt: correctionTime,
        updatedAt: correctionTime,
      });
      const simulationCorrectedValidation = await validation.run();
      expect(simulationCorrectedValidation.findings.filter((finding) => ['blocker', 'error'].includes(finding.severity))).toEqual([]);
      await reviews.render(robot.robotId, 'After Isaac stability correction', environment.environmentId);

      const correctedDestination = path.join(sandbox, 'warehouse-canonical-corrected');
      const correctedExportProposal = await exportService.propose('canonical', correctedDestination, false);
      const correctedExportApproval = approvals.approve({
        projectId: project.manifest.projectId,
        planHash: correctedExportProposal.planHash,
        toolId: correctedExportProposal.toolId,
        args: correctedExportProposal.args,
        sceneRevision: correctedExportProposal.sceneRevision,
        risk: 'structural',
      });
      const correctedExport = await exportService.execute(correctedExportProposal, correctedExportApproval);
      const afterProposal = isaac.proposal();
      expect(afterProposal.args.parentExperimentId).toBe(beforeExperiment.experimentId);
      expect(afterProposal.args.sourceExportId).toBe(correctedExport.exportId);
      const afterApproval = approvals.approve({
        projectId: project.manifest.projectId,
        planHash: afterProposal.planHash,
        toolId: afterProposal.toolId,
        args: afterProposal.args,
        sceneRevision: afterProposal.sceneRevision,
        risk: afterProposal.risk,
      });
      const afterExperiment = await isaac.execute(afterProposal, afterApproval);
      expect(afterExperiment.checks.filter((check) => check.status === 'FAIL')).toEqual([]);
      expect(afterExperiment.parentExperimentId).toBe(beforeExperiment.experimentId);
      expect(afterExperiment.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'ISAAC-STABILITY-001', status: 'PASS' }),
      ]));
      isaacFeedback = {
        beforeExperimentId: beforeExperiment.experimentId,
        beforeStatus: beforeExperiment.status,
        analysisStatus: analysis.status,
        correction: {
          rootLinkId: correctionProposal.args.rootLinkId,
          deltaXM: correctionProposal.args.deltaXM,
          checkpointId: simulationCorrection.checkpointId,
          sceneRevision: simulationCorrection.postRevision,
        },
        correctedExportId: correctedExport.exportId,
        afterExperimentId: afterExperiment.experimentId,
        afterStatus: afterExperiment.status,
        parentExperimentId: afterExperiment.parentExperimentId,
      };
      const evidenceDirectory = process.env.SIMFORGE_MS11B_EVIDENCE_DIR;
      if (evidenceDirectory) {
        await mkdir(evidenceDirectory, { recursive: true });
        await writeFile(path.join(evidenceDirectory, 'feedback-loop.json'), `${JSON.stringify(isaacFeedback, null, 2)}\n`, 'utf8');
        const beforeFinal = beforeExperiment.artifacts.filter((entry) => entry.role === 'image').at(-1);
        const afterFinal = afterExperiment.artifacts.filter((entry) => entry.role === 'image').at(-1);
        if (beforeFinal) await copyFile(path.join(project.root, ...beforeFinal.relativePath.split('/')), path.join(evidenceDirectory, 'before-simulation.png'));
        if (afterFinal) await copyFile(path.join(project.root, ...afterFinal.relativePath.split('/')), path.join(evidenceDirectory, 'after-simulation.png'));
      }
    }
    const movedDestination = path.join(sandbox, 'moved-warehouse-package');
    await rename(canonicalDestination, movedDestination);
    const usdRuntime = await locateUsdRuntime(process.cwd());
    const movedVerification = await runUsdWorker(usdRuntime, ['verify', '--path', movedDestination]);
    expect(movedVerification.ok).toBe(true);

    const evidenceDirectory = process.env.SIMFORGE_MS7_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      const beforeImage = beforeReview.images.find((image) => image.view === 'close-up')!;
      const afterImage = afterReview.images.find((image) => image.view === 'close-up')!;
      const overviewImage = afterReview.images.find((image) => image.view === 'warehouse-overview')!;
      await Promise.all([
        copyFile(path.join(project.root, ...beforeImage.relativePath.split('/')), path.join(evidenceDirectory, 'before-gripper-correction.png')),
        copyFile(path.join(project.root, ...afterImage.relativePath.split('/')), path.join(evidenceDirectory, 'after-gripper-correction.png')),
        copyFile(path.join(project.root, ...overviewImage.relativePath.split('/')), path.join(evidenceDirectory, 'warehouse-overview.png')),
        copyFile(path.join(movedDestination, 'manifest.json'), path.join(evidenceDirectory, 'manifest.json')),
        copyFile(path.join(movedDestination, 'validation', 'validation-results.json'), path.join(evidenceDirectory, 'validation-results.json')),
        copyFile(path.join(movedDestination, 'validation', 'readiness-report.md'), path.join(evidenceDirectory, 'readiness-report.md')),
        writeFile(path.join(evidenceDirectory, 'acceptance.json'), `${JSON.stringify({
          robotId: robot.robotId,
          environmentId: environment.environmentId,
          counts: { links: 12, joints: 11, sensors: 3, environmentObjects: 15 },
          defect: { ruleId: 'ROB-LINK-POSE-001', sceneRevision: defective.sceneRevision },
          correctedSceneRevision: corrected.sceneRevision,
          review: { before: beforeImage.sha256, after: afterImage.sha256, overview: overviewImage.sha256 },
          export: { exportId: exported.exportId, checks: exported.checks, movedReopen: movedVerification.ok },
          isaacFeedback,
        }, null, 2)}\n`, 'utf8'),
      ]);
    }

    const exit = once(blender, 'exit');
    await writeFile(path.join(control, 'stop.request'), 'stop', 'utf8');
    await withTimeout(exit, 20_000, 'warehouse Blender exit');
  }, 360_000);

  it('imports, meaningfully modifies, validates, reviews, and exports the licensed URDF robot', async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-real-import-'));
    const localAppData = path.join(sandbox, 'localappdata');
    const runtime = path.join(localAppData, 'SimForge', 'runtime');
    const control = path.join(sandbox, 'control');
    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Licensed Robot Import');
    project.repository.setMode('build');
    server = new BlenderBridgeServer();
    await server.start(runtime, project.manifest.projectId, project.root);
    const connected = once(server, 'connected');
    const blender = startBlender(localAppData, control, undefined, ['--empty-metric']);
    await withTimeout(connected, 20_000, 'import Blender connection');

    const scene = new SceneStateService(project.manifest.projectId, server, project.repository);
    const activities = new ActivityService(project.manifest.projectId, project.repository);
    const approvals = new ApprovalService(project.repository);
    const checkpoints = new CheckpointService(project, server);
    const executor = new ToolExecutor(server, approvals, checkpoints, activities);
    const validation = new ValidationService(project, scene, executor, approvals, checkpoints, activities);
    const reviews = new ReviewService(project, scene, executor, activities);
    const importer = new UrdfImportService(project, process.cwd());
    const staged = await importer.stageBundledSample();
    const graph = staged.robotGraph!;
    expect(staged.source.license).toBe('BSD-3-Clause');
    expect(staged.assets.every((asset) => asset.contained)).toBe(true);
    expect(graph.links).toHaveLength(16);
    expect(graph.joints).toHaveLength(15);

    const initial = await scene.refresh();
    const buildArgs = { graph };
    const buildPlan = sha256({ toolId: 'robot.materialize', args: buildArgs });
    const buildApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: buildPlan,
      toolId: 'robot.materialize',
      args: buildArgs,
      sceneRevision: initial.snapshot.sceneRevision,
      risk: 'structural',
    });
    const build = await executor.execute('robot.materialize', buildArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: buildPlan,
      planApproved: true,
      sceneRevision: initial.snapshot.sceneRevision,
      approvalId: buildApproval,
    });
    const builtAt = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `robot-graph:${graph.robotId}:${build.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: { type: 'robot-graph', graph, materialization: build.result },
      createdAt: builtAt,
      updatedAt: builtAt,
    });
    const materializedReport = importer.markMaterialized(staged, build.postRevision);
    const builtValidation = await validation.run();
    expect(builtValidation.findings.filter((finding) => ['blocker', 'error'].includes(finding.severity))).toEqual([]);
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'link')).toHaveLength(16);
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'joint')).toHaveLength(15);
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'collision')).toHaveLength(16);

    const head = graph.links.find((link) => link.id === 'head')!;
    const sensor = {
      id: 'simforge-inspection-camera',
      name: 'SimForge Forward Inspection Camera',
      type: 'CAMERA' as const,
      parentLinkId: head.id,
      pose: {
        position: [head.pose.position[0] + 0.18, head.pose.position[1], head.pose.position[2] + 0.03] as [number, number, number],
        rotationEuler: [0, 0, 0] as [number, number, number],
      },
      fieldOfViewDegrees: 68,
    };
    const material = graph.materials.find((candidate) => candidate.id === 'sensor-amber')!;
    const reason = 'Add a forward inspection camera to make the imported robot materially useful for visual inspection tasks.';
    const sensorArgs = { robotId: graph.robotId, sensor, material, reason };
    const sensorPlan = sha256({ toolId: 'robot.add_sensor', args: sensorArgs });
    await expect(executor.execute('robot.add_sensor', sensorArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: sensorPlan,
      planApproved: true,
      sceneRevision: builtValidation.sceneRevision,
      approvalId: null,
    })).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    const sensorApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: sensorPlan,
      toolId: 'robot.add_sensor',
      args: sensorArgs,
      sceneRevision: builtValidation.sceneRevision,
      risk: 'structural',
    });
    const added = await executor.execute('robot.add_sensor', sensorArgs, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: sensorPlan,
      planApproved: true,
      sceneRevision: builtValidation.sceneRevision,
      approvalId: sensorApproval,
    });
    const modifiedGraph = {
      ...graph,
      sensors: [...graph.sensors, sensor],
      assumptions: [...graph.assumptions, 'The added camera is user-approved SimForge metadata, not source URDF data.'],
    };
    const modifiedAt = new Date().toISOString();
    project.repository.saveProjectRecord({
      id: `robot-graph:${graph.robotId}:${added.postRevision}`,
      projectId: project.manifest.projectId,
      kind: 'asset',
      body: { type: 'robot-graph', graph: modifiedGraph, materialization: added.result },
      createdAt: modifiedAt,
      updatedAt: modifiedAt,
    });
    const modifiedReport = importer.markModified(
      materializedReport,
      modifiedGraph,
      added.postRevision,
      'Added one exact-approved forward inspection camera to the imported head link.',
    );
    const modifiedValidation = await validation.run();
    expect(modifiedValidation.findings.filter((finding) => ['blocker', 'error'].includes(finding.severity))).toEqual([]);
    expect(scene.current!.objects.filter((object) => object.metadata['simforge.role'] === 'sensor')).toHaveLength(1);
    expect(modifiedReport.status).toBe('MODIFIED');

    const review = await reviews.render(graph.robotId, 'Licensed imported robot with approved camera');
    expect(review.images.map((image) => image.view)).toEqual(expect.arrayContaining(['three-quarter', 'sensor']));
    const canonicalDestination = path.join(sandbox, 'imported-canonical-package');
    const exportService = new ExportService(project, scene, executor, activities, process.cwd());
    const proposal = await exportService.propose('canonical', canonicalDestination, false);
    const exportApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: proposal.planHash,
      toolId: proposal.toolId,
      args: proposal.args,
      sceneRevision: proposal.sceneRevision,
      risk: 'structural',
    });
    const exported = await exportService.execute(proposal, exportApproval);
    expect(exported.verified).toBe(true);
    expect(exported.checks.filter((check) => check.status === 'FAIL')).toEqual([]);
    await expect(access(path.join(canonicalDestination, 'validation', 'import-report.json'))).resolves.toBeUndefined();
    await expect(access(path.join(canonicalDestination, 'source', 'imports', staged.importId, 'LICENSE'))).resolves.toBeUndefined();
    const movedDestination = path.join(sandbox, 'moved-imported-package');
    await rename(canonicalDestination, movedDestination);
    const usdRuntime = await locateUsdRuntime(process.cwd());
    const movedVerification = await runUsdWorker(usdRuntime, ['verify', '--path', movedDestination]);
    expect(movedVerification.ok).toBe(true);

    const evidenceDirectory = process.env.SIMFORGE_MS8_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      const threeQuarter = review.images.find((image) => image.view === 'three-quarter')!;
      const sensorView = review.images.find((image) => image.view === 'sensor')!;
      await Promise.all([
        copyFile(path.join(project.root, ...threeQuarter.relativePath.split('/')), path.join(evidenceDirectory, 'imported-robot-three-quarter.png')),
        copyFile(path.join(project.root, ...sensorView.relativePath.split('/')), path.join(evidenceDirectory, 'imported-robot-sensor.png')),
        copyFile(path.join(movedDestination, 'manifest.json'), path.join(evidenceDirectory, 'manifest.json')),
        copyFile(path.join(movedDestination, 'validation', 'validation-results.json'), path.join(evidenceDirectory, 'validation-results.json')),
        copyFile(path.join(movedDestination, 'validation', 'import-report.json'), path.join(evidenceDirectory, 'import-report.json')),
        copyFile(path.join(movedDestination, 'validation', 'readiness-report.md'), path.join(evidenceDirectory, 'readiness-report.md')),
        writeFile(path.join(evidenceDirectory, 'acceptance.json'), `${JSON.stringify({
          importId: staged.importId,
          source: staged.source,
          counts: { links: modifiedGraph.links.length, joints: modifiedGraph.joints.length, collisions: modifiedGraph.links.filter((link) => link.collision).length, sensors: modifiedGraph.sensors.length },
          conversions: modifiedReport.conversions,
          losses: modifiedReport.losses,
          sceneRevision: modifiedValidation.sceneRevision,
          review: { threeQuarter: threeQuarter.sha256, sensor: sensorView.sha256 },
          export: { exportId: exported.exportId, checks: exported.checks, movedReopen: movedVerification.ok },
        }, null, 2)}\n`, 'utf8'),
      ]);
    }

    const exit = once(blender, 'exit');
    await writeFile(path.join(control, 'stop.request'), 'stop', 'utf8');
    await withTimeout(exit, 20_000, 'import Blender exit');
  }, 180_000);

  it('stages and exact-decides the Blender, USD, GLB, FBX, OBJ, and STL matrix', async () => {
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-real-native-matrix-'));
    const fixtureRoot = path.join(sandbox, 'fixtures');
    await mkdir(fixtureRoot, { recursive: true });
    if (!blenderPath) throw new Error('SIMFORGE_BLENDER_PATH is missing');
    const fixtureProcess = spawn(blenderPath, [
      '--background', '--factory-startup', '--python', path.resolve('tests/blender/create_native_import_fixtures.py'), '--', fixtureRoot,
    ], { env: { ...process.env, PYTHONUTF8: '1' }, windowsHide: true });
    children.push(fixtureProcess);
    const fixtureCode = await withTimeout(new Promise<number | null>((resolve, reject) => {
      fixtureProcess.once('error', reject);
      fixtureProcess.once('exit', resolve);
    }), 30_000, 'native fixture generation');
    expect(fixtureCode).toBe(0);

    const localAppData = path.join(sandbox, 'localappdata');
    const runtime = path.join(localAppData, 'SimForge', 'runtime');
    const control = path.join(sandbox, 'control');
    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Native Format Matrix');
    project.repository.setMode('build');
    server = new BlenderBridgeServer();
    await server.start(runtime, project.manifest.projectId, project.root);
    const connected = once(server, 'connected');
    const blender = startBlender(localAppData, control, undefined, ['--empty-metric']);
    await withTimeout(connected, 20_000, 'native matrix Blender connection');
    const scene = new SceneStateService(project.manifest.projectId, server, project.repository);
    const activities = new ActivityService(project.manifest.projectId, project.repository);
    const approvals = new ApprovalService(project.repository);
    const checkpoints = new CheckpointService(project, server);
    const executor = new ToolExecutor(server, approvals, checkpoints, activities);
    const importer = new NativeImportService(project);
    await scene.refresh();
    await expect(server.request('import.stage_native', {
      importId: 'outside-project-fixture',
      format: 'OBJ',
      sourcePath: path.join(fixtureRoot, 'fixture.obj'),
      sourceSha256: '0'.repeat(64),
      collectionName: 'SF Staging - outside',
    }, scene.current!.sceneRevision)).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });

    const matrix: Array<{ file: string; expected: string }> = [
      { file: 'fixture.blend', expected: 'BLEND' },
      { file: 'fixture.usdc', expected: 'USD' },
      { file: 'fixture.glb', expected: 'GLTF' },
      { file: 'fixture.fbx', expected: 'FBX' },
      { file: 'fixture.obj', expected: 'OBJ' },
      { file: 'fixture.stl', expected: 'STL' },
    ];
    const evidence: Array<Record<string, unknown>> = [];
    for (const entry of matrix) {
      const proposal = await importer.prepare(path.join(fixtureRoot, entry.file));
      expect(proposal.report.source.format).toBe(entry.expected);
      const current = (await scene.refresh()).snapshot;
      const approval = approvals.approve({
        projectId: project.manifest.projectId,
        planHash: proposal.planHash,
        toolId: proposal.toolId,
        args: proposal.args,
        sceneRevision: current.sceneRevision,
        risk: 'structural',
      });
      const execution = await executor.execute(proposal.toolId, proposal.args, {
        projectId: project.manifest.projectId,
        mode: 'build',
        planHash: proposal.planHash,
        planApproved: true,
        sceneRevision: current.sceneRevision,
        approvalId: approval,
      });
      const staged = importer.markStaged(proposal.report, execution.result, execution.postRevision);
      expect(staged.objectCount).toBeGreaterThan(0);
      const stagedSnapshot = (await scene.refresh()).snapshot;
      expect(staged.entityIds.every((id) => stagedSnapshot.objects.some((object) => object.id === id && object.metadata['simforge.role'] === 'import-staged'))).toBe(true);
      const decision = importer.decisionProposal(staged.importId, true);
      const decisionApproval = approvals.approve({
        projectId: project.manifest.projectId,
        planHash: decision.planHash,
        toolId: decision.toolId,
        args: decision.args,
        sceneRevision: stagedSnapshot.sceneRevision,
        risk: 'structural',
      });
      const acceptedExecution = await executor.execute(decision.toolId, decision.args, {
        projectId: project.manifest.projectId,
        mode: 'build',
        planHash: decision.planHash,
        planApproved: true,
        sceneRevision: stagedSnapshot.sceneRevision,
        approvalId: decisionApproval,
      });
      const accepted = importer.markDecision(staged, true, acceptedExecution.postRevision);
      expect(accepted.status).toBe('ACCEPTED');
      evidence.push({
        format: accepted.source.format,
        sourceSha256: accepted.source.sha256,
        bytes: accepted.source.bytes,
        objectCount: accepted.objectCount,
        stagedRevision: staged.sceneRevision,
        acceptedRevision: accepted.sceneRevision,
      });
    }

    const rejectionProposal = await importer.prepare(path.join(fixtureRoot, 'fixture.obj'));
    const beforeReject = (await scene.refresh()).snapshot;
    const rejectionStageApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: rejectionProposal.planHash,
      toolId: rejectionProposal.toolId,
      args: rejectionProposal.args,
      sceneRevision: beforeReject.sceneRevision,
      risk: 'structural',
    });
    const rejectionStage = await executor.execute(rejectionProposal.toolId, rejectionProposal.args, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: rejectionProposal.planHash,
      planApproved: true,
      sceneRevision: beforeReject.sceneRevision,
      approvalId: rejectionStageApproval,
    });
    const stagedForRejection = importer.markStaged(rejectionProposal.report, rejectionStage.result, rejectionStage.postRevision);
    const rejectProposal = importer.decisionProposal(stagedForRejection.importId, false);
    const rejectApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: rejectProposal.planHash,
      toolId: rejectProposal.toolId,
      args: rejectProposal.args,
      sceneRevision: stagedForRejection.sceneRevision!,
      risk: 'destructive',
    });
    const rejectedExecution = await executor.execute(rejectProposal.toolId, rejectProposal.args, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: rejectProposal.planHash,
      planApproved: true,
      sceneRevision: stagedForRejection.sceneRevision!,
      approvalId: rejectApproval,
    });
    const rejected = importer.markDecision(stagedForRejection, false, rejectedExecution.postRevision);
    expect(rejected.status).toBe('REJECTED');
    const afterReject = (await scene.refresh()).snapshot;
    expect(afterReject.objects.some((object) => object.metadata['simforge.import.id'] === rejected.importId)).toBe(false);
    expect(importer.list().filter((report) => report.status === 'ACCEPTED')).toHaveLength(6);

    const tamperedProposal = await importer.prepare(path.join(fixtureRoot, 'fixture.obj'));
    await writeFile(tamperedProposal.args.sourcePath, 'tampered after approval', 'utf8');
    const beforeTamper = (await scene.refresh()).snapshot;
    const tamperApproval = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: tamperedProposal.planHash,
      toolId: tamperedProposal.toolId,
      args: tamperedProposal.args,
      sceneRevision: beforeTamper.sceneRevision,
      risk: 'structural',
    });
    await expect(executor.execute(tamperedProposal.toolId, tamperedProposal.args, {
      projectId: project.manifest.projectId,
      mode: 'build',
      planHash: tamperedProposal.planHash,
      planApproved: true,
      sceneRevision: beforeTamper.sceneRevision,
      approvalId: tamperApproval,
    })).rejects.toMatchObject({ code: 'NATIVE_IMPORT_HASH_CHANGED' });
    expect((await scene.refresh()).snapshot.sceneRevision).toBe(beforeTamper.sceneRevision);

    const evidenceDirectory = process.env.SIMFORGE_MS8_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(path.join(evidenceDirectory, 'native-format-matrix.json'), `${JSON.stringify({
        blenderVersion: '4.5.11 LTS',
        formats: evidence,
        rejection: { importId: rejected.importId, status: rejected.status, removedFromScene: true },
        checkpointCount: project.repository.listCheckpoints(project.manifest.projectId).length,
        externalReferencesAccepted: false,
        security: { pathEscapeRejected: true, postApprovalHashChangeRejected: true },
      }, null, 2)}\n`, 'utf8');
    }

    const exit = once(blender, 'exit');
    await writeFile(path.join(control, 'stop.request'), 'stop', 'utf8');
    await withTimeout(exit, 20_000, 'native matrix Blender exit');
  }, 180_000);
});
