import { describe, expect, it } from 'vitest';
import { evaluateAutomaticAuthority } from '../../src/main/domain/action-authority';

describe('action authority policy', () => {
  it('keeps Guided user-controlled and lets Balanced automate only safe local work', () => {
    expect(evaluateAutomaticAuthority({
      authority: 'guided', toolId: 'object.set_location', risk: 'safe-local', planBound: true,
    })).toMatchObject({ allowed: false, code: 'GUIDED_CONFIRMATION_REQUIRED' });
    expect(evaluateAutomaticAuthority({
      authority: 'balanced', toolId: 'object.set_location', risk: 'safe-local', planBound: true,
    })).toMatchObject({ allowed: true, code: 'BALANCED_SAFE_LOCAL' });
    expect(evaluateAutomaticAuthority({
      authority: 'balanced', toolId: 'robot.retract_subtree', risk: 'structural', planBound: true,
    })).toMatchObject({ allowed: false, code: 'BALANCED_STRUCTURAL_CONFIRMATION_REQUIRED' });
  });

  it('binds Autonomous structural continuation to a plan and preserves every hard gate', () => {
    expect(evaluateAutomaticAuthority({
      authority: 'autonomous', toolId: 'robot.retract_subtree', risk: 'structural', planBound: false,
    })).toMatchObject({ allowed: false, code: 'AUTONOMOUS_SCOPE_REQUIRED' });
    expect(evaluateAutomaticAuthority({
      authority: 'autonomous', toolId: 'robot.retract_subtree', risk: 'structural', planBound: true,
    })).toMatchObject({ allowed: true, code: 'AUTONOMOUS_PLAN_BOUND' });
    for (const gate of [
      { toolId: 'export.package', risk: 'structural' as const },
      { toolId: 'object.delete', risk: 'destructive' as const },
      { toolId: 'simulation.run', risk: 'privileged' as const },
      { toolId: 'python.execute', risk: 'privileged' as const },
      { toolId: 'provider.dispatch-private-data', risk: 'structural' as const },
    ]) {
      expect(evaluateAutomaticAuthority({ authority: 'autonomous', planBound: true, ...gate }))
        .toMatchObject({ allowed: false, code: 'PERMANENT_HUMAN_GATE' });
    }
  });
});
