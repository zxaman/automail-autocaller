import type { Types } from 'mongoose';

import { AppError } from '../../shared/errors/app-error';
import { normalizePhone } from '../../shared/utils/phone';
import { ColumnMapper } from './column-mapper';
import { HeaderDetector } from './header-detector';
import { ImportSessionStore, type ImportSession } from './import-session.store';
import type {
  ColumnAssignment,
  ContactDraft,
  ImportAnalysis,
  ImportCommitRequest,
  ImportResult,
  ImportRowOutcome,
} from './import.types';
import { ImportRepository, type ImportScope, type ContactInsertAttributes } from './import.repository';
import { RowBuilder } from './row-builder';
import { SpreadsheetParser } from './spreadsheet.parser';

const PREVIEW_ROW_COUNT = 8;
/** Errors stored on the batch are capped so a bad file cannot bloat a document. */
const MAX_STORED_ERRORS = 100;

export interface UploadedFile {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

/**
 * Orchestrates the two-step import: analyze, then commit.
 *
 * Splitting them is what makes flexible mapping possible. The first call parses
 * and proposes a mapping; the user corrects anything uncertain; the second call
 * writes with the confirmed mapping. Nothing is written until the user commits.
 */
export class ImportService {
  constructor(
    private readonly importRepository: ImportRepository,
    private readonly sessionStore: ImportSessionStore,
    private readonly parser: SpreadsheetParser = new SpreadsheetParser(),
    private readonly headerDetector: HeaderDetector = new HeaderDetector(),
    private readonly columnMapper: ColumnMapper = new ColumnMapper(),
  ) {}

  public async analyze(
    scope: ImportScope,
    ownerId: Types.ObjectId,
    file: UploadedFile,
    sheetName?: string,
  ): Promise<ImportAnalysis> {
    const format = this.parser.detectFormat(file.originalName, file.mimeType);
    const { sheet, sheets } = await this.parser.parse(file.buffer, format, sheetName);

    if (sheet.rows.length === 0) {
      throw new AppError('The selected sheet is empty', 400, 'IMPORT_EMPTY_SHEET');
    }

    const detection = this.headerDetector.detect(sheet.rows);
    const columns = this.columnMapper.suggest(detection.headers, detection.hasHeaderRow);

    const session = this.sessionStore.create({
      workspaceId: scope.workspaceId,
      ownerId,
      fileName: file.originalName,
      fileSizeBytes: file.size,
      sheet,
      sheets,
      headerRowIndex: detection.headerRowIndex,
      hasHeaderRow: detection.hasHeaderRow,
      dataStartRowIndex: detection.dataStartRowIndex,
    });

    const dataRows = sheet.rows.slice(detection.dataStartRowIndex);

    return {
      sessionId: session.id,
      fileName: file.originalName,
      fileSizeBytes: file.size,
      sheetName: sheet.sheetName,
      availableSheets: sheets,
      hasHeaderRow: detection.hasHeaderRow,
      headerRowIndex: detection.headerRowIndex,
      totalDataRows: dataRows.filter((row) => row.some((cell) => cell !== '')).length,
      columns,
      previewRows: dataRows.slice(0, PREVIEW_ROW_COUNT),
      requiresConfirmation: columns.some((column) => column.requiresConfirmation),
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  public async commit(
    scope: ImportScope,
    ownerId: Types.ObjectId,
    request: ImportCommitRequest,
  ): Promise<ImportResult> {
    const session = this.sessionStore.find(request.sessionId, scope.workspaceId);
    if (!session) {
      throw new AppError(
        'This import session has expired. Please upload the file again.',
        404,
        'IMPORT_SESSION_NOT_FOUND',
      );
    }

    const mapping = this.buildMapping(request.mapping);
    this.assertMappingIsUsable(mapping);

    const { drafts, outcomes } = this.buildDrafts(session, mapping, request.tags);
    const batch = await this.importRepository.createBatch(
      scope,
      ownerId,
      session.fileName,
      session.fileSizeBytes,
    );

    const { deduped, duplicateOutcomes } = await this.applyDuplicateStrategy(
      scope,
      drafts,
      request.duplicateStrategy,
    );
    outcomes.push(...duplicateOutcomes);

    const insertResult = await this.importRepository.insertContacts(
      scope,
      ownerId,
      batch._id,
      deduped.map((draft) => this.toInsertAttributes(draft)),
    );

    deduped.forEach((draft, index) => {
      const failure = insertResult.failedIndexes.get(index);
      outcomes.push(
        failure
          ? { rowNumber: draft.rowNumber, status: 'failed', reason: failure }
          : { rowNumber: draft.rowNumber, status: 'created' },
      );
    });

    return this.finalize(scope, batch._id, session, outcomes);
  }

  /** Re-analyzes an existing session against a different sheet in the same file. */
  public analyzeSheet(scope: ImportScope, sessionId: string, sheetName: string): ImportAnalysis {
    const session = this.sessionStore.find(sessionId, scope.workspaceId);
    if (!session) {
      throw new AppError(
        'This import session has expired. Please upload the file again.',
        404,
        'IMPORT_SESSION_NOT_FOUND',
      );
    }

    throw new AppError(
      'Switching sheets requires re-uploading the file in this release',
      400,
      'IMPORT_SHEET_SWITCH_UNSUPPORTED',
      { details: { sheetName, availableSheets: session.sheets.map((entry) => entry.name) } },
    );
  }

  private buildDrafts(
    session: ImportSession,
    mapping: ReadonlyMap<number, ColumnAssignment>,
    tags: readonly string[],
  ): { drafts: ContactDraft[]; outcomes: ImportRowOutcome[] } {
    const rowBuilder = new RowBuilder(tags);
    const drafts: ContactDraft[] = [];
    const outcomes: ImportRowOutcome[] = [];

    const dataRows = session.sheet.rows.slice(session.dataStartRowIndex);

    dataRows.forEach((row, index) => {
      // Row numbers are 1-based and account for the header, so they match what
      // the user sees in Excel.
      const rowNumber = session.dataStartRowIndex + index + 1;
      const result = rowBuilder.build(row, mapping, rowNumber);

      if (result.isEmpty) {
        return;
      }
      if (result.error || !result.draft) {
        outcomes.push({ rowNumber, status: 'failed', reason: result.error ?? 'Invalid row' });
        return;
      }

      drafts.push(result.draft);
    });

    return { drafts, outcomes };
  }

  /**
   * Applies the user's duplicate choice against both existing contacts and
   * repeats within the file itself, which are just as common.
   */
  private async applyDuplicateStrategy(
    scope: ImportScope,
    drafts: readonly ContactDraft[],
    strategy: ImportCommitRequest['duplicateStrategy'],
  ): Promise<{ deduped: ContactDraft[]; duplicateOutcomes: ImportRowOutcome[] }> {
    const emails = drafts.map((draft) => draft.email).filter((value): value is string => value !== null);
    const phones = drafts.map((draft) => draft.phone).filter((value): value is string => value !== null);
    const existing = await this.importRepository.loadExistingIndex(scope, emails, phones);

    const deduped: ContactDraft[] = [];
    const duplicateOutcomes: ImportRowOutcome[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    for (const draft of drafts) {
      const withinFile =
        (draft.email !== null && seenEmails.has(draft.email)) ||
        (draft.phone !== null && seenPhones.has(draft.phone));

      const existingContact =
        (draft.email ? existing.byEmail.get(draft.email) : undefined) ??
        (draft.phone ? existing.byPhone.get(draft.phone) : undefined);

      if (!withinFile && !existingContact) {
        if (draft.email) seenEmails.add(draft.email);
        if (draft.phone) seenPhones.add(draft.phone);
        deduped.push(draft);
        continue;
      }

      if (strategy === 'skip' || withinFile) {
        duplicateOutcomes.push({
          rowNumber: draft.rowNumber,
          status: 'duplicate',
          reason: withinFile
            ? 'The same contact appears earlier in this file'
            : 'A contact with this email or phone number already exists',
        });
        continue;
      }

      if (strategy === 'update' && existingContact) {
        await this.importRepository.updateContact(scope, existingContact._id, {
          ...this.toInsertAttributes(draft),
          // Merge tags rather than replacing, so an import never strips labels.
          tags: [...new Set([...existingContact.tags, ...draft.tags])].slice(0, 20),
        });
        duplicateOutcomes.push({
          rowNumber: draft.rowNumber,
          status: 'updated',
          contactId: existingContact._id.toString(),
        });
        continue;
      }

      // 'import' keeps the row; the unique index still guards true collisions.
      if (draft.email) seenEmails.add(draft.email);
      if (draft.phone) seenPhones.add(draft.phone);
      deduped.push(draft);
    }

    return { deduped, duplicateOutcomes };
  }

  private async finalize(
    scope: ImportScope,
    batchId: Types.ObjectId,
    session: ImportSession,
    outcomes: ImportRowOutcome[],
  ): Promise<ImportResult> {
    const created = outcomes.filter((entry) => entry.status === 'created').length;
    const updated = outcomes.filter((entry) => entry.status === 'updated').length;
    const duplicates = outcomes.filter((entry) => entry.status === 'duplicate').length;
    const failures = outcomes.filter((entry) => entry.status === 'failed');

    const errors = failures
      .slice(0, MAX_STORED_ERRORS)
      .map((entry) => ({ rowNumber: entry.rowNumber, reason: entry.reason ?? 'Invalid row' }));

    await this.importRepository.completeBatch(scope, batchId, {
      status: 'completed',
      totalRows: outcomes.length,
      successfulRows: created + updated,
      duplicateRows: duplicates,
      failedRows: failures.length,
      errors,
    });

    // The grid is no longer needed once the rows are written.
    this.sessionStore.delete(session.id);

    return {
      batchId: batchId.toString(),
      fileName: session.fileName,
      status: 'completed',
      totalRows: outcomes.length,
      successfulRows: created,
      updatedRows: updated,
      duplicateRows: duplicates,
      failedRows: failures.length,
      errors,
    };
  }

  private buildMapping(
    entries: ImportCommitRequest['mapping'],
  ): ReadonlyMap<number, ColumnAssignment> {
    const mapping = new Map<number, ColumnAssignment>();
    for (const entry of entries) {
      mapping.set(entry.columnIndex, entry.field);
    }
    return mapping;
  }

  /** Without a name and at least one contact channel, an import is pointless. */
  private assertMappingIsUsable(mapping: ReadonlyMap<number, ColumnAssignment>): void {
    const fields = new Set([...mapping.values()].filter((field) => field && field !== 'ignore'));

    const hasName = fields.has('name') || fields.has('firstName') || fields.has('lastName');
    const hasChannel = fields.has('phone') || fields.has('email');

    if (!hasName) {
      throw new AppError(
        'Map a column to the contact name before importing',
        400,
        'IMPORT_MAPPING_INCOMPLETE',
        { details: { missing: 'name' } },
      );
    }

    if (!hasChannel) {
      throw new AppError(
        'Map a column to either a phone number or an email address before importing',
        400,
        'IMPORT_MAPPING_INCOMPLETE',
        { details: { missing: 'phone-or-email' } },
      );
    }
  }

  private toInsertAttributes(draft: ContactDraft): ContactInsertAttributes {
    return {
      name: draft.name ?? '',
      phone: draft.phone,
      // Must match the contact service's convention (e164) or duplicate
      // detection would silently miss every imported number.
      phoneNormalized: draft.phone ? (normalizePhone(draft.phone)?.e164 ?? null) : null,
      email: draft.email,
      company: draft.company,
      designation: draft.designation,
      location: draft.location,
      tags: draft.tags,
      notes: draft.notes,
    };
  }
}
