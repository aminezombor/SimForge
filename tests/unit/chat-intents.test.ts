import { describe, expect, it } from 'vitest';
import { actionGuidance, classifyChatIntent } from '../../src/shared/chat-intents';

describe('submission chat intents', () => {
  it('recognizes the owner demo robot request', () => {
    expect(classifyChatIntent('prepare for me in blender a wheeled robot with a gripper hand'))
      .toEqual({ kind: 'build-robot', includeDefaultEnvironment: true });
  });

  it('recognizes verified USD and Isaac follow-up commands', () => {
    expect(classifyChatIntent('export this to USD')).toEqual({ kind: 'export-usd' });
    expect(classifyChatIntent('export this robot to USD for simulation')).toEqual({ kind: 'export-usd' });
    expect(classifyChatIntent('send it to simulation in Isaac Sim')).toEqual({ kind: 'simulate-isaac' });
  });

  it('prepares a bounded primitive placement', () => {
    expect(classifyChatIntent('Add a box at x 2, y -1, z 0.5')).toEqual({
      kind: 'add-primitive', primitive: 'CUBE', name: 'Chat Cube', location: [2, -1, 0.5],
    });
    expect(classifyChatIntent('put a sphere at (1.5, 2, 0.75)')).toMatchObject({
      kind: 'add-primitive', primitive: 'SPHERE', location: [1.5, 2, 0.75],
    });
  });

  it('does not turn ordinary discussion into an action', () => {
    const intent = classifyChatIntent('Why are collision shapes useful?');
    expect(intent).toEqual({ kind: 'general' });
    expect(actionGuidance(intent)).toBeNull();
  });
});
