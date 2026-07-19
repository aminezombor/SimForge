import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';

export interface UsdRuntimePaths {
  python: string;
  worker: string;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function locateUsdRuntime(applicationRoot: string): Promise<UsdRuntimePaths> {
  const roots = [
    path.join(applicationRoot, 'usd-runtime'),
    path.join(applicationRoot, '.tools', 'usd-runtime'),
    path.join(applicationRoot, '.venv-usd', 'Scripts'),
  ];
  const worker = path.join(applicationRoot, 'sidecars', 'usd_worker.py');
  if (!await exists(worker)) throw new Error('Pinned OpenUSD worker is missing');
  for (const root of roots) {
    const python = path.join(root, 'python.exe');
    if (await exists(python)) return { python, worker };
  }
  throw new Error('Pinned OpenUSD Python runtime is missing');
}

export async function runUsdWorker(
  runtime: UsdRuntimePaths,
  args: string[],
  timeout = 120_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    execFile(
      runtime.python,
      [runtime.worker, ...args],
      { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        let payload: Record<string, unknown> | null = null;
        for (const line of lines.toReversed()) {
          try {
            const parsed: unknown = JSON.parse(line);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              payload = parsed as Record<string, unknown>;
              break;
            }
          } catch {
            // OpenUSD may emit diagnostics around the worker's JSON envelope.
          }
        }
        if (error || !payload || payload.ok !== true) {
          const message = typeof payload?.message === 'string'
            ? payload.message
            : stderr.trim() || stdout.trim() || error?.message || 'OpenUSD worker returned invalid output';
          reject(new Error(message));
          return;
        }
        resolve(payload);
      },
    );
  });
}
