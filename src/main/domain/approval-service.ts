import { randomUUID } from 'node:crypto';
import { sha256 } from '../../shared/hash';
import type { ProjectRepository } from '../storage/project-repository';

export interface ApprovalInput {
  projectId: string;
  planHash: string;
  toolId: string;
  args: Record<string, unknown>;
  sceneRevision: number;
  risk: string;
  ttlMs?: number;
}
export interface ApprovalValidation extends ApprovalInput {
  approvalId: string | null;
}

export class ApprovalService {
  constructor(private readonly repository: ProjectRepository) {}

  approve(input: ApprovalInput): string {
    const id = randomUUID();
    const now = new Date();
    this.repository.saveApproval({
      id,
      projectId: input.projectId,
      planHash: input.planHash,
      toolId: input.toolId,
      argsHash: sha256(input.args),
      sceneRevision: input.sceneRevision,
      risk: input.risk,
      status: 'approved',
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? 15 * 60_000)).toISOString(),
      createdAt: now.toISOString(),
    });
    return id;
  }

  reject(input: ApprovalInput): string {
    const id = this.approve({ ...input, ttlMs: 1 });
    this.repository.updateApprovalStatus(id, 'rejected');
    return id;
  }

  revoke(approvalId: string): void {
    this.repository.updateApprovalStatus(approvalId, 'revoked');
  }

  validate(input: ApprovalValidation): { ok: true } | { ok: false; code: string } {
    if (!input.approvalId) return { ok: false, code: 'APPROVAL_REQUIRED' };
    const approval = this.repository.getApproval(input.approvalId);
    if (!approval || approval.status !== 'approved') return { ok: false, code: 'APPROVAL_INVALID' };
    if (new Date(approval.expiresAt).getTime() <= Date.now()) {
      return { ok: false, code: 'APPROVAL_EXPIRED' };
    }
    if (
      approval.projectId !== input.projectId ||
      approval.planHash !== input.planHash ||
      approval.toolId !== input.toolId ||
      approval.argsHash !== sha256(input.args) ||
      approval.sceneRevision !== input.sceneRevision ||
      approval.risk !== input.risk
    ) {
      return { ok: false, code: 'APPROVAL_SCOPE_MISMATCH' };
    }
    return { ok: true };
  }
}
