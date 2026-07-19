import { execFile } from 'node:child_process';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { locateUsdRuntime, runUsdWorker } from './export/usd-runtime';
import { inspectIsaacEnvironment } from './isaac/isaac-service';

const execFileAsync = promisify(execFile);

export interface DoctorCheck {
  id:
    | 'blender'
    | 'blender-extension'
    | 'bridge'
    | 'python'
    | 'usd'
    | 'storage'
    | 'loopback'
    | 'gpu-driver'
    | 'nvidia'
    | 'openai'
    | 'isaac';
  ok: boolean;
  severity: 'pass' | 'warning' | 'fail';
  summary: string;
  path: string | null;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function locateBlender(): Promise<string | null> {
  const candidates = [
    process.env.SIMFORGE_BLENDER_PATH,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Blender Foundation', 'Blender 4.5', 'blender.exe') : null,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Blender Foundation', 'Blender 4.5', 'blender.exe') : null,
  ].filter((entry): entry is string => Boolean(entry));
  for (const candidate of candidates) if (await exists(candidate)) return path.resolve(candidate);
  try {
    const { stdout } = await execFileAsync('where.exe', ['blender.exe'], { windowsHide: true });
    return stdout.split(/\r?\n/).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

async function commandVersion(command: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { windowsHide: true });
    return `${stdout}${stderr}`.trim().split(/\r?\n/)[0] ?? null;
  } catch {
    return null;
  }
}

async function writableDirectory(directory: string): Promise<boolean> {
  const probe = path.join(directory, `.simforge-doctor-${process.pid}-${Date.now()}`);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(probe, 'local permission probe', { encoding: 'utf8', flag: 'wx' });
    await rm(probe, { force: true });
    return true;
  } catch {
    await rm(probe, { force: true }).catch(() => undefined);
    return false;
  }
}

async function loopbackAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(0, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

export async function runEnvironmentDoctor(
  appRoot: string,
  userDataDirectory: string,
): Promise<DoctorCheck[]> {
  const blender = await locateBlender();
  const blenderVersion = blender ? await commandVersion(blender, ['--version']) : null;
  const blenderSupported = Boolean(blender && blenderVersion?.includes('Blender 4.5'));
  const python = await commandVersion('py.exe', ['-3.13', '--version']);
  const extensionRoot = path.join(appRoot, 'blender-extension');
  const extension = await Promise.all([
    exists(path.join(extensionRoot, 'blender_manifest.toml')),
    exists(path.join(extensionRoot, 'simforge_bridge', '__init__.py')),
  ]).then((checks) => checks.every(Boolean));
  const storage = await writableDirectory(userDataDirectory);
  const loopback = await loopbackAvailable();
  const gpu = await commandVersion('nvidia-smi.exe', [
    '--query-gpu=name,driver_version,memory.total',
    '--format=csv,noheader',
  ]);
  const isaac = await inspectIsaacEnvironment(appRoot, userDataDirectory);
  let usd: Record<string, unknown> | null;
  let usdPython: string | null;
  try {
    const runtime = await locateUsdRuntime(appRoot);
    usdPython = runtime.python;
    usd = await runUsdWorker(runtime, ['doctor']);
  } catch {
    usd = null;
    usdPython = null;
  }
  return [
    {
      id: 'blender',
      ok: blenderSupported,
      severity: blenderSupported ? 'pass' : 'fail',
      summary: blenderSupported
        ? `${blenderVersion} detected`
        : blender
          ? `${blenderVersion ?? 'Unknown Blender version'} is unsupported; install Blender 4.5 LTS`
          : 'Blender 4.5 LTS is not detected',
      path: blender,
    },
    {
      id: 'blender-extension',
      ok: extension,
      severity: extension ? 'pass' : 'fail',
      summary: extension ? 'Versioned bridge extension is bundled and ready to install' : 'Bundled Blender bridge extension is missing',
      path: extension ? extensionRoot : null,
    },
    {
      id: 'storage',
      ok: storage,
      severity: storage ? 'pass' : 'fail',
      summary: storage ? 'Local project and settings storage is writable' : 'Local data directory is not writable',
      path: userDataDirectory,
    },
    {
      id: 'loopback',
      ok: loopback,
      severity: loopback ? 'pass' : 'fail',
      summary: loopback ? 'A private 127.0.0.1 port can be opened for Blender' : 'Loopback binding failed; check firewall or endpoint protection',
      path: '127.0.0.1 (ephemeral port)',
    },
    {
      id: 'python',
      ok: Boolean(python),
      severity: python ? 'pass' : 'warning',
      summary: python ?? 'Developer Python 3.13 is absent; packaged OpenUSD uses its bundled runtime',
      path: python ? 'py.exe -3.13' : null,
    },
    {
      id: 'usd',
      ok: usd?.ok === true,
      severity: usd?.ok === true ? 'pass' : 'fail',
      summary: usd
        ? `OpenUSD ${typeof usd.usdVersion === 'string' ? usd.usdVersion : 'unknown'} with UsdPhysics on Python ${typeof usd.python === 'string' ? usd.python : 'unknown'}`
        : 'OpenUSD sidecar environment is not bootstrapped',
      path: usd ? usdPython : null,
    },
    {
      id: 'gpu-driver',
      ok: Boolean(gpu),
      severity: gpu ? 'pass' : 'warning',
      summary: gpu ?? 'NVIDIA GPU driver was not reported; Blender authoring and USD export remain available',
      path: gpu ? 'nvidia-smi.exe' : null,
    },
    {
      id: 'isaac',
      ok: isaac.runtimeReady,
      severity: !isaac.runtimeReady
        ? 'warning'
        : isaac.compatibility === 'BELOW_PUBLISHED_MINIMUM'
          ? 'warning'
          : 'pass',
      summary: !isaac.runtimeReady
        ? isaac.issues.join(' ') || 'Isaac Sim runtime is unavailable'
        : `${isaac.product} ${isaac.version} is ready${
          isaac.compatibility === 'BELOW_PUBLISHED_MINIMUM'
            ? `; local hardware is below the published minimum. ${isaac.issues.join(' ')}`
            : ''
        }`,
      path: isaac.pythonPath,
    },
  ];
}
