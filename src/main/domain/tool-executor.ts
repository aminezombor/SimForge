import type { Mode } from '../../shared/contracts';
import { sha256Text } from '../../shared/hash';
import { containsLikelySecret } from '../security/secret-redaction';
import type { BlenderBridgeServer } from '../bridge/blender-bridge';
import type { ActivityService } from './activity-service';
import type { ApprovalService } from './approval-service';
import type { ApprovedScriptArchive } from './approved-script-archive';
import type { CheckpointService } from './checkpoint-service';
import { ToolRegistry } from './tool-registry';

export interface ExecutionContext {
  projectId: string;
  mode: Mode;
  planHash: string | null;
  planApproved: boolean;
  sceneRevision: number;
  approvalId: string | null;
}

export class PolicyDeniedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PolicyDeniedError';
    this.code = code;
  }
}

export interface ToolExecutionResult {
  toolId: string;
  result: unknown;
  preRevision: number;
  postRevision: number;
  changedEntityIds: string[];
  checkpointId: string | null;
}

export class ToolExecutor {
  constructor(
    private readonly bridge: BlenderBridgeServer,
    private readonly approvals: ApprovalService,
    private readonly checkpoints: CheckpointService,
    private readonly activities: ActivityService,
    private readonly scriptArchive: ApprovedScriptArchive | null = null,
    private readonly registry = new ToolRegistry(),
  ) {}

  availableTools(mode: Mode) {
    return this.registry.available(mode);
  }

  async execute(
    toolId: string,
    args: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.registry.get(toolId);
    if (!tool) throw new PolicyDeniedError('UNKNOWN_TOOL', `Unknown tool ${toolId}`);
    if (!tool.allowedModes.includes(context.mode)) {
      throw new PolicyDeniedError('MODE_DENIED', `${toolId} is unavailable in ${context.mode} mode`);
    }
    if (context.mode === 'plan' && tool.mutates) {
      throw new PolicyDeniedError('PLAN_MODE_MUTATION_DENIED', 'Plan Mode cannot mutate Blender');
    }
    if (context.mode === 'goal' && tool.mutates && (!context.planApproved || !context.planHash)) {
      throw new PolicyDeniedError('PLAN_APPROVAL_REQUIRED', 'Goal mutations require an approved plan');
    }
    if (tool.approval === 'exact-action') {
      if (!context.planHash) {
        throw new PolicyDeniedError('PLAN_HASH_REQUIRED', 'Risky actions require a bound plan');
      }
      const validation = this.approvals.validate({
        approvalId: context.approvalId,
        projectId: context.projectId,
        planHash: context.planHash,
        toolId,
        args,
        sceneRevision: context.sceneRevision,
        risk: tool.risk,
      });
      if (!validation.ok) {
        throw new PolicyDeniedError(validation.code, `Approval denied: ${validation.code}`);
      }
    }

    if (toolId === 'python.execute') {
      this.validatePythonFallback(args);
    }

    const operationDetails: Record<string, unknown> = {
      mode: context.mode,
      risk: tool.risk,
      sceneRevision: context.sceneRevision,
    };
    if (toolId === 'python.execute') {
      operationDetails.intent = args.intent;
      operationDetails.scriptHash = args.scriptHash;
      operationDetails.allowedPaths = args.allowedPaths;
    }
    this.activities.record('execution', 'tool-started', `Starting ${toolId}`, {
      ...operationDetails,
    });
    let checkpointId: string | null = null;
    if (tool.checkpoint === 'before') {
      const checkpoint = await this.checkpoints.create(`Before ${toolId}`, context.sceneRevision);
      checkpointId = checkpoint.id;
      this.activities.record('execution', 'checkpoint-created', `Checkpoint created before ${toolId}`, {
        checkpointId: checkpoint.id,
        blenderPath: checkpoint.blenderPath,
      });
    }
    if (toolId === 'python.execute' && this.scriptArchive) {
      const relativeScript = await this.scriptArchive.archive(args);
      this.activities.record('execution', 'script-archived', 'Approved Python fallback archived for reuse', {
        relativeScript,
        scriptHash: args.scriptHash,
      });
    }
    const response = await this.bridge.request(
      tool.bridgeOperation,
      args,
      tool.mutates ? context.sceneRevision : null,
    );
    this.activities.record('execution', 'tool-completed', `Completed ${toolId}`, {
      preRevision: response.preRevision,
      postRevision: response.postRevision,
      changedEntityIds: response.changedEntityIds,
    });
    return {
      toolId,
      result: response.result,
      preRevision: response.preRevision,
      postRevision: response.postRevision,
      changedEntityIds: response.changedEntityIds,
      checkpointId,
    };
  }

  private validatePythonFallback(args: Record<string, unknown>): void {
    if (typeof args.intent !== 'string' || !args.intent.trim()) {
      throw new PolicyDeniedError('PYTHON_INTENT_REQUIRED', 'Python fallback requires displayed intent');
    }
    if (typeof args.script !== 'string' || !args.script.trim()) {
      throw new PolicyDeniedError('PYTHON_SCRIPT_REQUIRED', 'Python fallback script is empty');
    }
    if (containsLikelySecret(args.script)) {
      throw new PolicyDeniedError('PYTHON_SECRET_DENIED', 'Python fallback appears to contain a secret');
    }
    if (typeof args.scriptHash !== 'string' || args.scriptHash !== sha256Text(args.script)) {
      throw new PolicyDeniedError('PYTHON_HASH_MISMATCH', 'Python fallback script hash does not match');
    }
    if (!Array.isArray(args.allowedPaths) || args.allowedPaths.some((entry) => typeof entry !== 'string')) {
      throw new PolicyDeniedError('PYTHON_PATHS_REQUIRED', 'Python fallback requires declared allowed paths');
    }
  }
}
