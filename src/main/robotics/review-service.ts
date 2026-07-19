import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReviewManifest } from '../../shared/contracts';
import { ReviewManifestSchema } from '../../shared/contracts';
import { assertContract } from '../../shared/validation';
import type { SceneStateService } from '../bridge/scene-state';
import type { ActivityService } from '../domain/activity-service';
import type { ToolExecutor } from '../domain/tool-executor';
import type { ProjectHandle } from '../storage/project-repository';

export class ReviewService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly scene: SceneStateService,
    private readonly executor: ToolExecutor,
    private readonly activities: ActivityService,
  ) {}

  async render(robotId: string, label: string): Promise<ReviewManifest> {
    const cleanLabel = label.trim();
    if (!robotId || !cleanLabel || cleanLabel.length > 128) {
      throw new Error('Robot review identity or label is invalid');
    }
    const { snapshot } = await this.scene.refresh();
    const reviewId = randomUUID();
    const outputDirectory = path.join(
      this.project.root,
      'previews',
      String(snapshot.sceneRevision),
      reviewId,
    );
    const execution = await this.executor.execute('review.render', {
      robotId,
      reviewId,
      label: cleanLabel,
      outputDirectory,
    }, {
      projectId: this.project.manifest.projectId,
      mode: this.project.repository.getMode(),
      planHash: null,
      planApproved: false,
      sceneRevision: snapshot.sceneRevision,
      approvalId: null,
      origin: 'general',
    });
    const result = record(execution.result, 'review result');
    if (!Array.isArray(result.files) || result.materialized !== true) {
      throw new Error('Blender returned an invalid materialized review result');
    }
    const outputRoot = path.resolve(outputDirectory);
    const images: ReviewManifest['images'] = [];
    for (const entry of result.files) {
      const file = record(entry, 'review image');
      if (typeof file.view !== 'string' || typeof file.filepath !== 'string') {
        throw new Error('Blender returned invalid review image metadata');
      }
      const absolute = path.resolve(file.filepath);
      if (!absolute.startsWith(`${outputRoot}${path.sep}`)) {
        throw new Error('Review image escaped the approved output directory');
      }
      const data = await readFile(absolute);
      images.push({
        view: file.view,
        relativePath: path.relative(this.project.root, absolute).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(data).digest('hex'),
        width: number(result.width, 'review width'),
        height: number(result.height, 'review height'),
      });
    }
    const now = new Date().toISOString();
    const manifest: ReviewManifest = {
      schemaVersion: 1,
      reviewId,
      robotId,
      sceneRevision: snapshot.sceneRevision,
      label: cleanLabel,
      materialized: true,
      advisoryOnly: true,
      createdAt: now,
      images,
    };
    assertContract<ReviewManifest>(ReviewManifestSchema, manifest, 'review manifest');
    await writeFile(
      path.join(outputRoot, 'review-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    this.project.repository.saveProjectRecord({
      id: `review:${reviewId}`,
      projectId: this.project.manifest.projectId,
      kind: 'validation',
      body: { type: 'materialized-review', manifest },
      createdAt: now,
      updatedAt: now,
    });
    this.activities.record('validation', 'materialized-review-completed', 'Materialized robot review rendered', {
      reviewId,
      robotId,
      sceneRevision: snapshot.sceneRevision,
      imageCount: images.length,
      advisoryOnly: true,
    });
    return manifest;
  }

  async imageData(reviewId: string, view: string): Promise<string> {
    const recordEntry = this.project.repository.listProjectRecords(this.project.manifest.projectId)
      .find((candidate) => candidate.id === `review:${reviewId}` && candidate.kind === 'validation');
    if (!recordEntry || recordEntry.body.type !== 'materialized-review') {
      throw new Error('Review is unavailable in the active project');
    }
    assertContract<ReviewManifest>(ReviewManifestSchema, recordEntry.body.manifest, 'stored review manifest');
    const image = recordEntry.body.manifest.images.find((candidate) => candidate.view === view);
    if (!image) throw new Error('Review image is unavailable');
    const absolute = path.resolve(this.project.root, ...image.relativePath.split('/'));
    const root = path.resolve(this.project.root, 'previews');
    if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('Review image escaped preview storage');
    const data = await readFile(absolute);
    const digest = createHash('sha256').update(data).digest('hex');
    if (digest !== image.sha256) throw new Error('Review image failed integrity verification');
    return `data:image/png;base64,${data.toString('base64')}`;
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${name}`);
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}
