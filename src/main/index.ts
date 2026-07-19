import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  net as electronNet,
  protocol,
  session,
} from 'electron';
import { AppRuntime } from './app-runtime';
import { registerIpc } from './ipc';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'simforge',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

const smokeArguments = [
  '--smoke-test',
  '--security-smoke-test',
  '--credential-smoke-test',
  '--privacy-smoke-test',
  '--provider-acceptance-test',
  '--design-capture-test',
] as const;
const smokeMode = smokeArguments.some((argument) => process.argv.includes(argument));
const isolatedUserDataArgument = process.argv.find((argument) => argument.startsWith('--user-data-dir='));
const localAppData = process.env.LOCALAPPDATA;
if (smokeMode && isolatedUserDataArgument) {
  const isolatedUserData = path.resolve(isolatedUserDataArgument.slice('--user-data-dir='.length));
  app.setPath('userData', isolatedUserData);
} else if (localAppData) {
  app.setPath('userData', path.join(localAppData, 'SimForge'));
}
app.enableSandbox();

let runtime: AppRuntime | null = null;
let mainWindow: BrowserWindow | null = null;
let shutdownStarted = false;
let shutdownComplete = false;

async function shutdownThenQuit(): Promise<void> {
  if (!shutdownStarted) {
    shutdownStarted = true;
    try {
      await runtime?.shutdown();
    } finally {
      shutdownComplete = true;
    }
  }
  app.quit();
}

function registerAppProtocol(): void {
  const rendererRoot = path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
  protocol.handle('simforge', (request) => {
    const requestUrl = new URL(request.url);
    const relative = decodeURIComponent(requestUrl.pathname.replace(/^\//, '') || 'index.html');
    const target = path.resolve(rendererRoot, relative);
    if (target !== rendererRoot && !target.startsWith(`${rendererRoot}${path.sep}`)) {
      return new Response('Not found', { status: 404 });
    }
    return electronNet.fetch(pathToFileURL(target).toString());
  });
}

async function createWindow(showWhenReady = true): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#090f16',
    title: 'SimForge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const trusted = url.startsWith('simforge://app/') || url.startsWith('http://localhost:');
    if (!trusted) event.preventDefault();
  });
  if (showWhenReady) mainWindow.once('ready-to-show', () => mainWindow?.show());
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadURL('simforge://app/index.html');
  }
}

async function runSmokeTest(): Promise<void> {
  const output = process.env.SIMFORGE_SMOKE_RESULT;
  const state = runtime?.getState();
  if (!output || !state) throw new Error('Smoke test output or state is unavailable');
  await mkdir(path.dirname(output), { recursive: true });
  let rendererSecurity: Record<string, unknown> | null = null;
  let credentialSecurity: Record<string, unknown> | null = null;
  let privacySecurity: Record<string, unknown> | null = null;
  let providerAcceptance: Record<string, unknown> | null = null;
  let designCapture: Record<string, unknown> | null = null;
  if (process.argv.includes('--design-capture-test')) {
    const captureDirectory = process.env.SIMFORGE_DESIGN_CAPTURE_DIR;
    if (!captureDirectory) throw new Error('Design capture directory is unavailable');
    await mkdir(captureDirectory, { recursive: true });
    await createWindow(false);
    mainWindow!.setContentSize(1280, 720);
    await mainWindow!.webContents.executeJavaScript(`(async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !document.querySelector('.workspace-grid')) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const build = [...document.querySelectorAll('.mode-switcher button')]
        .find((button) => button.textContent?.trim() === 'Build');
      if (!(build instanceof HTMLButtonElement)) throw new Error('Build mode control is unavailable');
      build.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const canvas = document.querySelector('.conversation-canvas');
      if (!(canvas instanceof HTMLElement)) throw new Error('Conversation canvas is unavailable');
      canvas.scrollTop = 0;
      await new Promise((resolve) => setTimeout(resolve, 100));
    })()`);
    const workspacePath = path.join(captureDirectory, 'workspace-1280x720.png');
    await writeFile(workspacePath, (await mainWindow!.webContents.capturePage()).toPNG());
    await mainWindow!.webContents.executeJavaScript(`(async () => {
      const canvas = document.querySelector('.conversation-canvas');
      if (!(canvas instanceof HTMLElement)) throw new Error('Conversation canvas is unavailable');
      canvas.scrollTop = canvas.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, 100));
    })()`);
    const importPath = path.join(captureDirectory, 'import-workflows-1280x720.png');
    await writeFile(importPath, (await mainWindow!.webContents.capturePage()).toPNG());
    designCapture = { workspacePath, importPath, width: 1280, height: 720 };
    mainWindow!.destroy();
    mainWindow = null;
  }
  if (process.argv.includes('--security-smoke-test')) {
    await createWindow(false);
    rendererSecurity = await mainWindow?.webContents.executeJavaScript(`(async () => {
      const before = location.href;
      let opened = null;
      try { opened = window.open('https://example.invalid'); } catch { opened = null; }
      try { location.href = 'https://example.invalid'; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        requireType: typeof globalThis.require,
        processType: typeof globalThis.process,
        exposedApi: Object.keys(globalThis.simforge ?? {}).sort(),
        remoteWindowOpened: Boolean(opened),
        navigationStayedLocal: location.href === before,
        csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? null,
      };
    })()` ) as Record<string, unknown>;
    mainWindow?.destroy();
    mainWindow = null;
  }
  if (process.argv.includes('--credential-smoke-test')) {
    const secret = `simforge-smoke-${randomBytes(24).toString('hex')}`;
    const configured = await runtime?.configureProvider('nvidia', secret);
    const plaintextPresentWhileStored = await directoryContainsBytes(app.getPath('userData'), Buffer.from(secret));
    const removed = await runtime?.removeProvider('nvidia');
    const plaintextPresentAfterRemoval = await directoryContainsBytes(app.getPath('userData'), Buffer.from(secret));
    credentialSecurity = {
      configured: configured?.configured ?? false,
      plaintextPresentWhileStored,
      removed: !(removed?.configured ?? true),
      plaintextPresentAfterRemoval,
    };
  }
  if (process.argv.includes('--privacy-smoke-test')) {
    const projectSentinel = `project-memory-${randomBytes(12).toString('hex')}`;
    const globalSentinel = `global-memory-${randomBytes(12).toString('hex')}`;
    runtime!.saveMemory('project', 'Privacy smoke project memory', projectSentinel);
    runtime!.saveMemory('global', 'Privacy smoke global memory', globalSentinel);
    const diagnosticsPath = path.join(app.getPath('userData'), 'privacy-smoke-diagnostics.json');
    const projectExportPath = path.join(app.getPath('userData'), 'privacy-smoke-project-export');
    await runtime!.exportDiagnostics(diagnosticsPath);
    await runtime!.exportProject(projectExportPath);
    const diagnostics = await readFile(diagnosticsPath, 'utf8');
    let wrongDeletionConfirmationRejected = false;
    try {
      await runtime!.prepareProjectDeletion('incorrect-project-name');
    } catch {
      wrongDeletionConfirmationRejected = true;
    }
    privacySecurity = {
      diagnosticsCreated: true,
      diagnosticsContainsProjectMemory: diagnostics.includes(projectSentinel),
      diagnosticsContainsGlobalMemory: diagnostics.includes(globalSentinel),
      diagnosticsContainsPrivateRoot: diagnostics.includes(app.getPath('userData')),
      projectExportCreated: true,
      projectExportContainsProjectMemory: await directoryContainsBytes(projectExportPath, Buffer.from(projectSentinel)),
      projectExportContainsGlobalMemory: await directoryContainsBytes(projectExportPath, Buffer.from(globalSentinel)),
      projectExportContainsGlobalDatabase: await fileExists(path.join(projectExportPath, 'global.sqlite')),
      wrongDeletionConfirmationRejected,
    };
  }
  if (process.argv.includes('--provider-acceptance-test')) {
    const intendedModel = 'nvidia/nemotron-3-ultra-550b-a55b';
    try {
      const models = await runtime!.discoverProviderModels('nvidia');
      const discovered = models.some((model) => model.modelId === intendedModel);
      if (discovered) {
        const probe = await runtime!.probeProvider('nvidia', intendedModel);
        providerAcceptance = {
          ok: true,
          discoveredModelCount: models.length,
          intendedModelDiscovered: true,
          modelId: probe.model.modelId,
          capabilities: probe.model.capabilities,
          disclosure: probe.disclosure,
        };
      } else {
        providerAcceptance = {
          ok: false,
          discoveredModelCount: models.length,
          intendedModelDiscovered: false,
          error: 'Intended Nemotron model was not returned by runtime discovery',
        };
      }
    } catch (error) {
      providerAcceptance = {
        ok: false,
        error: error instanceof Error ? error.message : 'NVIDIA acceptance probe failed',
      };
    }
  }
  if (privacySecurity) {
    const deletionRoot = await runtime!.prepareProjectDeletion(state.projectName);
    await shellTrash(deletionRoot);
    privacySecurity.projectDeletedToRecycleBin = !(await pathExists(deletionRoot));
  }
  const privacyOk = !privacySecurity || (
    privacySecurity.diagnosticsCreated === true &&
    privacySecurity.diagnosticsContainsProjectMemory === false &&
    privacySecurity.diagnosticsContainsGlobalMemory === false &&
    privacySecurity.diagnosticsContainsPrivateRoot === false &&
    privacySecurity.projectExportCreated === true &&
    privacySecurity.projectExportContainsProjectMemory === true &&
    privacySecurity.projectExportContainsGlobalMemory === false &&
    privacySecurity.projectExportContainsGlobalDatabase === false &&
    privacySecurity.wrongDeletionConfirmationRejected === true &&
    privacySecurity.projectDeletedToRecycleBin === true
  );
  await writeFile(
    output,
    `${JSON.stringify(
      {
        ok: (providerAcceptance ? providerAcceptance.ok === true : true) && privacyOk,
        appVersion: app.getVersion(),
        packaged: app.isPackaged,
        projectId: state.projectId,
        mode: state.mode,
        bridgeConnected: state.bridgeConnected,
        rendererSecurity,
        credentialSecurity,
        privacySecurity,
        providerAcceptance,
        designCapture,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function directoryContainsBytes(directory: string, needle: Buffer): Promise<boolean> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (await directoryContainsBytes(target, needle)) return true;
    } else if (entry.isFile()) {
      try {
        if ((await readFile(target)).includes(needle)) return true;
      } catch {
        // Locked browser cache files are irrelevant to the credential assertion.
      }
    }
  }
  return false;
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await readFile(target);
    return true;
  } catch {
    return false;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function shellTrash(target: string): Promise<void> {
  const { shell } = await import('electron');
  await shell.trashItem(target);
}

void app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) registerAppProtocol();
  runtime = new AppRuntime(app.getPath('userData'), app.isPackaged ? process.resourcesPath : process.cwd());
  await runtime.initialize();
  registerIpc(runtime);
  if (smokeMode) {
    await runSmokeTest();
    await runtime.shutdown();
    shutdownStarted = true;
    shutdownComplete = true;
    app.quit();
    return;
  }
  await createWindow();
}).catch((error: unknown) => {
  // Keep startup failures out of the renderer while still terminating deterministically.
  process.stderr.write(`SimForge startup failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  app.quit();
});

app.on('window-all-closed', () => {
  if (!smokeMode) app.quit();
});
app.on('before-quit', (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  void shutdownThenQuit();
});
