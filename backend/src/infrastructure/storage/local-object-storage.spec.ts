import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalObjectStorage } from './local-object-storage';

describe('LocalObjectStorage', () => {
  let root: string;
  let storage: LocalObjectStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'storage-test-'));
    storage = new LocalObjectStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const input = {
    workspaceId: 'ws1',
    fileName: 'brochure.pdf',
    mimeType: 'application/pdf',
    content: Buffer.from('hello attachment'),
  };

  it('stores and reads back an object', async () => {
    const stored = await storage.put(input);
    const content = await storage.get(stored.key);

    expect(content.toString()).toBe('hello attachment');
    expect(stored.sizeBytes).toBe(16);
  });

  it('namespaces keys by workspace', async () => {
    const stored = await storage.put(input);
    expect(stored.key.startsWith('ws1/')).toBe(true);
  });

  it('never uses the supplied filename as the path', async () => {
    const stored = await storage.put({ ...input, fileName: '../../escape.pdf' });

    expect(stored.key).not.toContain('..');
    expect(stored.key.endsWith('.pdf')).toBe(true);
  });

  it('computes a stable checksum for deduplication', async () => {
    const first = await storage.put(input);
    const second = await storage.put(input);

    expect(first.checksum).toBe(second.checksum);
    // Same content, but distinct objects.
    expect(first.key).not.toBe(second.key);
  });

  it('refuses a key that tries to escape the storage root', async () => {
    await expect(storage.get('../../../etc/passwd')).rejects.toThrow();
  });

  it('reports a missing object as not found', async () => {
    await expect(storage.get('ws1/does-not-exist.pdf')).rejects.toThrow(/could not be read/);
  });

  it('deletes an object', async () => {
    const stored = await storage.put(input);
    await storage.delete(stored.key);

    expect(await storage.exists(stored.key)).toBe(false);
  });

  it('deleting a missing object is not an error', async () => {
    await expect(storage.delete('ws1/missing.pdf')).resolves.toBeUndefined();
  });
});
