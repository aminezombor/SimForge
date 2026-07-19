import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ExportService } from '../../src/main/export/export-service';

const sandboxes: string[] = [];

function service(): ExportService {
  return new ExportService(
    { root: 'C:\\SimForgeTest' } as never,
    {} as never,
    {} as never,
    {} as never,
    process.cwd(),
  );
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe('export destination policy', () => {
  it('rejects relative paths, drive roots, network paths, and the wrong quick extension', async () => {
    const exports = service();
    await expect(exports.propose('quick', 'relative.usdc', false))
      .rejects.toMatchObject({ code: 'INVALID_DESTINATION' });
    await expect(exports.propose('quick', path.parse(process.cwd()).root, false))
      .rejects.toMatchObject({ code: 'UNSAFE_DESTINATION' });
    await expect(exports.propose('canonical', '\\\\server\\share\\robot', false))
      .rejects.toMatchObject({ code: 'UNSAFE_DESTINATION' });
    await expect(exports.propose('quick', path.resolve('robot.usda'), false))
      .rejects.toMatchObject({ code: 'QUICK_EXTENSION_REQUIRED' });
  });

  it('requires explicit overwrite and preserves destination types', async () => {
    const sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-export-policy-'));
    sandboxes.push(sandbox);
    const exports = service();
    const existingFile = path.join(sandbox, 'existing.usdc');
    await writeFile(existingFile, 'existing', 'utf8');
    await expect(exports.propose('quick', existingFile, false))
      .rejects.toMatchObject({ code: 'OVERWRITE_APPROVAL_REQUIRED' });
    await expect(exports.propose('canonical', existingFile, true))
      .rejects.toMatchObject({ code: 'DESTINATION_TYPE_MISMATCH' });
    const fileShapedDirectory = path.join(sandbox, 'directory.usdc');
    await mkdir(fileShapedDirectory);
    await expect(exports.propose('quick', fileShapedDirectory, true))
      .rejects.toMatchObject({ code: 'DESTINATION_TYPE_MISMATCH' });
  });
});
