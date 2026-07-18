import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BlenderBridgeServer } from '../bridge/blender-bridge';
import type { ProjectHandle } from '../storage/project-repository';

export interface CheckpointResult {
  id: string;
  directory: string;
  sceneRevision: number;
  blenderPath: string;
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
    const manifest = {
      id,
      projectId: this.project.manifest.projectId,
      label,
      sceneRevision: response.postRevision,
      blenderPath: relativeBlenderPath,
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
      manifest,
      createdAt,
    });
    return { id, directory, sceneRevision: response.postRevision, blenderPath };
  }
}
