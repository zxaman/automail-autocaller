import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppError } from '../../../core/models/api-error.model';
import type {
  AnalyticsGranularity,
  AnalyticsRangeSelection,
  AnalyticsSummary,
  AnalyticsStatusCount,
} from '../models/analytics.model';
import { AnalyticsApiService } from '../services/analytics.service';

/** Analytics page state: range, granularity, and the loaded summary. */
@Injectable()
export class AnalyticsPageService {
  private readonly api = inject(AnalyticsApiService);

  private readonly summarySignal = signal<AnalyticsSummary | null>(null);
  private readonly definitionsSignal = signal<Record<string, string>>({});
  private readonly selectionSignal = signal<AnalyticsRangeSelection>({ preset: 'week' });
  private readonly granularitySignal = signal<AnalyticsGranularity | null>(null);
  private readonly isLoadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  public readonly summary = this.summarySignal.asReadonly();
  public readonly definitions = this.definitionsSignal.asReadonly();
  public readonly selection = this.selectionSignal.asReadonly();
  public readonly granularity = this.granularitySignal.asReadonly();
  public readonly isLoading = this.isLoadingSignal.asReadonly();
  public readonly errorMessage = this.errorSignal.asReadonly();

  public readonly activity = computed(() => this.summarySignal()?.activity ?? []);

  /**
   * Chart input.
   *
   * The shared chart component takes `{date, calls, emails}`; the analytics
   * series carries a bucket label as well, so the label is used as the axis
   * key when buckets are not single days.
   */
  public readonly chartPoints = computed(() =>
    this.activity().map((point) => ({
      date: point.date,
      calls: point.calls,
      emails: point.emails,
    })),
  );

  /** True when a range genuinely produced no activity of any kind. */
  public readonly hasNoActivity = computed(() => {
    const summary = this.summarySignal();

    if (!summary) {
      return false;
    }

    return (
      summary.calls.totalCalls === 0 &&
      summary.emails.totalEmails === 0 &&
      summary.imports.totalBatches === 0
    );
  });

  public readonly callStatusBars = computed(() =>
    this.toBars(this.summarySignal()?.calls.byStatus ?? []),
  );

  public readonly emailStatusBars = computed(() =>
    this.toBars(this.summarySignal()?.emails.byStatus ?? []),
  );

  public async load(): Promise<void> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const summary = await firstValueFrom(
        this.api.getSummary(this.selectionSignal(), this.granularitySignal()),
      );
      this.summarySignal.set(summary);
      // The server may have chosen a bucket size for us; reflect it.
      this.granularitySignal.set(summary.range.granularity);
    } catch (error) {
      this.errorSignal.set(
        error instanceof AppError ? error.message : 'Analytics could not be loaded',
      );
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  public async loadDefinitions(): Promise<void> {
    try {
      const result = await firstValueFrom(this.api.getDefinitions());
      this.definitionsSignal.set(result.definitions);
    } catch {
      // Definitions are explanatory; their absence must not block the numbers.
    }
  }

  public async setRange(selection: AnalyticsRangeSelection): Promise<void> {
    this.selectionSignal.set(selection);
    // Let the server re-pick a bucket size appropriate to the new range.
    this.granularitySignal.set(null);
    await this.load();
  }

  public async setGranularity(granularity: AnalyticsGranularity): Promise<void> {
    if (granularity === this.granularitySignal()) {
      return;
    }

    this.granularitySignal.set(granularity);
    await this.load();
  }

  public definitionFor(key: string): string | null {
    return this.definitions()[key] ?? null;
  }

  /** Converts status counts into proportional bar widths. */
  private toBars(
    counts: readonly AnalyticsStatusCount[],
  ): readonly { status: string; count: number; percent: number }[] {
    const total = counts.reduce((sum, item) => sum + item.count, 0);

    if (total === 0) {
      return [];
    }

    return counts.map((item) => ({
      status: item.status,
      count: item.count,
      percent: Math.round((item.count / total) * 1000) / 10,
    }));
  }
}
