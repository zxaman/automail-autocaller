import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '../../../core/models/api-error.model';
import { NotificationService } from '../../../core/services/notification.service';
import type {
  ColumnAssignment,
  DuplicateStrategy,
  ImportAnalysis,
  ImportResult,
} from '../models/import.model';
import { ImportService } from '../services/import.service';
import type { EditableColumnMapping, WizardStep } from './import-wizard-page.model';

/**
 * Owns the import wizard's state machine.
 *
 * The mapping the user sees starts as the server's suggestion and becomes the
 * user's own the moment they change a row. Nothing is written until commit, so
 * moving backwards is always safe.
 */
@Injectable()
export class ImportWizardPageService {
  private readonly importService = inject(ImportService);
  private readonly notifications = inject(NotificationService);

  private readonly stepSignal = signal<WizardStep>('upload');
  private readonly analysisSignal = signal<ImportAnalysis | null>(null);
  private readonly mappingSignal = signal<readonly EditableColumnMapping[]>([]);
  private readonly resultSignal = signal<ImportResult | null>(null);
  private readonly isAnalyzingSignal = signal(false);
  private readonly isCommittingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly strategySignal = signal<DuplicateStrategy>('skip');
  private readonly tagsSignal = signal<readonly string[]>([]);

  public readonly step = this.stepSignal.asReadonly();
  public readonly analysis = this.analysisSignal.asReadonly();
  public readonly mapping = this.mappingSignal.asReadonly();
  public readonly result = this.resultSignal.asReadonly();
  public readonly isAnalyzing = this.isAnalyzingSignal.asReadonly();
  public readonly isCommitting = this.isCommittingSignal.asReadonly();
  public readonly errorMessage = this.errorSignal.asReadonly();
  public readonly duplicateStrategy = this.strategySignal.asReadonly();
  public readonly tags = this.tagsSignal.asReadonly();

  /** Rows the server was unsure about and the user has not yet confirmed. */
  public readonly unconfirmedCount = computed(
    () =>
      this.mappingSignal().filter((row) => row.requiresConfirmation && !row.confirmed).length,
  );

  public readonly mappedFields = computed(
    () =>
      new Set(
        this.mappingSignal()
          .map((row) => row.field)
          .filter((field): field is Exclude<ColumnAssignment, null | 'ignore'> =>
            field !== null && field !== 'ignore',
          ),
      ),
  );

  public readonly hasName = computed(() => {
    const fields = this.mappedFields();
    return fields.has('name') || fields.has('firstName') || fields.has('lastName');
  });

  public readonly hasChannel = computed(() => {
    const fields = this.mappedFields();
    return fields.has('phone') || fields.has('email');
  });

  /** Commit is blocked until the mapping can actually produce a contact. */
  public readonly canCommit = computed(
    () =>
      this.hasName() &&
      this.hasChannel() &&
      this.unconfirmedCount() === 0 &&
      !this.isCommittingSignal(),
  );

  public analyzeFile(file: File): void {
    this.isAnalyzingSignal.set(true);
    this.errorSignal.set(null);

    this.importService.analyze(file).subscribe({
      next: (analysis) => {
        this.analysisSignal.set(analysis);
        this.mappingSignal.set(this.toEditableMapping(analysis));
        this.stepSignal.set('map');
        this.isAnalyzingSignal.set(false);
      },
      error: (error: unknown) => {
        this.errorSignal.set(this.toMessage(error, 'The file could not be analyzed.'));
        this.isAnalyzingSignal.set(false);
      },
    });
  }

  public assignField(columnIndex: number, field: ColumnAssignment): void {
    this.mappingSignal.update((rows) =>
      rows.map((row) => {
        if (row.columnIndex === columnIndex) {
          return { ...row, field, confirmed: true };
        }

        // A field can only be filled once, so the previous holder is released.
        if (field !== null && field !== 'ignore' && row.field === field) {
          return { ...row, field: null, confirmed: false };
        }

        return row;
      }),
    );
  }

  public confirmSuggestion(columnIndex: number): void {
    this.mappingSignal.update((rows) =>
      rows.map((row) => (row.columnIndex === columnIndex ? { ...row, confirmed: true } : row)),
    );
  }

  public confirmAllSuggestions(): void {
    this.mappingSignal.update((rows) => rows.map((row) => ({ ...row, confirmed: true })));
  }

  public setDuplicateStrategy(strategy: DuplicateStrategy): void {
    this.strategySignal.set(strategy);
  }

  public setTags(tags: readonly string[]): void {
    this.tagsSignal.set(tags);
  }

  public commit(): void {
    const analysis = this.analysisSignal();
    if (!analysis || !this.canCommit()) {
      return;
    }

    this.isCommittingSignal.set(true);
    this.errorSignal.set(null);

    this.importService
      .commit({
        sessionId: analysis.sessionId,
        mapping: this.mappingSignal().map((row) => ({
          columnIndex: row.columnIndex,
          field: row.field,
        })),
        duplicateStrategy: this.strategySignal(),
        tags: this.tagsSignal(),
      })
      .subscribe({
        next: (result) => {
          this.resultSignal.set(result);
          this.stepSignal.set('result');
          this.isCommittingSignal.set(false);
          this.notifications.success(
            `Imported ${result.successfulRows} contact${result.successfulRows === 1 ? '' : 's'}.`,
          );
        },
        error: (error: unknown) => {
          this.errorSignal.set(this.toMessage(error, 'The contacts could not be imported.'));
          this.isCommittingSignal.set(false);
        },
      });
  }

  public backToUpload(): void {
    this.stepSignal.set('upload');
    this.analysisSignal.set(null);
    this.mappingSignal.set([]);
    this.errorSignal.set(null);
  }

  public reset(): void {
    this.backToUpload();
    this.resultSignal.set(null);
    this.strategySignal.set('skip');
    this.tagsSignal.set([]);
  }

  /**
   * High-confidence suggestions start pre-confirmed; anything the server
   * flagged stays outstanding so the user has to look at it.
   */
  private toEditableMapping(analysis: ImportAnalysis): EditableColumnMapping[] {
    return analysis.columns.map((column) => ({
      columnIndex: column.columnIndex,
      rawLabel: column.rawLabel,
      field: column.suggestedField,
      reason: column.reason,
      confidence: column.confidence,
      requiresConfirmation: column.requiresConfirmation,
      sampleValues: column.sampleValues,
      confirmed: !column.requiresConfirmation,
    }));
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof AppError ? error.message : fallback;
  }
}
