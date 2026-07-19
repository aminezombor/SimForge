import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BlenderBridgeServer } from '../bridge/blender-bridge';
import type { ProjectHandle } from '../storage/project-repository';

export interface CheckpointResult {
  id: string;
  directory: string;
  sceneRevision: number;
  blenderPath: string;
}

interface CapturedFile {
  path: string;
  sha256: string;
  bytes: number;
}

interface CheckpointManifest {
  id: string;
  projectId: string;
  label: string;
  sceneRevision: number;
  blenderPath: string;
  databasePath: string;
  capturedFilesRoot: string;
  capturedFiles: CapturedFile[];
  mode: string;
  activeGoalJobId: string | null;
  latestValidationRunId: string | null;
  createdAt: string;
}

export class CheckpointService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly bridge: BlenderBridgeServer,
  ) {}

  async create(label: string, sceneRevision: number): Promise<CheckpointResult> {
    const id = randomUUID();
    const directory = path.join(this.project.root, 'checkpoints', id);
    const blenderPath = path.join(directory, 'scene.blend');
    await mkdir(directory, { recursive: false });
    const response = await this.bridge.request(
      'checkpoint.create',
      { filepath: blenderPath, label },
      sceneRevision,
      30_000,
    );
    const createdAt = new Date().toISOString();
    const relativeBlenderPath = path.relative(this.project.root, blenderPath).replaceAll('\\', '/');
    const databasePath = path.join(directory, 'project.sqlite');
    this.project.repository.backupTo(databasePath);
    const capturedFilesRoot = path.join(directory, 'files');
    const capturedFiles = await this.captureProjectFiles(capturedFilesRoot);
    const manifest: CheckpointManifest = {
      id,
      projectId: this.project.manifest.projectId,
      label,
      sceneRevision: response.postRevision,
      blenderPath: relativeBlenderPath,
      databasePath: path.relative(this.project.root, databasePath).replaceAll('\\', '/'),
      capturedFilesRoot: path.relative(this.project.root, capturedFilesRoot).replaceAll('\\', '/'),
      capturedFiles,
      mode: this.project.repository.getMode(),
      activeGoalJobId: this.project.repository.getState<string>('activeGoalJobId'),
      latestValidationRunId: this.project.repository.latestValidationRun(this.project.manifest.projectId)?.id ?? null,
      createdAt,
    };
    await writeFile(path.join(directory, 'checkpoint.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    this.project.repository.saveCheckpoint({
      id,
      projectId: this.project.manifest.projectId,
      label,
      sceneRevision: response.postRevision,
      blenderPath: relativeBlenderPath,
      manifest: { ...manifest },
      createdAt,
    });
    return { id, directory, sceneRevision: response.postRevision, blenderPath };
  }

  async restoreProjectState(checkpointId: string): Promise<void> {
    const record = this.project.repository.getCheckpoint(checkpointId);
    if (!record || record.projectId !== this.project.manifest.projectId) {
      throw new Error('Checkpoint does not belong to the active project');
    }
    const manifest = record.manifest as unknown as Partial<CheckpointManifest>;
    if (
      manifest.projectId !== this.project.manifest.projectId ||
      !manifest.databasePath ||
      !manifest.capturedFilesRoot ||
      !Array.isArray(manifest.capturedFiles)
    ) {
      throw new Error('Checkpoint predates complete project-state capture and cannot be restored');
    }
    const databasePath = this.resolveCheckpointPath(manifest.databasePath);
    const capturedRoot = this.resolveCheckpointPath(manifest.capturedFilesRoot);
    await this.verifyCapturedFiles(capturedRoot, manifest.capturedFiles);

    this.project.repository.restoreMutableStateFromBackup(databasePath);
    const restoreRoots = ['references', path.join('scripts', 'generated')];
    for (const relative of restoreRoots) {
      const target = this.resolveProjectPath(relative);
      await rm(target, { recursive: true, force: true });
      await mkdir(target, { recursive: true });
    }
    for (const file of manifest.capturedFiles) {
      const source = path.resolve(capturedRoot, ...file.path.split('/'));
      const target = this.resolveProjectPath(file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }
  }

  private async captureProjectFiles(capturedRoot: string): Promise<CapturedFile[]> {
    const sources = [
      'simforge.project.json',
      'references',
      path.join('scripts', 'generated'),
    ];
    const files: CapturedFile[] = [];
    for (const source of sources) {
      const absolute = this.resolveProjectPath(source);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error(`Checkpoint capture rejects symbolic link: ${source}`);
      if (stat.isDirectory()) {
        for (const file of await this.walkFiles(absolute)) {
          files.push(await this.captureFile(file, capturedRoot));
        }
      } else if (stat.isFile()) {
        files.push(await this.captureFile(absolute, capturedRoot));
      }
    }
    return files.sort((left, right) => left.path.localeCompare(right.path));
  }

  private async walkFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Checkpoint capture rejects symbolic link: ${path.relative(this.project.root, absolute)}`);
      }
      if (entry.isDirectory()) files.push(...await this.walkFiles(absolute));
      else if (entry.isFile()) files.push(absolute);
    }
    return files;
  }

  private async captureFile(source: string, capturedRoot: string): Promise<CapturedFile> {
    const relative = path.relative(this.project.root, source).replaceAll('\\', '/');
    const destination = path.resolve(capturedRoot, ...relative.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    const data = await readFile(destination);
    return {
      path: relative,
      sha256: createHash('sha256').update(data).digest('hex'),
      bytes: data.byteLength,
    };
  }

  private async verifyCapturedFiles(root: string, files: CapturedFile[]): Promise<void> {
    for (const file of files) {
      const absolute = path.resolve(root, ...file.path.split('/'));
      if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('Checkpoint inventory path escaped');
      const stat = await lstat(absolute);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Invalid checkpoint file: ${file.path}`);
      const data = await readFile(absolute);
      const digest = createHash('sha256').update(data).digest('hex');
      if (digest !== file.sha256 || data.byteLength !== file.bytes) {
        throw new Error(`Checkpoint file failed integrity verification: ${file.path}`);
      }
    }
  }

  private resolveProjectPath(relative: string): string {
    const root = path.resolve(this.project.root);
    const absolute = path.resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error('Project path escaped the project root');
    }
    return absolute;
  }

  private resolveCheckpointPath(relative: string): string {
    const absolute = this.resolveProjectPath(relative);
    const checkpointRoot = path.resolve(this.project.root, 'checkpoints');
    if (!absolute.startsWith(`${checkpointRoot}${path.sep}`)) {
      throw new Error('Checkpoint path escaped the checkpoint root');
    }
    return absolute;
  }
}
