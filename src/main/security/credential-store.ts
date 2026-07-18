import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeStorage } from 'electron';
import { protectUserOnlyFile } from './file-protection';

export interface CredentialStore {
  set(reference: string, secret: string): Promise<void>;
  get(reference: string): Promise<string | null>;
  delete(reference: string): Promise<void>;
}

function assertReference(reference: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(reference)) {
    throw new Error('Invalid credential reference');
  }
}

export class ElectronCredentialStore implements CredentialStore {
  private readonly directory: string;

  constructor(userDataDirectory: string) {
    this.directory = path.join(userDataDirectory, 'credentials');
  }

  async set(reference: string, secret: string): Promise<void> {
    assertReference(reference);
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error('Operating-system credential encryption is unavailable');
    }
    await mkdir(this.directory, { recursive: true });
    const encrypted = await safeStorage.encryptStringAsync(secret);
    await writeFile(this.file(reference), encrypted, { mode: 0o600 });
    await protectUserOnlyFile(this.file(reference));
  }

  async get(reference: string): Promise<string | null> {
    assertReference(reference);
    let encrypted: Buffer;
    try {
      encrypted = await readFile(this.file(reference));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    const decrypted = await safeStorage.decryptStringAsync(encrypted);
    if (decrypted.shouldReEncrypt) {
      await this.set(reference, decrypted.result);
    }
    return decrypted.result;
  }

  async delete(reference: string): Promise<void> {
    assertReference(reference);
    await rm(this.file(reference), { force: true });
  }

  private file(reference: string): string {
    return path.join(this.directory, `${reference}.bin`);
  }
}

export class MemoryCredentialStore implements CredentialStore {
  private readonly values = new Map<string, string>();

  set(reference: string, secret: string): Promise<void> {
    assertReference(reference);
    this.values.set(reference, secret);
    return Promise.resolve();
  }

  get(reference: string): Promise<string | null> {
    assertReference(reference);
    return Promise.resolve(this.values.get(reference) ?? null);
  }

  delete(reference: string): Promise<void> {
    assertReference(reference);
    this.values.delete(reference);
    return Promise.resolve();
  }
}
