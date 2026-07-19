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
    id: 'object.set_location',
    description: 'Move one object to an exact validated world location',
    mutates: true,
    risk: 'safe-local',
    allowedModes: ['normal', 'build', 'goal'],
    approval: 'none',
    checkpoint: 'before',
    bridgeOperation: 'object.set_location',
  },
  {
    id: 'object.apply_scale',
    description: 'Apply object scale while preserving its current world geometry',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'object.apply_scale',
  },
  {
    id: 'robot.materialize',
    description: 'Materialize an approved versioned RobotGraph as Blender geometry and metadata',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'robot.materialize',
  },
  {
    id: 'scene.materialize_assembly',
    description: 'Materialize approved versioned robot and environment graphs as one scene assembly',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'scene.materialize_assembly',
  },
  {
    id: 'review.render',
    description: 'Render a revision-stamped materialized robot review into a unique project directory',
    mutates: true,
    risk: 'safe-local',
    allowedModes: ['normal', 'build', 'goal'],
    approval: 'none',
    checkpoint: 'none',
    bridgeOperation: 'review.render',
  },
  {
    id: 'robot.set_link_pose',
    description: 'Change an approved robot link pose with a displayed structural reason',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'robot.set_link_pose',
  },
  {
    id: 'robot.retract_subtree',
    description: 'Apply one exact simulation-derived translation to a robot subtree',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'robot.retract_subtree',
  },
  {
    id: 'robot.add_sensor',
    description: 'Add one exact-approved sensor representation to an existing robot link',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'robot.add_sensor',
  },
  {
    id: 'import.stage_native',
    description: 'Import one hash-verified project-contained native 3D file into an isolated Blender staging collection',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'import.stage_native',
  },
  {
    id: 'import.accept_native',
    description: 'Accept exact inspected staged native objects into the project scene',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'import.accept_native',
  },
  {
    id: 'import.reject_native',
    description: 'Remove an exact staged native import while retaining its quarantined source and audit report',
    mutates: true,
    risk: 'destructive',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'import.reject_native',
  },
  {
    id: 'checkpoint.restore',
    description: 'Restore the Blender source captured by a project checkpoint',
    mutates: true,
    risk: 'structural',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'before',
    bridgeOperation: 'checkpoint.restore',
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
  {
    id: 'simulation.run',
    description: 'Run one exact-approved deterministic task in the configured local Isaac Sim runtime',
    mutates: false,
    risk: 'privileged',
    allowedModes: ['build', 'goal'],
    approval: 'exact-action',
    checkpoint: 'none',
    bridgeOperation: 'simulation.run',
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
