import type { RiskClass } from '../../shared/contracts';
import type { WorkspaceSettings } from '../../shared/desktop-api';

export interface AutomaticAuthorityRequest {
  authority: WorkspaceSettings['actionMode'];
  toolId: string;
  risk: RiskClass;
  planBound: boolean;
}

export interface AutomaticAuthorityDecision {
  allowed: boolean;
  code: string;
  reason: string;
}

const PERMANENT_HUMAN_GATES = new Set([
  'export.package',
  'python.execute',
  'project.delete',
  'provider.dispatch-private-data',
]);

/**
 * Decides whether an already-approved plan may mint an exact action approval
 * without another click. Human approvals omit this policy entirely.
 */
export function evaluateAutomaticAuthority(
  request: AutomaticAuthorityRequest,
): AutomaticAuthorityDecision {
  if (
    PERMANENT_HUMAN_GATES.has(request.toolId) ||
    request.risk === 'destructive' ||
    request.risk === 'privileged'
  ) {
    return {
      allowed: false,
      code: 'PERMANENT_HUMAN_GATE',
      reason: `${request.toolId} always requires a human approval`,
    };
  }
  if (request.authority === 'guided') {
    return {
      allowed: false,
      code: 'GUIDED_CONFIRMATION_REQUIRED',
      reason: 'Guided authority waits for a human before every mutation',
    };
  }
  if (request.authority === 'balanced') {
    return request.risk === 'safe-local'
      ? {
        allowed: true,
        code: 'BALANCED_SAFE_LOCAL',
        reason: 'Balanced authority permits this preconditioned reversible local action',
      }
      : {
        allowed: false,
        code: 'BALANCED_STRUCTURAL_CONFIRMATION_REQUIRED',
        reason: 'Balanced authority requires a human for non-local or structural work',
      };
  }
  if (!request.planBound) {
    return {
      allowed: false,
      code: 'AUTONOMOUS_SCOPE_REQUIRED',
      reason: 'Autonomous continuation requires an exact approved plan scope',
    };
  }
  if (request.risk !== 'safe-local' && request.risk !== 'structural') {
    return {
      allowed: false,
      code: 'AUTONOMOUS_RISK_DENIED',
      reason: `Autonomous authority cannot continue ${request.risk} work`,
    };
  }
  return {
    allowed: true,
    code: 'AUTONOMOUS_PLAN_BOUND',
    reason: 'Autonomous authority may continue inside the exact approved plan scope',
  };
}
