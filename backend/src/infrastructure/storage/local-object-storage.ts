import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../../shared/errors/app-error';
import type { ObjectStorage, PutObjectInput, StoredObject } from './object-storage';

/**
 * Filesystem-backed storage for development and single-node deployments.
 *
 * Keys are `<workspaceId>/<uuid><ext>`: the workspace prefix keeps tenants
 * separated, and the UUID means a user-supplied filename never becomes a path.
 * Every resolved path is checked to be inside the root, so a crafted key
 * cannot traverse out of it.
 */
export class LocalObjectStorage implements ObjectStorage {
  public readonly name = 'local';

  constructor(private readonly rootDirectory: string) {}

  public async put(input: PutObjectInput): Promise<StoredObject> {
    const extension = this.safeExtension(input.fileName);
    const key = `${input.workspaceId}/${randomUUID()}${extension}`;
    const target = this.resolveKey(key);

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.content);

    return {
      key,
      sizeBytes: input.content.byteLength,
      checksum: createHash('sha256').update(input.content).digest('hex'),
    };
  }

  public async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch {
      throw new AppError('The attachment could not be read', 404, 'ATTACHMENT_NOT_FOUND');
    }
  }

  public async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolves a key inside the root and refuses anything that escapes it.
   * Without this, a key of `../../etc/passwd` would read arbitrary files.
   */
  private resolveKey(key: string): string {
    const resolvedRoot = path.resolve(this.rootDirectory);
    const target = path.resolve(resolvedRoot, key);

    if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
      throw new AppError('Invalid attachment reference', 400, 'ATTACHMENT_KEY_INVALID');
    }

    return target;
  }

  /** Keeps a recognisable extension without trusting the rest of the name. */
  private safeExtension(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '';
  }
}
