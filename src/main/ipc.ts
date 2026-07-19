import path from 'node:path';
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { ExportKind, Mode } from '../shared/contracts';
import type {
  ApprovalInput,
  GoalPlanInput,
  ToolExecutionInput,
} from '../shared/desktop-api';
import type { AppRuntime } from './app-runtime';
import type { ExportProposal } from './export/export-service';

const ALLOWED_MODES = new Set<Mode>(['normal', 'plan', 'build', 'goal']);
const ALLOWED_PROVIDERS = new Set(['nvidia', 'openai'] as const);
const ALLOWED_EXPORT_KINDS = new Set<ExportKind>(['quick', 'canonical']);

function providerId(value: unknown): 'nvidia' | 'openai' {
  if (typeof value !== 'string' || !ALLOWED_PROVIDERS.has(value as 'nvidia' | 'openai')) {
    throw new Error('Invalid provider');
  }
  return value as 'nvidia' | 'openai';
}

function assertSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? '';
  if (!url.startsWith('simforge://app/') && !url.startsWith('http://localhost:')) {
    throw new Error('IPC sender is not trusted');
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function registerIpc(runtime: AppRuntime): void {
  const handle = <T extends unknown[], R>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R> | R,
  ) => {
    ipcMain.handle(channel, async (event, ...args: T) => {
      assertSender(event);
      return handler(event, ...args);
    });
  };

  handle('state:get', () => runtime.getState());
  handle('mode:set', (_event, rawMode: unknown) => {
    if (typeof rawMode !== 'string' || !ALLOWED_MODES.has(rawMode as Mode)) {
      throw new Error('Invalid mode');
    }
    return runtime.setMode(rawMode as Mode);
  });
  handle('scene:refresh', () => runtime.refreshScene());
  handle('validation:get-latest', () => runtime.getLatestValidation());
  handle('validation:run', () => runtime.runValidation());
  handle('validation:apply-fix', (_event, rawInput: unknown) => {
    const input = record(rawInput, 'validation fix');
    if (typeof input.findingId !== 'string') throw new Error('Invalid validation finding ID');
    if (input.planHash !== null && typeof input.planHash !== 'string') {
      throw new Error('Invalid validation plan hash');
    }
    if (input.approvalId !== null && typeof input.approvalId !== 'string') {
      throw new Error('Invalid validation approval ID');
    }
    return runtime.applyValidationFix(input.findingId, input.planHash, input.approvalId);
  });
  handle('validation:undo-latest-fix', () => runtime.undoLatestValidationFix());
  handle('checkpoint:list', () => runtime.listCheckpoints());
  handle('checkpoint:approve-restore', (_event, checkpointId: unknown, planHash: unknown) => {
    if (typeof checkpointId !== 'string' || typeof planHash !== 'string' || !planHash) {
      throw new Error('Invalid checkpoint restore approval');
    }
    return runtime.approveCheckpointRestore(checkpointId, planHash);
  });
  handle(
    'checkpoint:restore',
    (_event, checkpointId: unknown, planHash: unknown, approvalId: unknown) => {
      if (
        typeof checkpointId !== 'string' ||
        typeof planHash !== 'string' ||
        typeof approvalId !== 'string'
      ) {
        throw new Error('Invalid checkpoint restore');
      }
      return runtime.restoreCheckpoint(checkpointId, planHash, approvalId);
    },
  );
  handle('robot:proposal-primitive', () => runtime.primitiveRobotProposal());
  handle('robot:build-primitive', (_event, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid robot build approval');
    return runtime.buildPrimitiveRobot(approvalId);
  });
  handle('robot:render-review', (_event, label: unknown) => {
    if (typeof label !== 'string') throw new Error('Invalid review label');
    return runtime.renderPrimitiveRobotReview(label);
  });
  handle('review:image', (_event, reviewId: unknown, view: unknown) => {
    if (typeof reviewId !== 'string' || typeof view !== 'string') throw new Error('Invalid review image request');
    return runtime.getReviewImage(reviewId, view);
  });
  handle('export:choose-destination', async (event, rawKind: unknown) => {
    if (typeof rawKind !== 'string' || !ALLOWED_EXPORT_KINDS.has(rawKind as ExportKind)) {
      throw new Error('Invalid export kind');
    }
    const kind = rawKind as ExportKind;
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (kind === 'quick') {
      const options = {
        title: 'Choose verified quick USD destination',
        defaultPath: 'simforge-robot.usdc',
        filters: [{ name: 'OpenUSD Binary', extensions: ['usdc'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<'createDirectory' | 'showOverwriteConfirmation'>,
      };
      const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
      return result.canceled ? null : result.filePath;
    }
    const options = {
      title: 'Choose parent folder for the canonical SimForge package',
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'] as Array<'openDirectory' | 'createDirectory' | 'promptToCreate'>,
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0]
      ? null
      : path.join(result.filePaths[0], 'simforge-robot-package');
  });
  handle('export:propose', (_event, rawKind: unknown, destination: unknown, overwrite: unknown) => {
    if (
      typeof rawKind !== 'string' || !ALLOWED_EXPORT_KINDS.has(rawKind as ExportKind) ||
      typeof destination !== 'string' || typeof overwrite !== 'boolean'
    ) throw new Error('Invalid export proposal request');
    return runtime.proposeExport(rawKind as ExportKind, destination, overwrite);
  });
  handle('export:execute', (_event, rawProposal: unknown, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid export approval');
    const proposal = record(rawProposal, 'export proposal');
    return runtime.executeExport(proposal as unknown as ExportProposal, approvalId);
  });
  handle('export:list', () => runtime.listExports());
  handle('tool:execute', (_event, rawInput: unknown) => {
    const input = record(rawInput, 'tool execution') as unknown as ToolExecutionInput;
    if (typeof input.toolId !== 'string') throw new Error('Invalid tool ID');
    record(input.args, 'tool arguments');
    return runtime.executeTool(input);
  });
  handle('approval:create', (_event, rawInput: unknown) => {
    const input = record(rawInput, 'approval') as unknown as ApprovalInput;
    if (typeof input.planHash !== 'string' || typeof input.toolId !== 'string') {
      throw new Error('Invalid approval');
    }
    record(input.args, 'approval arguments');
    return runtime.approveAction(input);
  });
  handle('job:create', (_event, rawInput: unknown) => {
    const input = record(rawInput, 'goal plan') as unknown as GoalPlanInput;
    if (typeof input.goal !== 'string' || !Array.isArray(input.tasks)) {
      throw new Error('Invalid goal plan');
    }
    return runtime.createGoal(input);
  });
  handle('job:approve', (_event, jobId: unknown, planHash: unknown) => {
    if (typeof jobId !== 'string' || typeof planHash !== 'string') throw new Error('Invalid job approval');
    runtime.approveGoal(jobId, planHash);
  });
  handle(
    'job:command',
    (
      _event,
      jobId: unknown,
      command: unknown,
      taskIndex?: unknown,
    ) => {
      const commands = new Set(['start', 'pause', 'cancel', 'retry', 'rewind', 'branch']);
      if (typeof jobId !== 'string' || typeof command !== 'string' || !commands.has(command)) {
        throw new Error('Invalid job command');
      }
      if (taskIndex !== undefined && typeof taskIndex !== 'number') throw new Error('Invalid task index');
      return runtime.commandGoal(
        jobId,
        command as 'start' | 'pause' | 'cancel' | 'retry' | 'rewind' | 'branch',
        taskIndex,
      );
    },
  );
  handle('provider:probe-mock', () => runtime.probeMockProvider());
  handle('provider:run-mock-slice', (_event, prompt: unknown) => {
    if (typeof prompt !== 'string') throw new Error('Invalid thin-slice prompt');
    return runtime.runMockThinSlice(prompt);
  });
  handle('job:get', (_event, jobId: unknown) => {
    if (typeof jobId !== 'string') throw new Error('Invalid job ID');
    return runtime.getGoal(jobId);
  });
  handle('job:run-next', (_event, jobId: unknown) => {
    if (typeof jobId !== 'string') throw new Error('Invalid job ID');
    return runtime.runNextGoalTask(jobId);
  });
  handle('provider:status', (_event, rawProvider: unknown) => runtime.providerStatus(providerId(rawProvider)));
  handle('provider:credential-set', (_event, rawProvider: unknown, credential: unknown) => {
    if (typeof credential !== 'string') throw new Error('Invalid provider credential');
    return runtime.configureProvider(providerId(rawProvider), credential);
  });
  handle('provider:credential-remove', (_event, rawProvider: unknown) => runtime.removeProvider(providerId(rawProvider)));
  handle('provider:discover', (_event, rawProvider: unknown) => runtime.discoverProviderModels(providerId(rawProvider)));
  handle('provider:probe', (_event, rawProvider: unknown, modelId: unknown) => {
    if (typeof modelId !== 'string' || !modelId) throw new Error('Invalid model ID');
    return runtime.probeProvider(providerId(rawProvider), modelId);
  });
  handle('doctor:run', () => runtime.runEnvironmentDoctor());
  handle('conversation:get', () => runtime.getChat());
  handle('conversation:send', (_event, message: unknown) => {
    if (typeof message !== 'string') throw new Error('Invalid chat message');
    return runtime.sendChat(message);
  });
}
