export type ChatIntent =
  | { kind: 'build-robot'; includeDefaultEnvironment: true }
  | { kind: 'export-usd' }
  | { kind: 'simulate-isaac' }
  | {
      kind: 'add-primitive';
      primitive: 'CUBE' | 'CYLINDER' | 'SPHERE';
      name: string;
      location: [number, number, number];
    }
  | { kind: 'general' };

const NUMBER = '-?\\d+(?:\\.\\d+)?';

export function classifyChatIntent(message: string): ChatIntent {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, ' ');

  if (/\b(export|package|save)\b/.test(normalized) && /\busd[acz]?\b|openusd/.test(normalized)) {
    return { kind: 'export-usd' };
  }
  if (/\b(isaac|simulat(?:e|ion)|send (?:it|this|the robot) to (?:the )?sim)/.test(normalized)) {
    return { kind: 'simulate-isaac' };
  }
  if (
    /\b(robot|mobile manipulator)\b/.test(normalized) &&
    /\b(prepare|build|create|make|draw|design|generate|model)\b/.test(normalized) &&
    (/\bwheel(?:ed|s)?\b/.test(normalized) || /\bgripper|grip(?:per)? hand|manipulator\b/.test(normalized))
  ) {
    return { kind: 'build-robot', includeDefaultEnvironment: true };
  }

  const primitive = /\b(cube|box)\b/.test(normalized)
    ? 'CUBE'
    : /\bcylinder\b/.test(normalized)
      ? 'CYLINDER'
      : /\bsphere|ball\b/.test(normalized)
        ? 'SPHERE'
        : null;
  if (primitive && /\b(add|create|place|put|make)\b/.test(normalized)) {
    return {
      kind: 'add-primitive',
      primitive,
      name: `Chat ${primitive[0]}${primitive.slice(1).toLowerCase()}`,
      location: parseLocation(normalized, primitive),
    };
  }

  return { kind: 'general' };
}

export function actionGuidance(intent: ChatIntent): string | null {
  switch (intent.kind) {
    case 'build-robot':
      return 'I prepared a checkpointed build plan for a wheeled mobile manipulator with an arm, gripper, collision geometry, mass properties, sensors, and a generated warehouse workcell. Review the exact action below; Blender changes only after your approval.';
    case 'export-usd':
      return 'I can create a canonical modular OpenUSD package with geometry, materials, physics, sensors, validation evidence, and portable relative references. Choose the destination and approve the exact export below.';
    case 'simulate-isaac':
      return 'I can send the latest verified canonical USD package to the configured Isaac Sim runtime, run deterministic checks, retain evidence, open the experiment, and report the result. Review the exact simulation action below.';
    case 'add-primitive':
      return `I prepared one checkpointed ${intent.primitive.toLowerCase()} at [${intent.location.join(', ')}] metres. Approve the scene edit below and I will place it in Blender.`;
    case 'general':
      return null;
  }
}

function parseLocation(message: string, primitive: 'CUBE' | 'CYLINDER' | 'SPHERE'): [number, number, number] {
  const labelled = new RegExp(`\\bx\\s*[:=]?\\s*(${NUMBER})\\s*[,; ]+\\s*y\\s*[:=]?\\s*(${NUMBER})\\s*[,; ]+\\s*z\\s*[:=]?\\s*(${NUMBER})`).exec(message);
  if (labelled) return [Number(labelled[1]), Number(labelled[2]), Number(labelled[3])];

  const grouped = new RegExp(`(?:at|position(?:ed)?(?: at)?|location(?: at)?)\\s*[\\[(]?\\s*(${NUMBER})\\s*[,;]\\s*(${NUMBER})\\s*[,;]\\s*(${NUMBER})`).exec(message);
  if (grouped) return [Number(grouped[1]), Number(grouped[2]), Number(grouped[3])];

  return [2, 0, primitive === 'SPHERE' ? 0.5 : 0.6];
}
