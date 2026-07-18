import { randomUUID } from 'node:crypto';
import type { Activity } from '../../shared/contracts';
import type { ProjectRepository } from '../storage/project-repository';

export class ActivityService {
  constructor(
    private readonly projectId: string,
    private readonly repository: ProjectRepository,
  ) {}

  record(
    phase: string,
    kind: string,
    summary: string,
    details?: Record<string, unknown>,
  ): Activity {
    const activity: Activity = {
      id: randomUUID(),
      projectId: this.projectId,
      phase,
      kind,
      summary,
      ...(details ? { details } : {}),
      createdAt: new Date().toISOString(),
    };
    this.repository.addActivity(activity);
    return activity;
  }

  list(limit = 100): Activity[] {
    return this.repository.listActivities(this.projectId, limit);
  }
}
