import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Activity, Mode, SceneSnapshot } from '../../shared/contracts';

const PROJECT_FORMAT_VERSION = 1;

interface ProjectManifest {
  formatVersion: number;
  projectId: string;
  name: string;
  blenderFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectHandle {
  root: string;
  manifest: ProjectManifest;
  repository: ProjectRepository;
}

export interface ApprovalRecord {
  id: string;
  projectId: string;
  planHash: string;
  toolId: string;
  argsHash: string;
  sceneRevision: number;
  risk: string;
  status: 'approved' | 'rejected' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

export interface CheckpointRecord {
  id: string;
  projectId: string;
  label: string;
  sceneRevision: number;
  blenderPath: string | null;
  manifest: Record<string, unknown>;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  projectId: string;
  goal: string;
  planHash: string;
  status: string;
  currentTaskIndex: number;
  branchOf: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobTaskRecord {
  jobId: string;
  taskIndex: number;
  taskId: string;
  description: string;
  status: string;
  attempts: number;
  error: string | null;
}

export interface ProjectRecord {
  id: string;
  projectId: string;
  kind:
    | 'brief' | 'memory' | 'reference' | 'document' | 'plan' | 'decision'
    | 'blender-source' | 'script' | 'action' | 'validation' | 'asset'
    | 'license' | 'export' | 'usage';
  body: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class ProjectRepository {
  readonly root: string;
  readonly databasePath: string;
  private readonly database: DatabaseSync;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.databasePath = path.join(this.root, '.simforge', 'project.sqlite');
    this.database = new DatabaseSync(this.databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
      defensive: true,
    });
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA trusted_schema = OFF;');
    this.migrate();
  }

  close(): void {
    this.database.close();
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS project_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (1, datetime('now'));
      CREATE TABLE IF NOT EXISTS project_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        body_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        parts_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS scene_revisions (
        project_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        source TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(project_id, revision)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        label TEXT NOT NULL,
        scene_revision INTEGER NOT NULL,
        blender_path TEXT,
        manifest_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        plan_hash TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        args_hash TEXT NOT NULL,
        scene_revision INTEGER NOT NULL,
        risk TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        plan_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        current_task_index INTEGER NOT NULL,
        branch_of TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS job_tasks (
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        task_index INTEGER NOT NULL,
        task_id TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        error TEXT,
        PRIMARY KEY(job_id, task_index)
      ) STRICT;
    `);
  }

  setState(key: string, value: unknown): void {
    this.database
      .prepare(
        `INSERT INTO project_state(key, value_json) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
      )
      .run(key, JSON.stringify(value));
  }

  getState<T>(key: string): T | null {
    const row = this.database
      .prepare('SELECT value_json FROM project_state WHERE key = ?')
      .get(key) as { value_json: string } | undefined;
    return row ? (JSON.parse(row.value_json) as T) : null;
  }

  setMode(mode: Mode): void {
    this.setState('mode', mode);
  }

  getMode(): Mode {
    return this.getState<Mode>('mode') ?? 'normal';
  }

  saveProjectRecord(record: ProjectRecord): void {
    this.database
      .prepare(
        `INSERT INTO project_records(id, project_id, kind, body_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET body_json = excluded.body_json, updated_at = excluded.updated_at`,
      )
      .run(
        record.id,
        record.projectId,
        record.kind,
        JSON.stringify(record.body),
        record.createdAt,
        record.updatedAt,
      );
  }

  listProjectRecords(projectId: string): ProjectRecord[] {
    const rows = this.database
      .prepare('SELECT * FROM project_records WHERE project_id = ? ORDER BY created_at, id')
      .all(projectId) as Array<Record<string, string>>;
    return rows.map((row) => ({
      id: row.id ?? '',
      projectId: row.project_id ?? '',
      kind: (row.kind ?? 'document') as ProjectRecord['kind'],
      body: JSON.parse(row.body_json ?? '{}') as Record<string, unknown>,
      createdAt: row.created_at ?? '',
      updatedAt: row.updated_at ?? '',
    }));
  }

  saveConversation(
    conversation: { id: string; projectId: string; title: string; createdAt: string; updatedAt: string },
  ): void {
    this.database
      .prepare(
        `INSERT INTO conversations(id, project_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
      )
      .run(
        conversation.id,
        conversation.projectId,
        conversation.title,
        conversation.createdAt,
        conversation.updatedAt,
      );
  }

  addMessage(message: {
    id: string;
    conversationId: string;
    role: string;
    parts: unknown[];
    createdAt: string;
  }): void {
    this.database
      .prepare(
        `INSERT INTO messages(id, conversation_id, role, parts_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.conversationId,
        message.role,
        JSON.stringify(message.parts),
        message.createdAt,
      );
  }

  listMessages(conversationId: string): Array<{
    id: string;
    role: string;
    parts: unknown[];
    createdAt: string;
  }> {
    const rows = this.database
      .prepare('SELECT id, role, parts_json, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at, id')
      .all(conversationId) as Array<Record<string, string>>;
    return rows.map((row) => ({
      id: row.id ?? '',
      role: row.role ?? '',
      parts: JSON.parse(row.parts_json ?? '[]') as unknown[],
      createdAt: row.created_at ?? '',
    }));
  }

  backupTo(destination: string): void {
    const absolute = path.resolve(destination);
    const escaped = absolute.replaceAll("'", "''");
    this.database.exec(`VACUUM INTO '${escaped}'`);
  }

  addActivity(activity: Activity): void {
    this.database
      .prepare(
        `INSERT INTO activities(id, project_id, phase, kind, summary, details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        activity.id,
        activity.projectId,
        activity.phase,
        activity.kind,
        activity.summary,
        activity.details ? JSON.stringify(activity.details) : null,
        activity.createdAt,
      );
  }

  listActivities(projectId: string, limit = 100): Activity[] {
    const rows = this.database
      .prepare(
        `SELECT id, project_id, phase, kind, summary, details_json, created_at
         FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(projectId, limit) as Array<{
      id: string;
      project_id: string;
      phase: string;
      kind: string;
      summary: string;
      details_json: string | null;
      created_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      phase: row.phase,
      kind: row.kind,
      summary: row.summary,
      ...(row.details_json ? { details: JSON.parse(row.details_json) as Record<string, unknown> } : {}),
      createdAt: row.created_at,
    }));
  }

  saveSceneSnapshot(snapshot: SceneSnapshot, source: 'bridge' | 'manual-event'): void {
    this.database
      .prepare(
        `INSERT INTO scene_revisions(project_id, revision, source, snapshot_json, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id, revision) DO UPDATE SET
           source = excluded.source,
           snapshot_json = excluded.snapshot_json,
           created_at = excluded.created_at`,
      )
      .run(snapshot.projectId, snapshot.sceneRevision, source, JSON.stringify(snapshot), snapshot.capturedAt);
  }

  latestSceneSnapshot(projectId: string): SceneSnapshot | null {
    const row = this.database
      .prepare(
        `SELECT snapshot_json FROM scene_revisions
         WHERE project_id = ? ORDER BY revision DESC LIMIT 1`,
      )
      .get(projectId) as { snapshot_json: string } | undefined;
    return row ? (JSON.parse(row.snapshot_json) as SceneSnapshot) : null;
  }

  saveCheckpoint(checkpoint: CheckpointRecord): void {
    this.database
      .prepare(
        `INSERT INTO checkpoints(
          id, project_id, label, scene_revision, blender_path, manifest_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        checkpoint.id,
        checkpoint.projectId,
        checkpoint.label,
        checkpoint.sceneRevision,
        checkpoint.blenderPath,
        JSON.stringify(checkpoint.manifest),
        checkpoint.createdAt,
      );
  }

  getCheckpoint(id: string): CheckpointRecord | null {
    const row = this.database.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as
      | Record<string, string | number | null>
      | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      label: String(row.label),
      sceneRevision: Number(row.scene_revision),
      blenderPath: row.blender_path === null ? null : String(row.blender_path),
      manifest: JSON.parse(String(row.manifest_json)) as Record<string, unknown>,
      createdAt: String(row.created_at),
    };
  }

  saveApproval(approval: ApprovalRecord): void {
    this.database
      .prepare(
        `INSERT INTO approvals(
          id, project_id, plan_hash, tool_id, args_hash, scene_revision,
          risk, status, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        approval.id,
        approval.projectId,
        approval.planHash,
        approval.toolId,
        approval.argsHash,
        approval.sceneRevision,
        approval.risk,
        approval.status,
        approval.expiresAt,
        approval.createdAt,
      );
  }

  getApproval(id: string): ApprovalRecord | null {
    const row = this.database.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as
      | Record<string, string | number>
      | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      planHash: String(row.plan_hash),
      toolId: String(row.tool_id),
      argsHash: String(row.args_hash),
      sceneRevision: Number(row.scene_revision),
      risk: String(row.risk),
      status: String(row.status) as ApprovalRecord['status'],
      expiresAt: String(row.expires_at),
      createdAt: String(row.created_at),
    };
  }

  updateApprovalStatus(id: string, status: ApprovalRecord['status']): void {
    this.database.prepare('UPDATE approvals SET status = ? WHERE id = ?').run(status, id);
  }

  saveJob(job: JobRecord, tasks: JobTaskRecord[]): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database
        .prepare(
          `INSERT INTO jobs(id, project_id, goal, plan_hash, status, current_task_index, branch_of, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          job.id,
          job.projectId,
          job.goal,
          job.planHash,
          job.status,
          job.currentTaskIndex,
          job.branchOf,
          job.createdAt,
          job.updatedAt,
        );
      const insertTask = this.database.prepare(
        `INSERT INTO job_tasks(job_id, task_index, task_id, description, status, attempts, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const task of tasks) {
        insertTask.run(
          task.jobId,
          task.taskIndex,
          task.taskId,
          task.description,
          task.status,
          task.attempts,
          task.error,
        );
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  updateJob(job: JobRecord): void {
    this.database
      .prepare(
        `UPDATE jobs SET status = ?, current_task_index = ?, updated_at = ? WHERE id = ?`,
      )
      .run(job.status, job.currentTaskIndex, job.updatedAt, job.id);
  }

  updateJobTask(task: JobTaskRecord): void {
    this.database
      .prepare(
        `UPDATE job_tasks SET status = ?, attempts = ?, error = ?
         WHERE job_id = ? AND task_index = ?`,
      )
      .run(task.status, task.attempts, task.error, task.jobId, task.taskIndex);
  }

  getJob(id: string): { job: JobRecord; tasks: JobTaskRecord[] } | null {
    const row = this.database.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as
      | Record<string, string | number | null>
      | undefined;
    if (!row) return null;
    const taskRows = this.database
      .prepare('SELECT * FROM job_tasks WHERE job_id = ? ORDER BY task_index')
      .all(id) as Array<Record<string, string | number | null>>;
    return {
      job: {
        id: String(row.id),
        projectId: String(row.project_id),
        goal: String(row.goal),
        planHash: String(row.plan_hash),
        status: String(row.status),
        currentTaskIndex: Number(row.current_task_index),
        branchOf: row.branch_of === null ? null : String(row.branch_of),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
      tasks: taskRows.map((task) => ({
        jobId: String(task.job_id),
        taskIndex: Number(task.task_index),
        taskId: String(task.task_id),
        description: String(task.description),
        status: String(task.status),
        attempts: Number(task.attempts),
        error: task.error === null ? null : String(task.error),
      })),
    };
  }
}

export class ProjectManager {
  async create(root: string, name: string): Promise<ProjectHandle> {
    const absoluteRoot = path.resolve(root);
    const now = new Date().toISOString();
    const manifest: ProjectManifest = {
      formatVersion: PROJECT_FORMAT_VERSION,
      projectId: randomUUID(),
      name,
      blenderFile: 'scene/project.blend',
      createdAt: now,
      updatedAt: now,
    };
    await Promise.all(
      [
        '.simforge',
        'scene',
        'references',
        path.join('scripts', 'generated'),
        'checkpoints',
        'previews',
        'exports',
        'reports',
      ].map((directory) => mkdir(path.join(absoluteRoot, directory), { recursive: true })),
    );
    await writeFile(
      path.join(absoluteRoot, 'simforge.project.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    const repository = new ProjectRepository(absoluteRoot);
    repository.setState('project', manifest);
    repository.setMode('normal');
    return { root: absoluteRoot, manifest, repository };
  }

  async open(root: string): Promise<ProjectHandle> {
    const absoluteRoot = path.resolve(root);
    const raw = await readFile(path.join(absoluteRoot, 'simforge.project.json'), 'utf8');
    const manifest = JSON.parse(raw) as ProjectManifest;
    if (manifest.formatVersion !== PROJECT_FORMAT_VERSION || !manifest.projectId || !manifest.name) {
      throw new Error('Unsupported or invalid SimForge project manifest');
    }
    const repository = new ProjectRepository(absoluteRoot);
    return { root: absoluteRoot, manifest, repository };
  }
}
