import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectHandle } from '../storage/project-repository';

export class ApprovedScriptArchive {
  constructor(private readonly project: ProjectHandle) {}

  async archive(args: Record<string, unknown>): Promise<string> {
    const script = String(args.script);
    const scriptHash = String(args.scriptHash);
    const relativeScript = `scripts/generated/${scriptHash}.py`;
    const scriptPath = path.join(this.project.root, ...relativeScript.split('/'));
    try {
      if (await readFile(scriptPath, 'utf8') !== script) {
        throw new Error('Archived script hash collision');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await writeFile(scriptPath, script, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    }
    const now = new Date().toISOString();
    const metadata = {
      scriptHash,
      intent: args.intent,
      allowedPaths: args.allowedPaths,
      relativeScript,
      approved: true,
    };
    const metadataPath = path.join(this.project.root, 'scripts', 'generated', `${scriptHash}.json`);
    try {
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    this.project.repository.saveProjectRecord({
      id: `script:${scriptHash}`,
      projectId: this.project.manifest.projectId,
      kind: 'script',
      body: metadata,
      createdAt: now,
      updatedAt: now,
    });
    return relativeScript;
  }
}
