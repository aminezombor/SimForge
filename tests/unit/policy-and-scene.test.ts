import { describe, expect, it, vi } from 'vitest';
import type { BlenderBridgeServer } from '../../src/main/bridge/blender-bridge';
import { diffSnapshots } from '../../src/main/bridge/scene-state';
import { ActivityService } from '../../src/main/domain/activity-service';
import { ApprovalService } from '../../src/main/domain/approval-service';
import { ApprovedScriptArchive } from '../../src/main/domain/approved-script-archive';
import type { CheckpointService } from '../../src/main/domain/checkpoint-service';
import { ToolExecutor } from '../../src/main/domain/tool-executor';
import type { PolicyDeniedError } from '../../src/main/domain/tool-executor';
import { sha256Text } from '../../src/shared/hash';
import { makeTempProject } from '../helpers/temp-project';

function snapshot(revision: number, x: number, ids = ['one']) {
  return {
    protocolVersion: 1 as const,
    projectId: 'project',
    sceneRevision: revision,
    sceneName: 'Scene',
    blenderFile: null,
    capturedAt: new Date().toISOString(),
    unitSystem: 'METRIC',
    unitScale: 1,
    lengthUnit: 'METERS',
    upAxis: 'Z' as const,
    externalFiles: [],
    objects: ids.map((id) => ({
      id,
      name: id,
      type: 'MESH',
      parentId: null,
      location: [x, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      dimensions: [1, 1, 1] as [number, number, number],
      visible: true,
      worldBounds: {
        min: [x - 0.5, -0.5, 0] as [number, number, number],
        max: [x + 0.5, 0.5, 1] as [number, number, number],
      },
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
      materialNames: [],
    })),
  };
}

describe('mode, approval, and privileged fallback policy', () => {
  it('fails Plan Mode closed and binds risky approval to plan, args, and revision', async () => {
    const fixture = await makeTempProject('Policy');
    try {
      const request = vi.fn().mockResolvedValue({
        protocolVersion: 1,
        kind: 'response',
        requestId: 'response',
        ok: true,
        preRevision: 4,
        postRevision: 5,
        changedEntityIds: ['object'],
        warnings: [],
        result: {},
      });
      const createCheckpoint = vi.fn().mockResolvedValue({ id: 'checkpoint' });
      const approvals = new ApprovalService(fixture.project.repository);
      const executor = new ToolExecutor(
        { request } as unknown as BlenderBridgeServer,
        approvals,
        { create: createCheckpoint } as unknown as CheckpointService,
        new ActivityService(fixture.project.manifest.projectId, fixture.project.repository),
      );
      const base = {
        projectId: fixture.project.manifest.projectId,
        planHash: 'plan-hash',
        planApproved: true,
        sceneRevision: 4,
        approvalId: null,
      };
      expect(executor.availableTools('plan').map((tool) => tool.id)).toEqual(['scene.snapshot']);
      for (const toolId of ['object.create_primitive', 'object.delete', 'python.execute', 'export.package']) {
        await expect(executor.execute(toolId, {}, { ...base, mode: 'plan' }))
          .rejects.toMatchObject({ code: 'MODE_DENIED' } satisfies Partial<PolicyDeniedError>);
      }
      expect(request).not.toHaveBeenCalled();

      await executor.execute('object.create_primitive', {}, { ...base, mode: 'build' });
      expect(createCheckpoint).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledOnce();

      const deletion = { objectId: 'object' };
      await expect(executor.execute('object.delete', deletion, { ...base, mode: 'build' }))
        .rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' } satisfies Partial<PolicyDeniedError>);
      const approvalId = approvals.approve({
        projectId: base.projectId,
        planHash: base.planHash,
        toolId: 'object.delete',
        args: deletion,
        sceneRevision: 4,
        risk: 'destructive',
      });
      await expect(executor.execute('object.delete', deletion, {
        ...base,
        mode: 'build',
        sceneRevision: 5,
        approvalId,
      })).rejects.toMatchObject({ code: 'APPROVAL_SCOPE_MISMATCH' } satisfies Partial<PolicyDeniedError>);
      await expect(executor.execute('object.delete', { objectId: 'changed' }, {
        ...base,
        mode: 'build',
        approvalId,
      })).rejects.toMatchObject({ code: 'APPROVAL_SCOPE_MISMATCH' } satisfies Partial<PolicyDeniedError>);
      await expect(executor.execute('object.delete', deletion, {
        ...base,
        mode: 'build',
        planHash: 'changed-plan',
        approvalId,
      })).rejects.toMatchObject({ code: 'APPROVAL_SCOPE_MISMATCH' } satisfies Partial<PolicyDeniedError>);
      const expiredApproval = approvals.approve({
        projectId: base.projectId,
        planHash: base.planHash,
        toolId: 'object.delete',
        args: deletion,
        sceneRevision: 4,
        risk: 'destructive',
        ttlMs: -1,
      });
      await expect(executor.execute('object.delete', deletion, {
        ...base,
        mode: 'build',
        approvalId: expiredApproval,
      })).rejects.toMatchObject({ code: 'APPROVAL_EXPIRED' } satisfies Partial<PolicyDeniedError>);
      await executor.execute('object.delete', deletion, { ...base, mode: 'build', approvalId });
    } finally {
      await fixture.cleanup();
    }
  });

  it('requires exact intent, raw script hash, path declaration, approval, and checkpoint', async () => {
    const fixture = await makeTempProject('Python policy');
    try {
      const request = vi.fn().mockResolvedValue({
        preRevision: 2,
        postRevision: 3,
        changedEntityIds: [],
        result: { executed: true },
      });
      const createCheckpoint = vi.fn().mockResolvedValue({ id: 'checkpoint' });
      const approvals = new ApprovalService(fixture.project.repository);
      const executor = new ToolExecutor(
        { request } as unknown as BlenderBridgeServer,
        approvals,
        { create: createCheckpoint } as unknown as CheckpointService,
        new ActivityService(fixture.project.manifest.projectId, fixture.project.repository),
        new ApprovedScriptArchive(fixture.project),
      );
      const script = "bpy.context.scene['approved'] = True";
      const args = {
        intent: 'Set an approved test marker',
        script,
        scriptHash: sha256Text(script),
        allowedPaths: [],
      };
      const context = {
        projectId: fixture.project.manifest.projectId,
        mode: 'build' as const,
        planHash: 'python-plan',
        planApproved: true,
        sceneRevision: 2,
        approvalId: null,
      };
      await expect(executor.execute('python.execute', args, context))
        .rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' } satisfies Partial<PolicyDeniedError>);
      const approvalId = approvals.approve({
        projectId: context.projectId,
        planHash: context.planHash,
        toolId: 'python.execute',
        args,
        sceneRevision: 2,
        risk: 'privileged',
      });
      await executor.execute('python.execute', args, { ...context, approvalId });
      expect(createCheckpoint).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledWith('python.execute', args, 2);
      const activityJson = JSON.stringify(fixture.project.repository.listActivities(context.projectId));
      expect(activityJson).toContain(args.scriptHash);
      expect(activityJson).not.toContain(script);
      expect(fixture.project.repository.listProjectRecords(context.projectId))
        .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'script' })]));
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('fresh scene diffs', () => {
  it('reports added, removed, and changed entities across revisions', () => {
    const before = snapshot(4, 0, ['one', 'removed']);
    const after = snapshot(5, 2, ['one', 'added']);
    const diff = diffSnapshots(before, after);
    expect(diff.changed.map((entry) => entry.after.id)).toEqual(['one']);
    expect(diff.added.map((entry) => entry.id)).toEqual(['added']);
    expect(diff.removed.map((entry) => entry.id)).toEqual(['removed']);
    expect(diff.fromRevision).toBe(4);
    expect(diff.toRevision).toBe(5);
  });
});
