import { execFile } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function protectUserOnlyFile(file: string): Promise<void> {
  if (process.platform !== 'win32') {
    await chmod(file, 0o600);
    return;
  }
  const { stdout } = await execFileAsync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    windowsHide: true,
  });
  const sid = stdout.match(/S-1-(?:\d+-)+\d+/)?.[0];
  if (!sid) throw new Error('Unable to identify the current Windows user SID');
  await execFileAsync(
    'icacls.exe',
    [file, '/inheritance:r', '/grant:r', `*${sid}:(F)`],
    { windowsHide: true },
  );
}
