import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface RegisteredProject {
  projectId: string;
  name: string;
  root: string;
  lastOpenedAt: string;
}

export class GlobalRepository {
  readonly databasePath: string;
  private readonly database: DatabaseSync;

  constructor(userDataDirectory: string) {
    const root = path.resolve(userDataDirectory);
    mkdirSync(root, { recursive: true });
    this.databasePath = path.join(root, 'global.sqlite');
    this.database = new DatabaseSync(this.databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
      defensive: true,
    });
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA trusted_schema = OFF;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (1, datetime('now'));
      CREATE TABLE IF NOT EXISTS application_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS projects (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root TEXT NOT NULL UNIQUE,
        last_opened_at TEXT NOT NULL
      ) STRICT;
    `);
  }

  close(): void {
    this.database.close();
  }

  setState(key: string, value: unknown): void {
    this.database.prepare(
      `INSERT INTO application_state(key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ).run(key, JSON.stringify(value));
  }

  getState<T>(key: string): T | null {
    const row = this.database.prepare('SELECT value_json FROM application_state WHERE key = ?').get(key) as
      | { value_json: string }
      | undefined;
    return row ? JSON.parse(row.value_json) as T : null;
  }

  deleteState(key: string): void {
    this.database.prepare('DELETE FROM application_state WHERE key = ?').run(key);
  }

  registerProject(project: RegisteredProject): void {
    const resolvedRoot = path.resolve(project.root);
    this.database.prepare(
      'DELETE FROM projects WHERE root = ? AND project_id <> ?',
    ).run(resolvedRoot, project.projectId);
    this.database.prepare(
      `INSERT INTO projects(project_id, name, root, last_opened_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         name = excluded.name, root = excluded.root, last_opened_at = excluded.last_opened_at`,
    ).run(project.projectId, project.name, resolvedRoot, project.lastOpenedAt);
  }

  listProjects(): RegisteredProject[] {
    const rows = this.database.prepare(
      'SELECT project_id, name, root, last_opened_at FROM projects ORDER BY last_opened_at DESC',
    ).all() as Array<Record<string, string>>;
    return rows.map((row) => ({
      projectId: row.project_id ?? '',
      name: row.name ?? '',
      root: row.root ?? '',
      lastOpenedAt: row.last_opened_at ?? '',
    }));
  }

  unregisterProject(projectId: string): void {
    this.database.prepare('DELETE FROM projects WHERE project_id = ?').run(projectId);
  }
}
