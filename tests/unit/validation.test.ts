import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { BlenderBridgeServer } from '../../src/main/bridge/blender-bridge';
import type { SceneStateService } from '../../src/main/bridge/scene-state';
import { ActivityService } from '../../src/main/domain/activity-service';
import { ApprovalService } from '../../src/main/domain/approval-service';
import { CheckpointService } from '../../src/main/domain/checkpoint-service';
import { ToolExecutor } from '../../src/main/domain/tool-executor';
import type { SceneObject, SceneSnapshot } from '../../src/shared/contracts';
import { validateGeometry } from '../../src/main/validation/geometry-validation';
import { ValidationService } from '../../src/main/validation/validation-service';
import { makeTempProject } from '../helpers/temp-project';

function meshObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: 'mesh-a',
    name: 'RobotPart',
    type: 'MESH',
    parentId: null,
    location: [0, 0, 1],
    rotation: [0, 0, 0],
    worldLocation: [0, 0, 1],
    worldRotation: [0, 0, 0],
    scale: [1, 1, 1],
    dimensions: [1, 1, 2],
    visible: true,
    worldBounds: { min: [-0.5, -0.5, 0], max: [0.5, 0.5, 2] },
    mesh: {
      vertexCount: 8,
      edgeCount: 12,
      polygonCount: 6,
      looseVertexCount: 0,
      nonManifoldEdgeCount: 0,
      degenerateFaceCount: 0,
      zeroLengthEdgeCount: 0,
      normalIssueCount: 0,
    },
    materialNames: ['Engineering Gray'],
    metadata: {},
    ...overrides,
  };
}

function scene(objects: SceneObject[], overrides: Partial<SceneSnapshot> = {}): SceneSnapshot {
  return {
    protocolVersion: 1,
    projectId: 'validation-project',
    sceneRevision: 7,
    sceneName: 'Validation fixture',
    blenderFile: null,
    capturedAt: '2026-07-19T12:00:00.000Z',
    unitSystem: 'METRIC',
    unitScale: 1,
    lengthUnit: 'METERS',
    upAxis: 'Z',
    externalFiles: [],
    objects,
    ...overrides,
  };
}

class MutableSceneState {
  constructor(public snapshot: SceneSnapshot) {}

  get current(): SceneSnapshot {
    return this.snapshot;
  }

  refresh() {
    return Promise.resolve({ snapshot: this.snapshot, diff: null });
  }
}

function mutableBridge(state: MutableSceneState) {
  return {
    request: vi.fn((operation: string, payload: Record<string, unknown>, expected: number | null) => {
      if (expected !== null && expected !== state.snapshot.sceneRevision) {
        throw Object.assign(new Error('stale'), { code: 'STALE_SCENE' });
      }
      const preRevision = state.snapshot.sceneRevision;
      if (operation === 'object.set_location') {
        const object = state.snapshot.objects.find((candidate) => candidate.id === payload.objectId)!;
        const location = payload.location as [number, number, number];
        const deltaZ = location[2] - object.location[2];
        object.location = [...location];
        if (object.worldBounds) {
          object.worldBounds = {
            min: [object.worldBounds.min[0], object.worldBounds.min[1], object.worldBounds.min[2] + deltaZ],
            max: [object.worldBounds.max[0], object.worldBounds.max[1], object.worldBounds.max[2] + deltaZ],
          };
        }
      } else if (operation === 'object.apply_scale') {
        const object = state.snapshot.objects.find((candidate) => candidate.id === payload.objectId)!;
        object.scale = [1, 1, 1];
      }
      state.snapshot = {
        ...state.snapshot,
        sceneRevision: preRevision + 1,
        capturedAt: new Date().toISOString(),
      };
      return Promise.resolve({
        protocolVersion: 1,
        kind: 'response',
        requestId: 'fixture',
        ok: true,
        preRevision,
        postRevision: state.snapshot.sceneRevision,
        changedEntityIds: [typeof payload.objectId === 'string' ? payload.objectId : ''],
        warnings: [],
        result: {},
      });
    }),
  };
}

describe('MS3 deterministic geometry validation', () => {
  it('emits stable rule/entity/evidence results for every AT-021 defect family', () => {
    const defective = scene([
      meshObject({
        name: 'Panel.001',
        location: [0, 0, 2],
        scale: [2, 1, -1],
        visible: false,
        worldBounds: { min: [-1, -0.5, 1], max: [1, 0.5, 3] },
        materialNames: [],
        mesh: {
          vertexCount: 300_001,
          edgeCount: 3,
          polygonCount: 1,
          looseVertexCount: 2,
          nonManifoldEdgeCount: 3,
          degenerateFaceCount: 1,
          zeroLengthEdgeCount: 1,
          normalIssueCount: 1,
        },
      }),
      meshObject({
        id: 'orphan',
        name: 'Orphan',
        parentId: 'missing-parent',
        location: [0, 0, 0.5],
        worldBounds: { min: [-0.25, -0.25, 0], max: [0.25, 0.25, 1] },
      }),
    ], {
      unitSystem: 'NONE',
      unitScale: 0.01,
      externalFiles: [{
        kind: 'image',
        datablock: 'Missing paint',
        path: '//missing.png',
        exists: false,
        packed: false,
      }],
    });
    const first = validateGeometry(defective, { runId: 'run-a', now: '2026-07-19T12:00:00.000Z' });
    const second = validateGeometry(defective, { runId: 'run-b', now: '2026-07-19T12:01:00.000Z' });
    const evidence = (run: typeof first) => run.findings.map((finding) => ({
      ruleId: finding.ruleId,
      entityPath: finding.entityPath,
      evidence: finding.deterministicEvidence,
    }));
    expect(evidence(first)).toEqual(evidence(second));
    expect(first.findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
      'GEO-UNIT-001',
      'GEO-TRANSFORM-001',
      'GEO-CONTACT-001',
      'GEO-TOPOLOGY-001',
      'GEO-NAMING-001',
      'GEO-HIERARCHY-001',
      'GEO-MATERIAL-001',
      'GEO-REFERENCE-001',
      'GEO-VISIBILITY-001',
      'GEO-COMPLEXITY-001',
      'GEO-NORMAL-001',
    ]));
    expect(first.findings.find((finding) => finding.ruleId === 'GEO-CONTACT-001')?.proposedFix)
      .toMatchObject({ fixClass: 'SAFE_LOCAL', reversible: true, approvalRequired: false });
    expect(first.findings.find((finding) => finding.ruleId === 'GEO-TRANSFORM-001')?.proposedFix)
      .toMatchObject({ fixClass: 'STRUCTURAL', approvalRequired: true });

    const repaired = scene([meshObject()]);
    const repairedRules = validateGeometry(repaired, { runId: 'repaired' }).findings
      .map((finding) => finding.ruleId);
    expect(repairedRules).not.toEqual(expect.arrayContaining([
      'GEO-UNIT-001',
      'GEO-TRANSFORM-001',
      'GEO-CONTACT-001',
      'GEO-TOPOLOGY-001',
      'GEO-NAMING-001',
      'GEO-HIERARCHY-001',
      'GEO-MATERIAL-001',
      'GEO-REFERENCE-001',
    ]));
  });

  it('applies only the preconditioned safe fix, revalidates it, and records an inverse', async () => {
    const fixture = await makeTempProject('Safe correction');
    try {
      fixture.project.repository.setMode('build');
      const state = new MutableSceneState(scene([
        meshObject({
          location: [0, 0, 2],
          worldBounds: { min: [-0.5, -0.5, 1], max: [0.5, 0.5, 3] },
        }),
      ], { projectId: fixture.project.manifest.projectId, sceneRevision: 1 }));
      const bridge = mutableBridge(state);
      const checkpoint = vi.fn(() => Promise.resolve({
        id: `checkpoint-${state.snapshot.sceneRevision}`,
        directory: 'fixture',
        sceneRevision: state.snapshot.sceneRevision,
        blenderPath: 'fixture.blend',
      }));
      const approvals = new ApprovalService(fixture.project.repository);
      const activities = new ActivityService(fixture.project.manifest.projectId, fixture.project.repository);
      const checkpoints = { create: checkpoint } as unknown as CheckpointService;
      const executor = new ToolExecutor(
        bridge as unknown as BlenderBridgeServer,
        approvals,
        checkpoints,
        activities,
      );
      const service = new ValidationService(
        fixture.project,
        state as unknown as SceneStateService,
        executor,
        approvals,
        checkpoints,
        activities,
      );
      const run = await service.run();
      const contact = run.findings.find((finding) => finding.ruleId === 'GEO-CONTACT-001')!;
      const corrected = await service.applyFix(contact.id, null, null);
      expect(corrected.findings.some((finding) => finding.ruleId === 'GEO-CONTACT-001')).toBe(false);
      expect(checkpoint).toHaveBeenCalledOnce();
      expect(fixture.project.repository.latestAppliedValidationFix(run.projectId)).toMatchObject({
        fixClass: 'SAFE_LOCAL',
        inverseToolId: 'object.set_location',
        status: 'APPLIED',
      });
      const undone = await service.undoLatestSafeFix();
      expect(undone.findings.some((finding) => finding.ruleId === 'GEO-CONTACT-001')).toBe(true);
      expect(checkpoint).toHaveBeenCalledTimes(2);
      expect(fixture.project.repository.latestAppliedValidationFix(run.projectId)).toBeNull();
    } finally {
      await fixture.cleanup();
    }
  });

  it('rejects an unapproved structural fix, then checkpoints and revalidates the exact approved action', async () => {
    const fixture = await makeTempProject('Structural correction');
    try {
      fixture.project.repository.setMode('build');
      const state = new MutableSceneState(scene([
        meshObject({ scale: [2, 1, 1] }),
      ], { projectId: fixture.project.manifest.projectId, sceneRevision: 3 }));
      const bridge = mutableBridge(state);
      const checkpoint = vi.fn(() => Promise.resolve({
        id: 'structural-checkpoint', directory: 'fixture', sceneRevision: 3, blenderPath: 'fixture.blend',
      }));
      const approvals = new ApprovalService(fixture.project.repository);
      const activities = new ActivityService(fixture.project.manifest.projectId, fixture.project.repository);
      const checkpoints = { create: checkpoint } as unknown as CheckpointService;
      const executor = new ToolExecutor(
        bridge as unknown as BlenderBridgeServer,
        approvals,
        checkpoints,
        activities,
      );
      const service = new ValidationService(
        fixture.project,
        state as unknown as SceneStateService,
        executor,
        approvals,
        checkpoints,
        activities,
      );
      const run = await service.run();
      const finding = run.findings.find((candidate) => candidate.ruleId === 'GEO-TRANSFORM-001')!;
      await expect(service.applyFix(finding.id, 'scale-plan', null))
        .rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
      expect(state.snapshot.objects[0]?.scale).toEqual([2, 1, 1]);
      expect(checkpoint).not.toHaveBeenCalled();

      const approvalId = approvals.approve({
        projectId: fixture.project.manifest.projectId,
        planHash: 'scale-plan',
        toolId: finding.proposedFix!.toolId,
        args: finding.proposedFix!.args,
        sceneRevision: run.sceneRevision,
        risk: 'structural',
      });
      const corrected = await service.applyFix(finding.id, 'scale-plan', approvalId);
      expect(corrected.findings.some((candidate) => candidate.ruleId === 'GEO-TRANSFORM-001')).toBe(false);
      expect(checkpoint).toHaveBeenCalledOnce();
    } finally {
      await fixture.cleanup();
    }
  });

  it('captures and restores the portable project working set and mutable task state', async () => {
    const fixture = await makeTempProject('Complete checkpoint');
    try {
      const reference = path.join(fixture.project.root, 'references', 'source.txt');
      const script = path.join(fixture.project.root, 'scripts', 'generated', 'build.py');
      await writeFile(reference, 'original reference', 'utf8');
      await writeFile(script, 'print("original")', 'utf8');
      fixture.project.repository.setMode('goal');
      fixture.project.repository.setState('activeGoalJobId', 'job-before');
      const bridge = {
        request: vi.fn(async (_operation: string, payload: Record<string, unknown>) => {
          await writeFile(String(payload.filepath), 'BLENDER', 'utf8');
          return { postRevision: 5 };
        }),
      } as unknown as BlenderBridgeServer;
      const service = new CheckpointService(fixture.project, bridge);
      const checkpoint = await service.create('Complete state', 5);
      const record = fixture.project.repository.getCheckpoint(checkpoint.id)!;
      expect(record.manifest).toMatchObject({
        mode: 'goal',
        activeGoalJobId: 'job-before',
      });
      expect(record.manifest.capturedFiles).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'references/source.txt' }),
        expect.objectContaining({ path: 'scripts/generated/build.py' }),
      ]));

      await writeFile(reference, 'changed reference', 'utf8');
      await writeFile(script, 'print("changed")', 'utf8');
      fixture.project.repository.setMode('build');
      fixture.project.repository.setState('activeGoalJobId', 'job-after');
      fixture.project.repository.saveProjectRecord({
        id: 'after-checkpoint',
        projectId: fixture.project.manifest.projectId,
        kind: 'action',
        body: { shouldDisappear: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await service.restoreProjectState(checkpoint.id);
      expect(await readFile(reference, 'utf8')).toBe('original reference');
      expect(await readFile(script, 'utf8')).toBe('print("original")');
      expect(fixture.project.repository.getMode()).toBe('goal');
      expect(fixture.project.repository.getState('activeGoalJobId')).toBe('job-before');
      expect(fixture.project.repository.listProjectRecords(fixture.project.manifest.projectId))
        .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'after-checkpoint' })]));
    } finally {
      await fixture.cleanup();
    }
  });
});
