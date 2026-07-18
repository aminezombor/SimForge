import { randomUUID } from 'node:crypto';
import { sha256 } from '../../shared/hash';
import type {
  JobRecord,
  JobTaskRecord,
  ProjectRepository,
} from '../storage/project-repository';

export type JobStatus =
  | 'awaiting-approval'
  | 'ready'
  | 'running'
  | 'paused'
  | 'failed'
  | 'cancelled'
  | 'completed';

export interface PlannedTask {
  id: string;
  description: string;
}
export type TaskRunner = (task: PlannedTask) => Promise<void>;

export class JobStateError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'JobStateError';
    this.code = code;
  }
}

export class JobOrchestrator {
  constructor(
    private readonly projectId: string,
    private readonly repository: ProjectRepository,
  ) {}

  create(goal: string, tasks: PlannedTask[], branchOf: string | null = null) {
    if (tasks.length === 0) throw new JobStateError('EMPTY_PLAN', 'Goal plan requires tasks');
    const now = new Date().toISOString();
    const id = randomUUID();
    const planHash = sha256({ goal, tasks });
    const job: JobRecord = {
      id,
      projectId: this.projectId,
      goal,
      planHash,
      status: 'awaiting-approval',
      currentTaskIndex: 0,
      branchOf,
      createdAt: now,
      updatedAt: now,
    };
    const taskRecords = tasks.map<JobTaskRecord>((task, index) => ({
      jobId: id,
      taskIndex: index,
      taskId: task.id,
      description: task.description,
      status: 'pending',
      attempts: 0,
      error: null,
    }));
    this.repository.saveJob(job, taskRecords);
    return { job, tasks: taskRecords };
  }

  approvePlan(jobId: string, expectedPlanHash: string) {
    const state = this.require(jobId);
    if (state.job.status !== 'awaiting-approval') {
      throw new JobStateError('INVALID_STATE', 'Only awaiting plans can be approved');
    }
    if (state.job.planHash !== expectedPlanHash) {
      throw new JobStateError('PLAN_CHANGED', 'Plan hash changed before approval');
    }
    return this.updateJob(state.job, 'ready');
  }

  start(jobId: string) {
    const state = this.require(jobId);
    if (state.job.status !== 'ready' && state.job.status !== 'paused') {
      throw new JobStateError('INVALID_STATE', 'Job is not ready to run');
    }
    return this.updateJob(state.job, 'running');
  }

  pause(jobId: string) {
    const state = this.require(jobId);
    if (state.job.status !== 'running') throw new JobStateError('INVALID_STATE', 'Job is not running');
    return this.updateJob(state.job, 'paused');
  }

  cancel(jobId: string) {
    const state = this.require(jobId);
    if (state.job.status === 'completed') throw new JobStateError('INVALID_STATE', 'Completed job cannot cancel');
    return this.updateJob(state.job, 'cancelled');
  }

  retry(jobId: string) {
    const state = this.require(jobId);
    if (state.job.status !== 'failed') throw new JobStateError('INVALID_STATE', 'Job has not failed');
    const task = state.tasks[state.job.currentTaskIndex];
    if (!task) throw new JobStateError('TASK_MISSING', 'Failed task is missing');
    task.status = 'pending';
    task.error = null;
    this.repository.updateJobTask(task);
    return this.updateJob(state.job, 'ready');
  }

  rewind(jobId: string, taskIndex: number) {
    const state = this.require(jobId);
    if (taskIndex < 0 || taskIndex >= state.tasks.length) {
      throw new JobStateError('INVALID_TASK_INDEX', 'Rewind task is outside the plan');
    }
    for (const task of state.tasks) {
      if (task.taskIndex >= taskIndex) {
        task.status = 'pending';
        task.error = null;
        this.repository.updateJobTask(task);
      }
    }
    state.job.currentTaskIndex = taskIndex;
    return this.updateJob(state.job, 'ready');
  }

  branch(jobId: string) {
    const state = this.require(jobId);
    return this.create(
      state.job.goal,
      state.tasks.map((task) => ({ id: task.taskId, description: task.description })),
      state.job.id,
    );
  }

  async runNext(jobId: string, runner: TaskRunner) {
    const state = this.require(jobId);
    if (state.job.status !== 'running') throw new JobStateError('INVALID_STATE', 'Job is not running');
    const task = state.tasks[state.job.currentTaskIndex];
    if (!task) return this.updateJob(state.job, 'completed');
    task.status = 'running';
    task.attempts += 1;
    this.repository.updateJobTask(task);
    try {
      await runner({ id: task.taskId, description: task.description });
      task.status = 'completed';
      task.error = null;
      this.repository.updateJobTask(task);
      state.job.currentTaskIndex += 1;
      const nextStatus = state.job.currentTaskIndex >= state.tasks.length ? 'completed' : 'running';
      return this.updateJob(state.job, nextStatus);
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown task failure';
      this.repository.updateJobTask(task);
      return this.updateJob(state.job, 'failed');
    }
  }

  get(jobId: string) {
    return this.require(jobId);
  }

  private require(jobId: string) {
    const state = this.repository.getJob(jobId);
    if (!state || state.job.projectId !== this.projectId) {
      throw new JobStateError('JOB_NOT_FOUND', 'Job was not found in this project');
    }
    return state;
  }

  private updateJob(job: JobRecord, status: JobStatus) {
    job.status = status;
    job.updatedAt = new Date().toISOString();
    this.repository.updateJob(job);
    return this.require(job.id);
  }
}
