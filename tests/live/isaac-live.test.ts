import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ActivityService } from '../../src/main/domain/activity-service';
import { ApprovalService } from '../../src/main/domain/approval-service';
import { IsaacExperimentService } from '../../src/main/isaac/isaac-service';
import { ProjectManager, type ProjectHandle } from '../../src/main/storage/project-repository';
import type { ExportManifest, ExportResult } from '../../src/shared/contracts';

const pythonPath = process.env.SIMFORGE_ISAAC_PYTHON;
const liveDescribe = process.env.SIMFORGE_ISAAC_LIVE === '1' && pythonPath ? describe : describe.skip;
let sandbox: string | null = null;
let project: ProjectHandle | null = null;

afterEach(async () => {
  project?.repository.close();
  project = null;
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
  sandbox = null;
});

liveDescribe('real NVIDIA Isaac Sim acceptance', () => {
  it('copies a canonical package, enforces exact approval, runs physics, and retains replayable evidence', async () => {
    if (!pythonPath) throw new Error('SIMFORGE_ISAAC_PYTHON is required');
    await expect(access(pythonPath)).resolves.toBeUndefined();
    sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-real-isaac-'));
    const userData = path.join(sandbox, 'user-data');
    const runtimeRoot = path.join(userData, 'runtime');
    await mkdir(runtimeRoot, { recursive: true });
    await writeFile(path.join(runtimeRoot, 'isaac-runtime.json'), `${JSON.stringify({
      schemaVersion: 1,
      pythonPath: path.resolve(pythonPath),
      productVersion: '6.0.1.0',
      eulaAcceptedAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf8');

    project = await new ProjectManager().create(path.join(sandbox, 'project'), 'Isaac acceptance');
    project.repository.setMode('build');
    const packageRoot = path.join(sandbox, 'canonical-package');
    await mkdir(packageRoot, { recursive: true });
    const stageText = `#usda 1.0
(
    defaultPrim = "World"
    metersPerUnit = 1
    upAxis = "Z"
)

def Xform "World"
{
    custom string simforge_robot = "isaac-acceptance-robot"

    def Xform "Robot"
    {
        def Cube "Body"
        {
            double size = 0.5
            color3f[] primvars:displayColor = [(0.05, 0.8, 0.7)]
            double3 xformOp:translate = (0, 0, 0.3)
            uniform token[] xformOpOrder = ["xformOp:translate"]
        }
    }
}
`;
    await writeFile(path.join(packageRoot, 'scene.usda'), stageText, 'utf8');
    const now = new Date().toISOString();
    const manifest: ExportManifest = {
      schemaVersion: 1,
      exportId: 'isaac-source-export',
      kind: 'canonical',
      appVersion: '0.1.0',
      createdAt: now,
      entryPoint: 'scene.usda',
      project: { id: project.manifest.projectId, name: project.manifest.name },
      robotId: 'isaac-acceptance-robot',
      sceneRevision: 17,
      conventions: { upAxis: 'Z', metersPerUnit: 1, robotForwardAxis: 'X' },
      sourceValidationRunId: 'isaac-source-validation',
      validation: { checks: [], summary: { blocker: 0, error: 0, warning: 0, info: 0 } },
      assumptions: ['Fixed local physics probe is isolated from the source package.'],
      limitations: ['The waypoint command is kinematic and does not claim autonomous navigation.'],
      files: [],
    };
    await writeFile(path.join(packageRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const source: ExportResult = {
      exportId: manifest.exportId,
      kind: 'canonical',
      destination: packageRoot,
      sceneRevision: manifest.sceneRevision,
      verified: true,
      checkpointId: null,
      manifest,
      checks: [],
      machineResultsPath: 'validation/validation-results.json',
      readinessReportPath: 'validation/readiness-report.md',
      completedAt: now,
    };
    const exports = { list: () => [source] };
    const approvals = new ApprovalService(project.repository);
    const activities = new ActivityService(project.manifest.projectId, project.repository);
    const service = new IsaacExperimentService(
      project,
      exports as never,
      approvals,
      activities,
      process.cwd(),
      userData,
    );
    const proposal = service.proposal();
    await expect(service.execute(proposal, 'missing-approval')).rejects.toThrow('approval failed');
    const approvalId = approvals.approve({
      projectId: project.manifest.projectId,
      planHash: proposal.planHash,
      toolId: proposal.toolId,
      args: proposal.args,
      sceneRevision: proposal.sceneRevision,
      risk: proposal.risk,
    });
    const experiment = await service.execute(proposal, approvalId);
    expect(experiment.checks.filter((check) => check.status === 'FAIL')).toEqual([]);
    expect(experiment.runtime).toMatchObject({ product: 'NVIDIA Isaac Sim', version: '6.0.1.0', headless: true });
    expect(experiment.checks.some((check) => check.status === 'FAIL')).toBe(false);
    expect(experiment.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ISAAC-STABILITY-001', status: 'WARN' }),
      expect.objectContaining({ id: 'ISAAC-TASK-001', status: 'PASS' }),
    ]));
    expect(experiment.artifacts.filter((entry) => entry.role === 'image')).toHaveLength(3);
    expect(await service.imageDataList(experiment.experimentId)).toHaveLength(3);
    expect(service.list()).toEqual([experiment]);

    const experimentRoot = path.join(project.root, ...experiment.experimentRelativePath.split('/'));
    await expect(access(path.join(experimentRoot, 'input', 'package', 'scene.usda'))).resolves.toBeUndefined();
    await expect(access(path.join(experimentRoot, 'logs', 'isaac.log'))).resolves.toBeUndefined();
    const retainedResult = JSON.parse(await readFile(path.join(experimentRoot, 'output', 'result.json'), 'utf8')) as Record<string, unknown>;
    expect(retainedResult.status).toBe('PASSED');

    const evidenceDirectory = process.env.SIMFORGE_MS11A_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      const imageArtifacts = experiment.artifacts.filter((entry) => entry.role === 'image');
      await Promise.all([
        copyFile(path.join(experimentRoot, 'manifest.json'), path.join(evidenceDirectory, 'experiment-manifest.json')),
        copyFile(path.join(experimentRoot, 'output', 'result.json'), path.join(evidenceDirectory, 'worker-result.json')),
        copyFile(path.join(experimentRoot, 'logs', 'isaac.log'), path.join(evidenceDirectory, 'isaac.log')),
        copyFile(path.join(project.root, ...imageArtifacts[0]!.relativePath.split('/')), path.join(evidenceDirectory, 'frame-initial.png')),
        copyFile(path.join(project.root, ...imageArtifacts.at(-1)!.relativePath.split('/')), path.join(evidenceDirectory, 'frame-final.png')),
        writeFile(path.join(evidenceDirectory, 'acceptance.json'), `${JSON.stringify({
          experimentId: experiment.experimentId,
          sourceExport: experiment.sourceExport,
          task: experiment.task,
          status: experiment.status,
          checks: experiment.checks,
          metrics: experiment.metrics,
          runtime: experiment.runtime,
          artifactCount: experiment.artifacts.length,
          replayFrameCount: imageArtifacts.length,
          exactApprovalEnforced: true,
        }, null, 2)}\n`, 'utf8'),
      ]);
    }
  }, 5 * 60_000);
});
