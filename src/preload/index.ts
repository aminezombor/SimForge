import { contextBridge, ipcRenderer } from 'electron';
import type { Mode } from '../shared/contracts';
import type { SimForgeDesktopApi } from '../shared/desktop-api';

const api: SimForgeDesktopApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  setMode: (mode: Mode) => ipcRenderer.invoke('mode:set', mode),
  refreshScene: () => ipcRenderer.invoke('scene:refresh'),
  executeTool: (input) => ipcRenderer.invoke('tool:execute', input),
  approveAction: (input) => ipcRenderer.invoke('approval:create', input),
  createGoal: (input) => ipcRenderer.invoke('job:create', input),
  approveGoal: (jobId, planHash) => ipcRenderer.invoke('job:approve', jobId, planHash),
  commandGoal: (jobId, command, taskIndex) =>
    ipcRenderer.invoke('job:command', jobId, command, taskIndex),
  getGoal: (jobId) => ipcRenderer.invoke('job:get', jobId),
  runNextGoalTask: (jobId) => ipcRenderer.invoke('job:run-next', jobId),
  providerStatus: (providerId) => ipcRenderer.invoke('provider:status', providerId),
  configureProvider: (providerId, credential) =>
    ipcRenderer.invoke('provider:credential-set', providerId, credential),
  removeProvider: (providerId) => ipcRenderer.invoke('provider:credential-remove', providerId),
  discoverProviderModels: (providerId) => ipcRenderer.invoke('provider:discover', providerId),
  probeProvider: (providerId, modelId) => ipcRenderer.invoke('provider:probe', providerId, modelId),
  probeMockProvider: () => ipcRenderer.invoke('provider:probe-mock'),
  runMockThinSlice: (prompt) => ipcRenderer.invoke('provider:run-mock-slice', prompt),
  getChat: () => ipcRenderer.invoke('conversation:get'),
  sendChat: (message) => ipcRenderer.invoke('conversation:send', message),
  runEnvironmentDoctor: () => ipcRenderer.invoke('doctor:run'),
};

contextBridge.exposeInMainWorld('simforge', api);
