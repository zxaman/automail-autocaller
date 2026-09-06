/**
 * Private object storage abstraction.
 *
 * Attachment bytes must never live in MongoDB, so they go to object storage
 * and only the key is persisted. The application depends on this interface,
 * not on any SDK, so an S3-compatible driver can replace the local one without
 * touching the email code.
 *
 * Nothing here returns a public URL: objects are fetched server-side when a
 * message is assembled.
 */

export interface StoredObject {
  key: string;
  sizeBytes: number;
  checksum: string;
}

export interface PutObjectInput {
  /** Namespacing prefix, always the workspace id, so keys cannot collide. */
  workspaceId: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
}

export interface ObjectStorage {
  readonly name: string;
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
