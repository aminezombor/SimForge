import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import type { ExportKind, Mode } from '../shared/contracts';
import type {
  ApprovalInput,
  GoalPlanInput,
  ToolExecutionInput,
  WorkspaceSettings,
} from '../shared/desktop-api';
import type { AppRuntime } from './app-runtime';
import type { ExportProposal } from './export/export-service';
import type { NativeImportDecisionProposal, NativeImportProposal } from './import/native-import-service';
import type { IsaacCorrectionProposal, IsaacExperimentProposal } from './isaac/isaac-service';

const ALLOWED_MODES = new Set<Mode>(['normal', 'plan', 'build', 'goal']);
const ALLOWED_PROVIDERS = new Set(['nvidia', 'openai'] as const);
const ALLOWED_EXPORT_KINDS = new Set<ExportKind>(['quick', 'canonical']);
const ALLOWED_MEMORY_SCOPES = new Set(['project', 'global'] as const);

function memoryScope(value: unknown): 'project' | 'global' {
  if (typeof value !== 'string' || !ALLOWED_MEMORY_SCOPES.has(value as 'project' | 'global')) {
    throw new Error('Invalid memory scope');
  }
  return value as 'project' | 'global';
}

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
  handle('scene:proposal-warehouse', () => runtime.warehouseProposal());
  handle('scene:build-warehouse', (_event, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid warehouse build approval');
    return runtime.buildWarehouseScene(approvalId);
  });
  handle('import:get-latest', () => runtime.latestImportReport());
  handle('import:stage-bundled-robot', () => runtime.stageBundledRobotImport());
  handle('import:proposal-robot', () => runtime.importedRobotProposal());
  handle('import:build-robot', (_event, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid imported robot build approval');
    return runtime.buildImportedRobot(approvalId);
  });
  handle('import:proposal-modification', () => runtime.importedRobotModificationProposal());
  handle('import:modify-robot', (_event, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid imported robot modification approval');
    return runtime.modifyImportedRobot(approvalId);
  });
  handle('import:list-native', () => runtime.listNativeImports());
  handle('import:choose-native', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Choose one local 3D file to copy into quarantine',
      filters: [{ name: 'Supported 3D files', extensions: ['blend', 'usd', 'usda', 'usdc', 'usdz', 'glb', 'gltf', 'fbx', 'obj', 'stl'] }],
      properties: ['openFile'] as Array<'openFile'>,
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0] ? null : runtime.prepareNativeImport(result.filePaths[0]);
  });
  handle('import:execute-native', (_event, rawProposal: unknown, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid native import approval');
    return runtime.executeNativeImport(record(rawProposal, 'native import proposal') as unknown as NativeImportProposal, approvalId);
  });
  handle('import:decision-proposal', (_event, importId: unknown, accept: unknown) => {
    if (typeof importId !== 'string' || typeof accept !== 'boolean') throw new Error('Invalid native import decision request');
    return runtime.nativeImportDecisionProposal(importId, accept);
  });
  handle('import:execute-decision', (_event, rawProposal: unknown, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid native import decision approval');
    return runtime.executeNativeImportDecision(record(rawProposal, 'native import decision proposal') as unknown as NativeImportDecisionProposal, approvalId);
  });
  handle('robot:render-review', (_event, label: unknown) => {
    if (typeof label !== 'string') throw new Error('Invalid review label');
    return runtime.renderPrimitiveRobotReview(label);
  });
  handle('review:list', () => runtime.listReviews());
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
  handle('isaac:environment', () => runtime.getIsaacEnvironment());
  handle('isaac:proposal', () => runtime.getIsaacExperimentProposal());
  handle('isaac:run', (_event, rawProposal: unknown, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid Isaac simulation approval');
    return runtime.runIsaacExperiment(
      record(rawProposal, 'Isaac experiment proposal') as unknown as IsaacExperimentProposal,
      approvalId,
    );
  });
  handle('isaac:list', () => runtime.listIsaacExperiments());
  handle('isaac:image', (_event, experimentId: unknown) => {
    if (typeof experimentId !== 'string' || !experimentId) throw new Error('Invalid Isaac experiment ID');
    return runtime.getIsaacExperimentImage(experimentId);
  });
  handle('isaac:images', (_event, experimentId: unknown) => {
    if (typeof experimentId !== 'string' || !experimentId) throw new Error('Invalid Isaac experiment ID');
    return runtime.getIsaacExperimentImages(experimentId);
  });
  handle('isaac:open', (_event, experimentId: unknown) => {
    if (typeof experimentId !== 'string' || !experimentId) throw new Error('Invalid Isaac experiment ID');
    return runtime.openIsaacExperiment(experimentId);
  });
  handle('isaac:analyze', (_event, experimentId: unknown) => {
    if (typeof experimentId !== 'string' || !experimentId) throw new Error('Invalid Isaac experiment ID');
    return runtime.analyzeIsaacExperiment(experimentId);
  });
  handle('isaac:correction-proposal', (_event, experimentId: unknown) => {
    if (typeof experimentId !== 'string' || !experimentId) throw new Error('Invalid Isaac experiment ID');
    return runtime.getIsaacCorrectionProposal(experimentId);
  });
  handle('isaac:correction-apply', (_event, rawProposal: unknown, approvalId: unknown) => {
    if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid Isaac correction approval');
    return runtime.applyIsaacCorrection(
      record(rawProposal, 'Isaac correction proposal') as unknown as IsaacCorrectionProposal,
      approvalId,
    );
  });
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
  handle('conversation:list', (_event, search?: unknown) => {
    if (search !== undefined && typeof search !== 'string') throw new Error('Invalid conversation search');
    return runtime.listConversations(search);
  });
  handle('conversation:create', (_event, title?: unknown) => {
    if (title !== undefined && typeof title !== 'string') throw new Error('Invalid conversation title');
    return runtime.createConversation(title);
  });
  handle('conversation:rename', (_event, conversationId: unknown, title: unknown) => {
    if (typeof conversationId !== 'string' || typeof title !== 'string') throw new Error('Invalid conversation rename');
    return runtime.renameConversation(conversationId, title);
  });
  handle('conversation:delete', (_event, conversationId: unknown) => {
    if (typeof conversationId !== 'string') throw new Error('Invalid conversation delete');
    return runtime.deleteConversation(conversationId);
  });
  handle('conversation:branch', (_event, conversationId: unknown, throughMessageId?: unknown) => {
    if (typeof conversationId !== 'string' || (throughMessageId !== undefined && throughMessageId !== null && typeof throughMessageId !== 'string')) {
      throw new Error('Invalid conversation branch');
    }
    return runtime.branchConversation(conversationId, throughMessageId);
  });
  handle('conversation:get', (_event, conversationId: unknown) => {
    if (typeof conversationId !== 'string') throw new Error('Invalid conversation');
    return runtime.getChat(conversationId);
  });
  handle('conversation:send', (_event, conversationId: unknown, message: unknown, attachmentIds?: unknown) => {
    if (typeof conversationId !== 'string' || typeof message !== 'string' || (attachmentIds !== undefined && !Array.isArray(attachmentIds))) {
      throw new Error('Invalid chat message');
    }
    return runtime.sendChat(conversationId, message, (attachmentIds ?? []) as string[]);
  });
  handle('conversation:stop', (_event, conversationId: unknown) => {
    if (typeof conversationId !== 'string') throw new Error('Invalid conversation');
    runtime.stopChat(conversationId);
  });
  handle('conversation:context', (_event, conversationId: unknown) => {
    if (typeof conversationId !== 'string') throw new Error('Invalid conversation');
    return runtime.getConversationContext(conversationId);
  });
  handle('conversation:compact', (_event, conversationId: unknown) => {
    if (typeof conversationId !== 'string') throw new Error('Invalid conversation');
    return runtime.compactConversation(conversationId);
  });
  handle('attachment:choose', async (event, conversationId: unknown) => {
    if (typeof conversationId !== 'string') throw new Error('Invalid conversation');
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Attach project files',
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [
        { name: 'Supported project files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'json', 'csv', 'urdf', 'xml', 'mjcf', 'obj', 'stl', 'fbx', 'gltf', 'glb', 'usd', 'usda', 'usdc', 'blend'] },
      ],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : runtime.importAttachments(conversationId, result.filePaths);
  });
  handle('attachment:list', (_event, conversationId: unknown) => {
    if (typeof conversationId !== 'string') throw new Error('Invalid conversation');
    return runtime.listAttachments(conversationId);
  });
  handle('workspace:settings-get', () => runtime.getWorkspaceSettings());
  handle('workspace:settings-update', (_event, rawSettings: unknown) => {
    const settings = record(rawSettings, 'workspace settings') as unknown as WorkspaceSettings;
    return runtime.updateWorkspaceSettings(settings);
  });
  handle('memory:list', (_event, rawScope: unknown) => runtime.listMemories(memoryScope(rawScope)));
  handle('memory:save', (_event, rawScope: unknown, title: unknown, content: unknown, id?: unknown) => {
    if (typeof title !== 'string' || typeof content !== 'string' || (id !== undefined && typeof id !== 'string')) {
      throw new Error('Invalid memory');
    }
    return runtime.saveMemory(memoryScope(rawScope), title, content, id);
  });
  handle('memory:delete', (_event, rawScope: unknown, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid memory');
    return runtime.deleteMemory(memoryScope(rawScope), id);
  });
  handle('memory:export', async (event, rawScope: unknown) => {
    const scope = memoryScope(rawScope);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: `Export ${scope} memory`,
      defaultPath: `simforge-${scope}-memory.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<'createDirectory' | 'showOverwriteConfirmation'>,
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : runtime.exportMemories(scope, result.filePath);
  });
  handle('usage:summary', () => runtime.getUsageSummary());
  handle('project:export-data', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Choose a folder for the portable SimForge project copy',
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'] as Array<'openDirectory' | 'createDirectory' | 'promptToCreate'>,
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const projectName = runtime.getState().projectName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
    return runtime.exportProject(path.join(result.filePaths[0], `${projectName}-SimForge-Project`));
  });
  handle('diagnostics:export', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Export sanitized SimForge diagnostics',
      defaultPath: 'simforge-diagnostics.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'] as Array<'createDirectory' | 'showOverwriteConfirmation'>,
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : runtime.exportDiagnostics(result.filePath);
  });
  handle('project:delete-current', async (_event, confirmation: unknown) => {
    if (typeof confirmation !== 'string') throw new Error('Invalid project deletion confirmation');
    const root = await runtime.prepareProjectDeletion(confirmation);
    try {
      await shell.trashItem(root);
    } finally {
      app.relaunch();
      app.exit(0);
    }
  });
  handle('preview:generate', () => runtime.generateScenePreview());
  handle('preview:data', (_event, previewId: unknown) => {
    if (typeof previewId !== 'string' || !previewId) throw new Error('Invalid preview ID');
    return runtime.getScenePreviewData(previewId);
  });
  handle('preview:select-object', (_event, previewId: unknown, objectId: unknown) => {
    if (typeof previewId !== 'string' || typeof objectId !== 'string' || !previewId || !objectId) {
      throw new Error('Invalid preview selection');
    }
    return runtime.selectSceneObject(previewId, objectId);
  });
  handle('scene:open-in-blender', async () => {
    const target = runtime.sceneFilePath();
    const error = await shell.openPath(target);
    if (error) throw new Error(`Could not open the Blender scene: ${error}`);
    return target;
  });
  handle('version:list', () => runtime.listVersions());
  handle('version:create', (_event, name: unknown, checkpointId: unknown, branchOf?: unknown) => {
    if (typeof name !== 'string' || typeof checkpointId !== 'string' || (branchOf !== undefined && typeof branchOf !== 'string')) {
      throw new Error('Invalid named version');
    }
    return runtime.createVersion(name, checkpointId, branchOf);
  });
  handle('timeline:list', () => runtime.getTimeline());
}
