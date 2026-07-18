import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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

const localAppData = process.env.LOCALAPPDATA;
if (localAppData) app.setPath('userData', path.join(localAppData, 'SimForge'));
app.enableSandbox();

let runtime: AppRuntime | null = null;
let mainWindow: BrowserWindow | null = null;

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
  let providerAcceptance: Record<string, unknown> | null = null;
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
  await writeFile(
    output,
    `${JSON.stringify(
      {
        ok: providerAcceptance ? providerAcceptance.ok === true : true,
        appVersion: app.getVersion(),
        packaged: app.isPackaged,
        projectId: state.projectId,
        mode: state.mode,
        bridgeConnected: state.bridgeConnected,
        rendererSecurity,
        credentialSecurity,
        providerAcceptance,
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

void app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) registerAppProtocol();
  runtime = new AppRuntime(app.getPath('userData'), app.isPackaged ? process.resourcesPath : process.cwd());
  await runtime.initialize();
  registerIpc(runtime);
  if (
    process.argv.includes('--smoke-test') ||
    process.argv.includes('--security-smoke-test') ||
    process.argv.includes('--credential-smoke-test') ||
    process.argv.includes('--provider-acceptance-test')
  ) {
    await runSmokeTest();
    await runtime.shutdown();
    app.quit();
    return;
  }
  await createWindow();
}).catch((error: unknown) => {
  // Keep startup failures out of the renderer while still terminating deterministically.
  process.stderr.write(`SimForge startup failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  void runtime?.shutdown();
});
