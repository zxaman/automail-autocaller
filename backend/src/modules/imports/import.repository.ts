import type { Types } from 'mongoose';

import { ContactModel, type ContactDocument } from '../contacts/contact.model';
import { ImportBatchModel, type ImportBatchDocument, type ImportRowError, type ImportStatus } from './import-batch.model';

export interface ImportScope {
  workspaceId: Types.ObjectId;
}

export interface ContactInsertAttributes {
  name: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  company: string | null;
  designation: string | null;
  location: string | null;
  tags: string[];
  notes: string | null;
}

/** Existing contacts keyed for duplicate lookup. */
export interface ExistingContactIndex {
  byEmail: Map<string, ContactDocument>;
  byPhone: Map<string, ContactDocument>;
}

/**
 * Data access for imports. Like the contact repository, every query is folded
 * with workspaceId so an import can never read or write another workspace.
 */
export class ImportRepository {
  /**
   * Loads only the contacts that the incoming file could collide with.
   *
   * Fetching the whole address book to diff in memory would not survive a large
   * workspace, so the candidate set is bounded by the file's own values.
   */
  public async loadExistingIndex(
    scope: ImportScope,
    emails: readonly string[],
    phones: readonly string[],
  ): Promise<ExistingContactIndex> {
    const byEmail = new Map<string, ContactDocument>();
    const byPhone = new Map<string, ContactDocument>();

    if (emails.length === 0 && phones.length === 0) {
      return { byEmail, byPhone };
    }

    const clauses: Record<string, unknown>[] = [];
    if (emails.length > 0) {
      clauses.push({ email: { $in: emails } });
    }
    if (phones.length > 0) {
      clauses.push({ phoneNormalized: { $in: phones } });
    }

    const contacts = await ContactModel.find({
      workspaceId: scope.workspaceId,
      $or: clauses,
    }).exec();

    for (const contact of contacts) {
      if (contact.email) {
        byEmail.set(contact.email, contact);
      }
      if (contact.phoneNormalized) {
        byPhone.set(contact.phoneNormalized, contact);
      }
    }

    return { byEmail, byPhone };
  }

  /**
   * Bulk insert with `ordered: false` so one bad row cannot abort the batch;
   * the caller reconciles write errors back to row numbers.
   */
  public async insertContacts(
    scope: ImportScope,
    ownerId: Types.ObjectId,
    batchId: Types.ObjectId,
    attributes: readonly ContactInsertAttributes[],
  ): Promise<{ insertedCount: number; failedIndexes: Map<number, string> }> {
    if (attributes.length === 0) {
      return { insertedCount: 0, failedIndexes: new Map() };
    }

    const documents = attributes.map((entry) => ({
      ...entry,
      workspaceId: scope.workspaceId,
      ownerId,
      source: 'import' as const,
      importBatchId: batchId,
    }));

    try {
      const inserted = await ContactModel.insertMany(documents, { ordered: false });
      return { insertedCount: inserted.length, failedIndexes: new Map() };
    } catch (error) {
      return this.reconcileBulkError(error, attributes.length);
    }
  }

  public async updateContact(
    scope: ImportScope,
    contactId: Types.ObjectId,
    attributes: Partial<ContactInsertAttributes>,
  ): Promise<void> {
    await ContactModel.updateOne(
      { _id: contactId, workspaceId: scope.workspaceId },
      { $set: attributes },
      { runValidators: true },
    ).exec();
  }

  public async createBatch(
    scope: ImportScope,
    ownerId: Types.ObjectId,
    fileName: string,
    fileSizeBytes: number,
  ): Promise<ImportBatchDocument> {
    return ImportBatchModel.create({
      workspaceId: scope.workspaceId,
      ownerId,
      fileName,
      fileSizeBytes,
      status: 'processing',
    });
  }

  public async completeBatch(
    scope: ImportScope,
    batchId: Types.ObjectId,
    update: {
      status: ImportStatus;
      totalRows: number;
      successfulRows: number;
      duplicateRows: number;
      failedRows: number;
      errors: ImportRowError[];
    },
  ): Promise<ImportBatchDocument | null> {
    return ImportBatchModel.findOneAndUpdate(
      { _id: batchId, workspaceId: scope.workspaceId },
      { $set: { ...update, importedAt: new Date() } },
      { new: true },
    ).exec();
  }

  public async listBatches(scope: ImportScope, limit: number): Promise<ImportBatchDocument[]> {
    return ImportBatchModel.find({ workspaceId: scope.workspaceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  public async findBatchById(
    scope: ImportScope,
    batchId: string,
  ): Promise<ImportBatchDocument | null> {
    return ImportBatchModel.findOne({ _id: batchId, workspaceId: scope.workspaceId }).exec();
  }

  /**
   * `insertMany` with ordered:false throws even on partial success, carrying a
   * writeErrors array. Mapping those indexes back gives per-row reporting.
   */
  private reconcileBulkError(
    error: unknown,
    attempted: number,
  ): { insertedCount: number; failedIndexes: Map<number, string> } {
    const failedIndexes = new Map<number, string>();
    const bulkError = error as {
      insertedDocs?: unknown[];
      writeErrors?: { index: number; code?: number; errmsg?: string }[];
    };

    const writeErrors = bulkError.writeErrors ?? [];
    for (const writeError of writeErrors) {
      failedIndexes.set(
        writeError.index,
        writeError.code === 11000
          ? 'A contact with this email or phone number already exists'
          : (writeError.errmsg ?? 'The contact could not be saved'),
      );
    }

    if (writeErrors.length === 0) {
      // Not a bulk write error at all; surface it rather than swallowing it.
      throw error;
    }

    const insertedCount = bulkError.insertedDocs?.length ?? attempted - writeErrors.length;
    return { insertedCount, failedIndexes };
  }
}
