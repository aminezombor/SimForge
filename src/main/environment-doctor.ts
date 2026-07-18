import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DoctorCheck {
  id: 'blender' | 'python' | 'usd';
  ok: boolean;
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

export async function runEnvironmentDoctor(appRoot: string): Promise<DoctorCheck[]> {
  const blender = await locateBlender();
  const python = await commandVersion('py.exe', ['-3.13', '--version']);
  const usdPython = path.join(appRoot, '.venv-usd', 'Scripts', 'python.exe');
  const usdWorker = path.join(appRoot, 'sidecars', 'usd_worker.py');
  const usd = (await exists(usdPython)) && (await exists(usdWorker))
    ? await commandVersion(usdPython, [usdWorker, 'doctor'])
    : null;
  return [
    {
      id: 'blender',
      ok: Boolean(blender),
      summary: blender ? 'Blender executable detected' : 'Blender 4.5 LTS is not detected',
      path: blender,
    },
    {
      id: 'python',
      ok: Boolean(python),
      summary: python ?? 'Python 3.13 is not detected through the Windows launcher',
      path: python ? 'py.exe -3.13' : null,
    },
    {
      id: 'usd',
      ok: Boolean(usd?.includes('"ok": true')),
      summary: usd ?? 'OpenUSD sidecar environment is not bootstrapped',
      path: usd ? usdPython : null,
    },
  ];
}
