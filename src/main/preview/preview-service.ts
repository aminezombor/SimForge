import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScenePreviewManifest } from '../../shared/contracts';
import { ScenePreviewManifestSchema } from '../../shared/contracts';
import { assertContract } from '../../shared/validation';
import type { BlenderBridgeServer } from '../bridge/blender-bridge';
import type { SceneStateService } from '../bridge/scene-state';
import type { ActivityService } from '../domain/activity-service';
import type { ProjectHandle } from '../storage/project-repository';

export class PreviewService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly bridge: BlenderBridgeServer,
    private readonly scene: SceneStateService,
    private readonly activities: ActivityService,
  ) {}

  async generate(): Promise<ScenePreviewManifest> {
    const { snapshot } = await this.scene.refresh();
    const previewId = randomUUID();
    const relativePath = `previews/live/scene-r${snapshot.sceneRevision}-${previewId}.glb`;
    const outputPath = this.resolvePreviewPath(relativePath);
    const response = await this.bridge.request('preview.generate', {
      previewId,
      outputPath,
    }, snapshot.sceneRevision, 60_000);
    const result = asRecord(response.result);
    if (result.previewId !== previewId || path.resolve(String(result.filepath)) !== outputPath) {
      throw new Error('Blender returned preview metadata outside the requested operation');
    }
    const stat = await lstat(outputPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
      throw new Error('Blender preview output is invalid');
    }
    const data = await readFile(outputPath);
    const now = new Date().toISOString();
    const manifest: ScenePreviewManifest = {
      schemaVersion: 1,
      previewId,
      projectId: this.project.manifest.projectId,
      sceneRevision: snapshot.sceneRevision,
      createdAt: now,
      relativePath,
      sha256: createHash('sha256').update(data).digest('hex'),
      bytes: data.byteLength,
      objects: snapshot.objects,
    };
    assertContract<ScenePreviewManifest>(ScenePreviewManifestSchema, manifest, 'scene preview manifest');
    await writeFile(`${outputPath}.json`, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    this.project.repository.saveProjectRecord({
      id: `preview:${previewId}`,
      projectId: this.project.manifest.projectId,
      kind: 'asset',
      body: { type: 'scene-preview', manifest },
      createdAt: now,
      updatedAt: now,
    });
    this.activities.record('viewport', 'preview-generated', `Preview captured at scene revision ${snapshot.sceneRevision}`, {
      previewId,
      sceneRevision: snapshot.sceneRevision,
      objectCount: snapshot.objects.length,
      bytes: data.byteLength,
    });
    return manifest;
  }

  async data(previewId: string): Promise<string> {
    const record = this.project.repository.listProjectRecords(this.project.manifest.projectId)
      .find((candidate) => candidate.id === `preview:${previewId}` && candidate.body.type === 'scene-preview');
    if (!record) throw new Error('Preview was not found in the active project');
    assertContract<ScenePreviewManifest>(ScenePreviewManifestSchema, record.body.manifest, 'stored scene preview');
    const manifest = record.body.manifest;
    const absolute = this.resolvePreviewPath(manifest.relativePath);
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== manifest.bytes) {
      throw new Error('Stored preview failed file verification');
    }
    const data = await readFile(absolute);
    if (createHash('sha256').update(data).digest('hex') !== manifest.sha256) {
      throw new Error('Stored preview failed integrity verification');
    }
    return `data:model/gltf-binary;base64,${data.toString('base64')}`;
  }

  async selectObject(previewId: string, objectId: string): Promise<string> {
    const record = this.project.repository.listProjectRecords(this.project.manifest.projectId)
      .find((candidate) => candidate.id === `preview:${previewId}` && candidate.body.type === 'scene-preview');
    if (!record) throw new Error('Preview was not found in the active project');
    assertContract<ScenePreviewManifest>(ScenePreviewManifestSchema, record.body.manifest, 'stored scene preview');
    const manifest = record.body.manifest;
    if (!manifest.objects.some((object) => object.id === objectId)) {
      throw new Error('Object is not part of the selected preview');
    }
    const { snapshot } = await this.scene.refresh();
    if (snapshot.sceneRevision !== manifest.sceneRevision) {
      throw new Error(`Preview r${manifest.sceneRevision} is stale; refresh before selecting in Blender`);
    }
    await this.bridge.request('selection.set', { objectId }, manifest.sceneRevision);
    this.activities.record('viewport', 'selection-linked', 'Linked embedded selection to Blender', {
      previewId, objectId, sceneRevision: manifest.sceneRevision,
    });
    return objectId;
  }

  private resolvePreviewPath(relative: string): string {
    const root = path.resolve(this.project.root, 'previews');
    const absolute = path.resolve(this.project.root, ...relative.split('/'));
    if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('Preview path escaped preview storage');
    return absolute;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Blender returned invalid preview metadata');
  }
  return value as Record<string, unknown>;
}
