import { isDeepStrictEqual } from 'node:util';
import type {
  BridgeEvent,
  SceneDiff,
  SceneObject,
  SceneSnapshot,
} from '../../shared/contracts';
import { SceneSnapshotSchema } from '../../shared/contracts';
import { assertContract } from '../../shared/validation';
import type { ProjectRepository } from '../storage/project-repository';
import type { BlenderBridgeServer } from './blender-bridge';

export class SceneStateService {
  private snapshot: SceneSnapshot | null = null;

  constructor(
    private readonly projectId: string,
    private readonly bridge: BlenderBridgeServer,
    private readonly repository: ProjectRepository,
  ) {}

  get current(): SceneSnapshot | null {
    return this.snapshot ?? this.repository.latestSceneSnapshot(this.projectId);
  }

  async refresh(): Promise<{ snapshot: SceneSnapshot; diff: SceneDiff | null }> {
    const previous = this.current;
    const response = await this.bridge.request('scene.snapshot', {}, null);
    assertContract<SceneSnapshot>(SceneSnapshotSchema, response.result, 'scene snapshot');
    this.snapshot = response.result;
    this.repository.saveSceneSnapshot(response.result, 'bridge');
    return {
      snapshot: response.result,
      diff: previous ? diffSnapshots(previous, response.result) : null,
    };
  }

  async handleSceneEvent(event: BridgeEvent): Promise<SceneDiff | null> {
    if (event.projectId !== this.projectId) return null;
    const { diff } = await this.refresh();
    return diff;
  }
}
export function diffSnapshots(before: SceneSnapshot, after: SceneSnapshot): SceneDiff {
  const previous = new Map(before.objects.map((object) => [object.id, object]));
  const current = new Map(after.objects.map((object) => [object.id, object]));
  const added: SceneObject[] = [];
  const removed: SceneObject[] = [];
  const changed: Array<{ before: SceneObject; after: SceneObject }> = [];

  for (const [id, object] of current) {
    const old = previous.get(id);
    if (!old) added.push(object);
    else if (!isDeepStrictEqual(old, object)) changed.push({ before: old, after: object });
  }
  for (const [id, object] of previous) {
    if (!current.has(id)) removed.push(object);
  }
  return {
    fromRevision: before.sceneRevision,
    toRevision: after.sceneRevision,
    added,
    removed,
    changed,
  };
}
