import type { Mode, RiskClass } from '../../shared/contracts';

export interface ToolDefinition {
  id: string;
  description: string;
  mutates: boolean;
  risk: RiskClass;
  allowedModes: Mode[];
  approval: 'none' | 'exact-action';
  checkpoint: 'none' | 'before';
  bridgeOperation: string;
}
const TOOLS: ToolDefinition[] = [
  {
    id: 'scene.snapshot',
    description: 'Read a fresh structured Blender scene snapshot',
    mutates: false,
    risk: 'read',
    allowedModes: ['normal', 'plan', 'build', 'goal'],
    approval: 'none',
    checkpoint: 'none',
    bridgeOperation: 'scene.snapshot',
  },
  {
    id: 'object.create_primitive',
    description: 'Create one Blender primitive with a stable SimForge identifier',
    mutates: true,
    risk: 'safe-local',
    allowedModes: ['normal', 'build', 'goal'],
    approval: 'none',
    checkpoint: 'before',
    bridgeOperation: 'object.create_primitive',
  },
  {
    id: 'object.delete',
    description: 'Delete an object from the current Blender scene',
    mutates: true,
    risk: 'destructive',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'object.delete',
  },
  {
    id: 'python.execute',
    description: 'Execute an explicitly reviewed Blender Python fallback',
    mutates: true,
    risk: 'privileged',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'python.execute',
  },
  {
    id: 'export.package',
    description: 'Create an explicitly approved export package',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'export.package',
  },
];

export class ToolRegistry {
  private readonly tools = new Map(TOOLS.map((tool) => [tool.id, tool]));

  get(id: string): ToolDefinition | null {
    return this.tools.get(id) ?? null;
  }

  available(mode: Mode): ToolDefinition[] {
    return [...this.tools.values()].filter((tool) => tool.allowedModes.includes(mode));
  }
}
