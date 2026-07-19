import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type {
  EnvironmentGraph,
  ProposedFix,
  RobotGraph,
  ValidationFinding,
  ValidationFixRecord,
  ValidationRun,
} from '../../shared/contracts';
import { EnvironmentGraphSchema, RobotGraphSchema } from '../../shared/contracts';
import { assertContract } from '../../shared/validation';
import type { SceneStateService } from '../bridge/scene-state';
import type { ProjectHandle } from '../storage/project-repository';
import type { ActivityService } from '../domain/activity-service';
import type { ApprovalService } from '../domain/approval-service';
import type { CheckpointService } from '../domain/checkpoint-service';
import type { ToolExecutor } from '../domain/tool-executor';
import { validateGeometry } from './geometry-validation';
import { validateEnvironment } from './environment-validation';
import { validateRobotics } from './robotics-validation';

export interface CheckpointView {
  id: string;
  label: string;
  sceneRevision: number;
  createdAt: string;
  completeProjectState: boolean;
}

export class ValidationService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly sceneState: SceneStateService,
    private readonly executor: ToolExecutor,
    private readonly approvals: ApprovalService,
    private readonly checkpoints: CheckpointService,
    private readonly activities: ActivityService,
  ) {}

  latest(): ValidationRun | null {
    return this.project.repository.latestValidationRun(this.project.manifest.projectId);
  }

  async run(): Promise<ValidationRun> {
    const { snapshot } = await this.sceneState.refresh();
    const runId = randomUUID();
    const now = new Date().toISOString();
    const geometryRun = validateGeometry(snapshot, { runId, now });
    const graph = this.latestRobotGraph();
    const roboticsRun = graph ? validateRobotics(snapshot, graph, { runId, now }) : null;
    const environment = this.latestEnvironmentGraph();
    const environmentRun = environment ? validateEnvironment(snapshot, environment, { runId, now }) : null;
    const findings = [
      ...geometryRun.findings,
      ...(roboticsRun?.findings ?? []),
      ...(environmentRun?.findings ?? []),
    ].sort((left, right) => (
      left.ruleId.localeCompare(right.ruleId) || left.entityPath.localeCompare(right.entityPath)
    ));
    const summary = { blocker: 0, error: 0, warning: 0, info: 0 };
    for (const finding of findings) summary[finding.severity] += 1;
    const run: ValidationRun = {
      ...geometryRun,
      channels: [...new Set([
        ...geometryRun.channels,
        ...(roboticsRun?.channels ?? []),
        ...(environmentRun?.channels ?? []),
      ])],
      summary,
      findings,
    };
    this.project.repository.saveValidationRun(run);
    this.activities.record('validation', 'deterministic-run-completed', 'Deterministic geometry validation completed', {
      runId: run.id,
      sceneRevision: run.sceneRevision,
      blocker: run.summary.blocker,
      error: run.summary.error,
      warning: run.summary.warning,
      info: run.summary.info,
    });
    return run;
  }

  latestRobotGraph(): RobotGraph | null {
    const record = [...this.project.repository.listProjectRecords(this.project.manifest.projectId)]
      .reverse()
      .find((candidate) => candidate.kind === 'asset' && candidate.body.type === 'robot-graph');
    if (!record) return null;
    assertContract<RobotGraph>(RobotGraphSchema, record.body.graph, 'stored RobotGraph');
    return record.body.graph;
  }

  latestEnvironmentGraph(): EnvironmentGraph | null {
    const record = [...this.project.repository.listProjectRecords(this.project.manifest.projectId)]
      .reverse()
      .find((candidate) => candidate.kind === 'asset' && candidate.body.type === 'environment-graph');
    if (!record) return null;
    assertContract<EnvironmentGraph>(EnvironmentGraphSchema, record.body.graph, 'stored EnvironmentGraph');
    return record.body.graph;
  }

  async applyFix(
    findingId: string,
    planHash: string | null,
    approvalId: string | null,
  ): Promise<ValidationRun> {
    const finding = this.project.repository.getValidationFinding(findingId);
    if (!finding || !finding.proposedFix) throw new Error('Validation finding has no executable fix');
    if (finding.status !== 'OPEN') throw new Error('Validation finding is no longer open');
    const sourceRun = this.project.repository.getValidationRun(finding.runId);
    if (!sourceRun || sourceRun.projectId !== this.project.manifest.projectId) {
      throw new Error('Validation finding does not belong to the active project');
    }
    const fix = finding.proposedFix;
    this.assertFixPolicy(fix);
    const { snapshot } = await this.sceneState.refresh();
    this.assertPreconditions(fix, snapshot);
    const execution = await this.executor.execute(fix.toolId, fix.args, {
      projectId: this.project.manifest.projectId,
      mode: this.project.repository.getMode(),
      planHash,
      planApproved: Boolean(planHash),
      sceneRevision: snapshot.sceneRevision,
      approvalId,
      origin: fix.fixClass === 'SAFE_LOCAL' ? 'validation-safe' : 'general',
    });
    const resultRun = await this.run();
    const cleared = !resultRun.findings.some((candidate) => (
      candidate.ruleId === finding.ruleId && candidate.entityPath === finding.entityPath
    ));
    if (cleared) this.project.repository.setValidationFindingStatus(finding.id, 'FIXED');

    const now = new Date().toISOString();
    const inverse = this.inverseFor(finding);
    const record: ValidationFixRecord = {
      id: randomUUID(),
      projectId: this.project.manifest.projectId,
      sourceRunId: sourceRun.id,
      findingId: finding.id,
      fixId: fix.id,
      fixClass: fix.fixClass,
      toolId: fix.toolId,
      args: fix.args,
      inverseToolId: inverse?.toolId ?? null,
      inverseArgs: inverse?.args ?? null,
      checkpointId: execution.checkpointId,
      preRevision: execution.preRevision,
      postRevision: execution.postRevision,
      resultRunId: resultRun.id,
      status: 'APPLIED',
      createdAt: now,
      updatedAt: now,
    };
    this.project.repository.saveValidationFix(record);
    this.activities.record('validation', 'fix-applied', `${fix.fixClass} validation fix applied`, {
      fixRecordId: record.id,
      findingId: finding.id,
      ruleId: finding.ruleId,
      toolId: fix.toolId,
      checkpointId: execution.checkpointId,
      revalidatedRunId: resultRun.id,
      findingCleared: cleared,
    });
    if (!cleared) throw new Error('Correction ran but deterministic revalidation did not clear the finding');
    return resultRun;
  }

  async undoLatestSafeFix(): Promise<ValidationRun> {
    const fix = this.project.repository.latestAppliedValidationFix(this.project.manifest.projectId);
    if (!fix?.inverseToolId || !fix.inverseArgs || fix.fixClass !== 'SAFE_LOCAL') {
      throw new Error('No applied safe validation fix has an available inverse');
    }
    const { snapshot } = await this.sceneState.refresh();
    const execution = await this.executor.execute(fix.inverseToolId, fix.inverseArgs, {
      projectId: this.project.manifest.projectId,
      mode: this.project.repository.getMode(),
      planHash: null,
      planApproved: false,
      sceneRevision: snapshot.sceneRevision,
      approvalId: null,
      origin: 'history-undo',
    });
    const resultRun = await this.run();
    const now = new Date().toISOString();
    this.project.repository.markValidationFixUndone(fix.id, now);
    this.activities.record('validation', 'safe-fix-undone', 'Latest safe validation fix was reversed', {
      fixRecordId: fix.id,
      toolId: fix.inverseToolId,
      checkpointId: execution.checkpointId,
      revalidatedRunId: resultRun.id,
    });
    return resultRun;
  }

  listCheckpoints(): CheckpointView[] {
    return this.project.repository.listCheckpoints(this.project.manifest.projectId).map((checkpoint) => ({
      id: checkpoint.id,
      label: checkpoint.label,
      sceneRevision: checkpoint.sceneRevision,
      createdAt: checkpoint.createdAt,
      completeProjectState: (
        typeof checkpoint.manifest.databasePath === 'string' &&
        Array.isArray(checkpoint.manifest.capturedFiles)
      ),
    }));
  }

  approveCheckpointRestore(checkpointId: string, planHash: string): string {
    const { args, revision } = this.checkpointRestoreAction(checkpointId);
    const approvalId = this.approvals.approve({
      projectId: this.project.manifest.projectId,
      planHash,
      toolId: 'checkpoint.restore',
      args,
      sceneRevision: revision,
      risk: 'structural',
    });
    this.activities.record('approval', 'checkpoint-restore-approved', 'Approved exact checkpoint restore', {
      approvalId,
      checkpointId,
      planHash,
      sceneRevision: revision,
    });
    return approvalId;
  }

  async restoreCheckpoint(
    checkpointId: string,
    planHash: string,
    approvalId: string,
  ): Promise<ValidationRun> {
    const { args, revision } = this.checkpointRestoreAction(checkpointId);
    const execution = await this.executor.execute('checkpoint.restore', args, {
      projectId: this.project.manifest.projectId,
      mode: this.project.repository.getMode(),
      planHash,
      planApproved: true,
      sceneRevision: revision,
      approvalId,
    });
    await this.checkpoints.restoreProjectState(checkpointId);
    const resultRun = await this.run();
    this.activities.record('history', 'checkpoint-restored', 'Checkpoint Blender and project state restored', {
      checkpointId,
      preRestoreCheckpointId: execution.checkpointId,
      postRevision: execution.postRevision,
      revalidatedRunId: resultRun.id,
    });
    return resultRun;
  }

  private checkpointRestoreAction(checkpointId: string): {
    args: Record<string, unknown>;
    revision: number;
  } {
    const checkpoint = this.project.repository.getCheckpoint(checkpointId);
    const current = this.sceneState.current;
    if (!checkpoint || checkpoint.projectId !== this.project.manifest.projectId || !checkpoint.blenderPath) {
      throw new Error('Checkpoint is unavailable for the active project');
    }
    if (!current) throw new Error('Refresh Blender before approving checkpoint restore');
    return {
      args: {
        filepath: path.resolve(this.project.root, ...checkpoint.blenderPath.split('/')),
        destination: path.resolve(this.project.root, ...this.project.manifest.blenderFile.split('/')),
        checkpointId,
      },
      revision: current.sceneRevision,
    };
  }

  private assertFixPolicy(fix: ProposedFix): void {
    if (fix.fixClass === 'SAFE_LOCAL') {
      if (fix.approvalRequired || !fix.reversible) {
        throw new Error('Invalid SAFE_LOCAL fix metadata');
      }
      return;
    }
    if (!fix.approvalRequired) throw new Error(`${fix.fixClass} fixes require explicit approval`);
  }

  private assertPreconditions(
    fix: ProposedFix,
    snapshot: NonNullable<SceneStateService['current']>,
  ): void {
    if (snapshot.sceneRevision !== fix.preconditions.sceneRevision) {
      throw new Error('Validation fix is stale; rerun validation against the current scene');
    }
    if (!fix.preconditions.objectId) return;
    const object = snapshot.objects.find((candidate) => candidate.id === fix.preconditions.objectId);
    if (!object) throw new Error('Validation fix target no longer exists');
    if (
      fix.preconditions.expectedLocation &&
      !isDeepStrictEqual(object.location, fix.preconditions.expectedLocation)
    ) {
      throw new Error('Validation fix target location changed; rerun validation');
    }
    if (
      fix.preconditions.expectedScale &&
      !isDeepStrictEqual(object.scale, fix.preconditions.expectedScale)
    ) {
      throw new Error('Validation fix target scale changed; rerun validation');
    }
  }

  private inverseFor(finding: ValidationFinding): {
    toolId: string;
    args: Record<string, unknown>;
  } | null {
    const fix = finding.proposedFix;
    if (
      fix?.toolId === 'object.set_location' &&
      fix.preconditions.objectId &&
      fix.preconditions.expectedLocation
    ) {
      return {
        toolId: 'object.set_location',
        args: {
          objectId: fix.preconditions.objectId,
          location: fix.preconditions.expectedLocation,
        },
      };
    }
    return null;
  }
}
