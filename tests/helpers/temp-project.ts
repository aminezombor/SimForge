import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectManager, type ProjectHandle } from '../../src/main/storage/project-repository';

export async function makeTempProject(name = 'Test project'): Promise<{
  sandbox: string;
  project: ProjectHandle;
  cleanup: () => Promise<void>;
}> {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-test-'));
  const project = await new ProjectManager().create(path.join(sandbox, 'project'), name);
  return {
    sandbox,
    project,
    cleanup: async () => {
      project.repository.close();
      await rm(sandbox, { recursive: true, force: true });
    },
  };
}
