import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  Activity,
  FindingStatus,
  Mode,
  SceneSnapshot,
  ValidationFinding,
  ValidationFixRecord,
  ValidationRun,
} from '../../shared/contracts';

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

export interface ConversationRecord {
  id: string;
  projectId: string;
  title: string;
  branchOf: string | null;
  compactedAt: string | null;
  contextSummary: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  conversationId: string;
  name: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  relativePath: string;
  createdAt: string;
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
      CREATE TABLE IF NOT EXISTS validation_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        scene_revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        channels_json TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS validation_findings (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        severity TEXT NOT NULL,
        entity_path TEXT NOT NULL,
        message TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        assumptions_json TEXT NOT NULL,
        proposed_fix_json TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS validation_fixes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_run_id TEXT NOT NULL REFERENCES validation_runs(id),
        finding_id TEXT NOT NULL REFERENCES validation_findings(id),
        fix_id TEXT NOT NULL,
        fix_class TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        args_json TEXT NOT NULL,
        inverse_tool_id TEXT,
        inverse_args_json TEXT,
        checkpoint_id TEXT,
        pre_revision INTEGER NOT NULL,
        post_revision INTEGER NOT NULL,
        result_run_id TEXT NOT NULL REFERENCES validation_runs(id),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS validation_runs_project_revision
        ON validation_runs(project_id, scene_revision DESC, completed_at DESC);
      CREATE INDEX IF NOT EXISTS validation_findings_run
        ON validation_findings(run_id, rule_id, entity_path);
      CREATE INDEX IF NOT EXISTS validation_fixes_project_status
        ON validation_fixes(project_id, status, created_at DESC);
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (2, datetime('now'));
      CREATE TABLE IF NOT EXISTS conversation_metadata (
        conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
        branch_of TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        compacted_at TEXT,
        context_summary TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        bytes INTEGER NOT NULL CHECK(bytes >= 0),
        sha256 TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS conversations_project_updated
        ON conversations(project_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS attachments_conversation
        ON attachments(conversation_id, created_at, id);
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (3, datetime('now'));
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

  deleteProjectRecord(projectId: string, id: string): void {
    const result = this.database.prepare(
      'DELETE FROM project_records WHERE project_id = ? AND id = ?',
    ).run(projectId, id);
    if (result.changes !== 1) throw new Error('Project record was not found');
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

  listConversations(projectId: string, search = ''): ConversationRecord[] {
    const pattern = `%${search.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    const rows = this.database.prepare(
      `SELECT c.*, m.branch_of, m.compacted_at, m.context_summary,
              COUNT(messages.id) AS message_count
       FROM conversations c
       LEFT JOIN conversation_metadata m ON m.conversation_id = c.id
       LEFT JOIN messages ON messages.conversation_id = c.id
       WHERE c.project_id = ? AND c.title LIKE ? ESCAPE '\\'
       GROUP BY c.id
       ORDER BY c.updated_at DESC, c.id DESC`,
    ).all(projectId, pattern) as Array<Record<string, string | number | null>>;
    return rows.map((row) => this.hydrateConversation(row));
  }

  getConversation(id: string): ConversationRecord | null {
    const row = this.database.prepare(
      `SELECT c.*, m.branch_of, m.compacted_at, m.context_summary,
              COUNT(messages.id) AS message_count
       FROM conversations c
       LEFT JOIN conversation_metadata m ON m.conversation_id = c.id
       LEFT JOIN messages ON messages.conversation_id = c.id
       WHERE c.id = ? GROUP BY c.id`,
    ).get(id) as Record<string, string | number | null> | undefined;
    return row ? this.hydrateConversation(row) : null;
  }

  renameConversation(id: string, title: string, updatedAt: string): void {
    const result = this.database.prepare(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
    ).run(title, updatedAt, id);
    if (result.changes !== 1) throw new Error('Conversation was not found');
  }

  deleteConversation(id: string): void {
    const result = this.database.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    if (result.changes !== 1) throw new Error('Conversation was not found');
  }

  setConversationMetadata(
    conversationId: string,
    metadata: { branchOf: string | null; compactedAt: string | null; contextSummary: string | null },
  ): void {
    this.database.prepare(
      `INSERT INTO conversation_metadata(conversation_id, branch_of, compacted_at, context_summary)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         branch_of = excluded.branch_of,
         compacted_at = excluded.compacted_at,
         context_summary = excluded.context_summary`,
    ).run(conversationId, metadata.branchOf, metadata.compactedAt, metadata.contextSummary);
  }

  copyMessages(sourceConversationId: string, destinationConversationId: string, throughMessageId?: string | null): void {
    const messages = this.listMessages(sourceConversationId);
    const cutoff = throughMessageId === null
      ? -1
      : throughMessageId
        ? messages.findIndex((message) => message.id === throughMessageId)
        : messages.length - 1;
    if (typeof throughMessageId === 'string' && cutoff < 0) throw new Error('Branch message was not found');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const insert = this.database.prepare(
        `INSERT INTO messages(id, conversation_id, role, parts_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const message of messages.slice(0, cutoff + 1)) {
        insert.run(randomUUID(), destinationConversationId, message.role, JSON.stringify(message.parts), message.createdAt);
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  saveAttachment(attachment: AttachmentRecord): void {
    this.database.prepare(
      `INSERT INTO attachments(id, conversation_id, name, media_type, bytes, sha256, relative_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      attachment.id,
      attachment.conversationId,
      attachment.name,
      attachment.mediaType,
      attachment.bytes,
      attachment.sha256,
      attachment.relativePath,
      attachment.createdAt,
    );
  }

  listAttachments(conversationId: string): AttachmentRecord[] {
    const rows = this.database.prepare(
      'SELECT * FROM attachments WHERE conversation_id = ? ORDER BY created_at, id',
    ).all(conversationId) as Array<Record<string, string | number>>;
    return rows.map((row) => ({
      id: String(row.id),
      conversationId: String(row.conversation_id),
      name: String(row.name),
      mediaType: String(row.media_type),
      bytes: Number(row.bytes),
      sha256: String(row.sha256),
      relativePath: String(row.relative_path),
      createdAt: String(row.created_at),
    }));
  }

  getAttachments(ids: string[]): AttachmentRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.database.prepare(`SELECT * FROM attachments WHERE id IN (${placeholders})`)
      .all(...ids) as Array<Record<string, string | number>>;
    const values = rows.map((row) => ({
      id: String(row.id),
      conversationId: String(row.conversation_id),
      name: String(row.name),
      mediaType: String(row.media_type),
      bytes: Number(row.bytes),
      sha256: String(row.sha256),
      relativePath: String(row.relative_path),
      createdAt: String(row.created_at),
    }));
    return ids.map((id) => values.find((value) => value.id === id)).filter((value): value is AttachmentRecord => Boolean(value));
  }

  private hydrateConversation(row: Record<string, string | number | null>): ConversationRecord {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      title: String(row.title),
      branchOf: row.branch_of === null ? null : String(row.branch_of),
      compactedAt: row.compacted_at === null ? null : String(row.compacted_at),
      contextSummary: row.context_summary === null ? null : String(row.context_summary),
      messageCount: Number(row.message_count),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
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

  listCheckpoints(projectId: string, limit = 50): CheckpointRecord[] {
    const rows = this.database.prepare(
      `SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    ).all(projectId, limit) as Array<Record<string, string | number | null>>;
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      label: String(row.label),
      sceneRevision: Number(row.scene_revision),
      blenderPath: row.blender_path === null ? null : String(row.blender_path),
      manifest: JSON.parse(String(row.manifest_json)) as Record<string, unknown>,
      createdAt: String(row.created_at),
    }));
  }

  restoreMutableStateFromBackup(backupPath: string): void {
    const absolute = path.resolve(backupPath);
    const checkpointRoot = `${path.resolve(this.root, 'checkpoints')}${path.sep}`;
    if (!absolute.startsWith(checkpointRoot) || !existsSync(absolute)) {
      throw new Error('Checkpoint database is missing or outside the project checkpoint root');
    }
    const escaped = absolute.replaceAll("'", "''");
    this.database.exec(`ATTACH DATABASE '${escaped}' AS checkpoint_restore`);
    try {
      const hasConversationMetadata = Boolean(this.database.prepare(
        `SELECT 1 FROM checkpoint_restore.sqlite_master WHERE type = 'table' AND name = 'conversation_metadata'`,
      ).get());
      const hasAttachments = Boolean(this.database.prepare(
        `SELECT 1 FROM checkpoint_restore.sqlite_master WHERE type = 'table' AND name = 'attachments'`,
      ).get());
      const restoreConversationMetadata = hasConversationMetadata
        ? 'INSERT INTO conversation_metadata SELECT * FROM checkpoint_restore.conversation_metadata;'
        : '';
      const restoreAttachments = hasAttachments
        ? 'INSERT INTO attachments SELECT * FROM checkpoint_restore.attachments;'
        : '';
      this.database.exec(`
        BEGIN IMMEDIATE;
        DELETE FROM attachments;
        DELETE FROM conversation_metadata;
        DELETE FROM messages;
        DELETE FROM conversations;
        DELETE FROM job_tasks;
        DELETE FROM jobs;
        DELETE FROM project_records;
        DELETE FROM project_state;
        INSERT INTO project_state SELECT * FROM checkpoint_restore.project_state;
        INSERT INTO project_records SELECT * FROM checkpoint_restore.project_records;
        INSERT INTO conversations SELECT * FROM checkpoint_restore.conversations;
        INSERT INTO messages SELECT * FROM checkpoint_restore.messages;
        INSERT INTO jobs SELECT * FROM checkpoint_restore.jobs;
        INSERT INTO job_tasks SELECT * FROM checkpoint_restore.job_tasks;
        ${restoreConversationMetadata}
        ${restoreAttachments}
        COMMIT;
      `);
    } catch (error) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        // The original error is more useful when SQLite already rolled back.
      }
      throw error;
    } finally {
      this.database.exec('DETACH DATABASE checkpoint_restore');
    }
  }

  saveValidationRun(run: ValidationRun): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(
        `INSERT INTO validation_runs(
          id, project_id, scene_revision, status, channels_json, summary_json,
          started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        run.id,
        run.projectId,
        run.sceneRevision,
        run.status,
        JSON.stringify(run.channels),
        JSON.stringify(run.summary),
        run.startedAt,
        run.completedAt,
      );
      const statement = this.database.prepare(
        `INSERT INTO validation_findings(
          id, run_id, rule_id, domain, severity, entity_path, message,
          evidence_json, assumptions_json, proposed_fix_json, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const finding of run.findings) {
        statement.run(
          finding.id,
          finding.runId,
          finding.ruleId,
          finding.domain,
          finding.severity,
          finding.entityPath,
          finding.message,
          JSON.stringify(finding.deterministicEvidence),
          JSON.stringify(finding.assumptions),
          finding.proposedFix ? JSON.stringify(finding.proposedFix) : null,
          finding.status,
          finding.createdAt,
        );
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  latestValidationRun(projectId: string): ValidationRun | null {
    const row = this.database.prepare(
      `SELECT * FROM validation_runs
       WHERE project_id = ? ORDER BY rowid DESC LIMIT 1`,
    ).get(projectId) as Record<string, string | number> | undefined;
    return row ? this.hydrateValidationRun(row) : null;
  }

  getValidationRun(id: string): ValidationRun | null {
    const row = this.database.prepare('SELECT * FROM validation_runs WHERE id = ?')
      .get(id) as Record<string, string | number> | undefined;
    return row ? this.hydrateValidationRun(row) : null;
  }

  getValidationFinding(id: string): ValidationFinding | null {
    const row = this.database.prepare('SELECT * FROM validation_findings WHERE id = ?')
      .get(id) as Record<string, string | null> | undefined;
    return row ? this.hydrateValidationFinding(row) : null;
  }

  setValidationFindingStatus(id: string, status: FindingStatus): void {
    this.database.prepare('UPDATE validation_findings SET status = ? WHERE id = ?').run(status, id);
  }

  saveValidationFix(fix: ValidationFixRecord): void {
    this.database.prepare(
      `INSERT INTO validation_fixes(
        id, project_id, source_run_id, finding_id, fix_id, fix_class, tool_id,
        args_json, inverse_tool_id, inverse_args_json, checkpoint_id, pre_revision,
        post_revision, result_run_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      fix.id,
      fix.projectId,
      fix.sourceRunId,
      fix.findingId,
      fix.fixId,
      fix.fixClass,
      fix.toolId,
      JSON.stringify(fix.args),
      fix.inverseToolId,
      fix.inverseArgs ? JSON.stringify(fix.inverseArgs) : null,
      fix.checkpointId,
      fix.preRevision,
      fix.postRevision,
      fix.resultRunId,
      fix.status,
      fix.createdAt,
      fix.updatedAt,
    );
  }

  latestAppliedValidationFix(projectId: string): ValidationFixRecord | null {
    const row = this.database.prepare(
      `SELECT * FROM validation_fixes
       WHERE project_id = ? AND status = 'APPLIED' AND inverse_tool_id IS NOT NULL
       ORDER BY rowid DESC LIMIT 1`,
    ).get(projectId) as Record<string, string | number | null> | undefined;
    return row ? this.hydrateValidationFix(row) : null;
  }

  markValidationFixUndone(id: string, updatedAt: string): void {
    this.database.prepare(
      `UPDATE validation_fixes SET status = 'UNDONE', updated_at = ? WHERE id = ?`,
    ).run(updatedAt, id);
  }

  private hydrateValidationRun(row: Record<string, string | number>): ValidationRun {
    const runId = String(row.id);
    const findings = this.database.prepare(
      `SELECT * FROM validation_findings WHERE run_id = ? ORDER BY rule_id, entity_path, id`,
    ).all(runId) as Array<Record<string, string | null>>;
    return {
      id: runId,
      projectId: String(row.project_id),
      sceneRevision: Number(row.scene_revision),
      status: 'COMPLETED',
      channels: JSON.parse(String(row.channels_json)) as string[],
      summary: JSON.parse(String(row.summary_json)) as ValidationRun['summary'],
      startedAt: String(row.started_at),
      completedAt: String(row.completed_at),
      findings: findings.map((finding) => this.hydrateValidationFinding(finding)),
    };
  }

  private hydrateValidationFinding(row: Record<string, string | null>): ValidationFinding {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      ruleId: String(row.rule_id),
      domain: String(row.domain) as ValidationFinding['domain'],
      severity: String(row.severity) as ValidationFinding['severity'],
      entityPath: String(row.entity_path),
      message: String(row.message),
      deterministicEvidence: JSON.parse(String(row.evidence_json)) as Record<string, unknown>,
      assumptions: JSON.parse(String(row.assumptions_json)) as string[],
      proposedFix: row.proposed_fix_json === null
        ? null
        : JSON.parse(String(row.proposed_fix_json)) as ValidationFinding['proposedFix'],
      status: String(row.status) as ValidationFinding['status'],
      createdAt: String(row.created_at),
    };
  }

  private hydrateValidationFix(row: Record<string, string | number | null>): ValidationFixRecord {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      sourceRunId: String(row.source_run_id),
      findingId: String(row.finding_id),
      fixId: String(row.fix_id),
      fixClass: String(row.fix_class) as ValidationFixRecord['fixClass'],
      toolId: String(row.tool_id),
      args: JSON.parse(String(row.args_json)) as Record<string, unknown>,
      inverseToolId: row.inverse_tool_id === null ? null : String(row.inverse_tool_id),
      inverseArgs: row.inverse_args_json === null
        ? null
        : JSON.parse(String(row.inverse_args_json)) as Record<string, unknown>,
      checkpointId: row.checkpoint_id === null ? null : String(row.checkpoint_id),
      preRevision: Number(row.pre_revision),
      postRevision: Number(row.post_revision),
      resultRunId: String(row.result_run_id),
      status: String(row.status) as ValidationFixRecord['status'],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
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
        'experiments',
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
