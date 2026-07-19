import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createIsaacStabilityCorrectionProposal,
  IsaacExperimentService,
  inspectIsaacEnvironment,
  type IsaacExperimentAnalysis,
} from '../../src/main/isaac/isaac-service';
import {
  warehouseEnvironmentGraph,
  warehouseMobileManipulatorGraph,
} from '../../src/main/robotics/warehouse-mobile-manipulator';
import type { ExportResult } from '../../src/shared/contracts';
import { sha256 } from '../../src/shared/hash';

const sandboxes: string[] = [];
const emptyProject = { manifest: { projectId: 'project' }, repository: { listProjectRecords: () => [] } } as never;

function exportResult(kind: 'quick' | 'canonical', verified = true): ExportResult {
  const now = new Date().toISOString();
  return {
    exportId: `${kind}-export`,
    kind,
    destination: path.resolve(`${kind}-package`),
    sceneRevision: 17,
    verified,
    checkpointId: null,
    manifest: {
      schemaVersion: 1,
      exportId: `${kind}-export`,
      kind,
      appVersion: '0.1.0',
      createdAt: now,
      entryPoint: kind === 'canonical' ? 'scene.usda' : 'scene.usdc',
      project: { id: 'project', name: 'Isaac test' },
      robotId: 'robot',
      sceneRevision: 17,
      conventions: { upAxis: 'Z', metersPerUnit: 1, robotForwardAxis: 'X' },
      sourceValidationRunId: 'validation',
      validation: { checks: [], summary: { blocker: 0, error: 0, warning: 0, info: 0 } },
      assumptions: [],
      limitations: [],
      files: [],
    },
    checks: [],
    machineResultsPath: 'validation/results.json',
    readinessReportPath: 'validation/readiness.md',
    completedAt: now,
  };
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe('Isaac experiment policy', () => {
  it('binds a fixed local task to the latest verified canonical export', () => {
    const exports = { list: () => [exportResult('quick'), exportResult('canonical')] };
    const service = new IsaacExperimentService(
      emptyProject,
      exports as never,
      emptyProject,
      {} as never,
      process.cwd(),
      path.resolve('.tmp', 'isaac-policy-user-data'),
    );
    const proposal = service.proposal();
    expect(proposal).toMatchObject({
      toolId: 'simulation.run',
      risk: 'privileged',
      sceneRevision: 17,
      args: {
        sourceExportId: 'canonical-export',
        sourceSceneRevision: 17,
        task: { id: 'static-settle-v1', seed: 20260719, steps: 240 },
      },
    });
    expect(proposal.planHash).toBe(`simulation:${sha256(proposal.args)}`);
  });

  it('refuses to propose a run without a verified canonical package', () => {
    const exports = { list: () => [exportResult('quick'), exportResult('canonical', false)] };
    const service = new IsaacExperimentService(
      {} as never,
      exports as never,
      {} as never,
      {} as never,
      process.cwd(),
      path.resolve('.tmp', 'isaac-policy-user-data'),
    );
    expect(() => service.proposal()).toThrow('verified canonical USD export');
  });

  it('reports an unconfigured runtime without treating it as a hard application failure', async () => {
    const sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-isaac-unavailable-'));
    sandboxes.push(sandbox);
    const status = await inspectIsaacEnvironment(sandbox, path.join(sandbox, 'user-data'));
    expect(status).toMatchObject({
      installed: false,
      runtimeReady: false,
      product: 'NVIDIA Isaac Sim',
      compatibility: 'UNAVAILABLE',
    });
    expect(status.issues.some((issue) => issue.includes('runtime'))).toBe(true);
  });

  it('turns deterministic stability evidence into one exact checkpointed subtree plan', () => {
    const graph = warehouseMobileManipulatorGraph();
    const totalMass = graph.links.reduce((sum, link) => sum + (link.massKg.value ?? 0), 0);
    const centerX = graph.links.reduce((sum, link) => (
      sum + (link.massKg.value ?? 0) * link.pose.position[0]
    ), 0) / totalMass;
    const analysis: IsaacExperimentAnalysis = {
      analysisId: 'analysis',
      experimentId: 'experiment-before',
      status: 'CORRECTION_PROPOSED',
      deterministicSummary: 'Center of mass is beyond support.',
      failedCheckIds: ['ISAAC-STABILITY-001'],
      stabilityEvidence: {
        applicable: true,
        centerOfMassM: [centerX, 0, 0],
        supportBoundsM: { minX: -0.48, maxX: 0, minY: -0.44, maxY: 0.44 },
        requiredInsetM: 0.01,
        totalMassKg: totalMass,
        recommendedCorrection: {
          strategy: 'RETRACT_SUBTREE',
          rootLinkId: 'arm_column_link',
          targetCenterOfMassXMaxM: -0.02,
        },
      },
      model: null,
      createdAt: new Date().toISOString(),
    };
    const proposal = createIsaacStabilityCorrectionProposal(
      graph,
      warehouseEnvironmentGraph(),
      analysis,
      23,
    );
    expect(proposal).toMatchObject({
      toolId: 'robot.retract_subtree',
      risk: 'structural',
      sceneRevision: 23,
      sourceExperimentId: 'experiment-before',
      args: { robotId: graph.robotId, rootLinkId: 'arm_column_link' },
    });
    expect(proposal.args.deltaXM).toBeLessThan(-0.02);
    expect(proposal.args.affectedLinkIds).toEqual(expect.arrayContaining([
      'arm_column_link', 'upper_arm_link', 'forearm_link', 'wrist_link', 'left_finger_link',
    ]));
    expect(proposal.args.robotGraph.links.find((link) => link.id === 'base_link')?.pose.position)
      .toEqual(graph.links.find((link) => link.id === 'base_link')?.pose.position);
    expect(proposal.args.robotGraph.links.find((link) => link.id === 'arm_column_link')?.pose.position[0])
      .toBeCloseTo(graph.links.find((link) => link.id === 'arm_column_link')!.pose.position[0] + proposal.args.deltaXM, 6);
    expect(proposal.planHash).toBe(sha256({ toolId: proposal.toolId, args: proposal.args }));
  });
});
