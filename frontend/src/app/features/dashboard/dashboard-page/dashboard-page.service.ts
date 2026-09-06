import { Injectable, computed, inject, signal } from '@angular/core';

import { API_ENDPOINTS } from '../../../core/config/api-endpoints.config';
import { AppError } from '../../../core/models/api-error.model';
import {
  errorState,
  idleState,
  loadedState,
  loadingState,
  type AsyncState,
} from '../../../core/models/ui-state.model';
import { ApiClientService } from '../../../core/services/api-client.service';
import type { MetricCardData } from '../../../shared/components/ui-metric-card/ui-metric-card.model';
import type {
  DashboardRangeSelection,
  DashboardSnapshot,
} from './dashboard-page.model';

/**
 * Loads the dashboard snapshot from the backend aggregation endpoint.
 * Every number shown is computed server-side; nothing is derived here.
 */
@Injectable()
export class DashboardPageService {
  private readonly api = inject(ApiClientService);

  private readonly stateSignal = signal<AsyncState<DashboardSnapshot>>(idleState());
  private readonly rangeSignal = signal<DashboardRangeSelection>({ preset: 'week' });

  public readonly state = this.stateSignal.asReadonly();
  public readonly range = this.rangeSignal.asReadonly();
  public readonly isLoading = computed(() => this.stateSignal().status === 'loading');
  public readonly hasError = computed(() => this.stateSignal().status === 'error');
  public readonly errorMessage = computed(() => this.stateSignal().error);
  public readonly snapshot = computed(() => this.stateSignal().data);
  public readonly activity = computed(() => this.snapshot()?.activity ?? []);

  public readonly metrics = computed<readonly MetricCardData[]>(() => {
    const overview = this.snapshot()?.overview;

    return [
      {
        id: 'contacts',
        label: 'Total contacts',
        value: overview?.totalContacts ?? 0,
        icon: 'contacts',
        context: 'In this workspace',
      },
      {
        id: 'calls',
        label: 'Total calls',
        value: overview?.totalCalls ?? 0,
        icon: 'calls',
        context: `${overview?.callsToday ?? 0} today`,
      },
      {
        id: 'call-success',
        label: 'Call success rate',
        value: `${overview?.callSuccessRate ?? 0}%`,
        icon: 'check',
        context: `${overview?.completedCalls ?? 0} completed · ${overview?.missedCalls ?? 0} missed`,
      },
      {
        id: 'talk-time',
        label: 'Total talk time',
        value: this.formatDuration(overview?.totalCallDurationSeconds ?? 0),
        icon: 'calls',
        context: `${this.formatDuration(overview?.averageCallDurationSeconds ?? 0)} average`,
      },
      {
        id: 'emails',
        label: 'Total emails',
        value: overview?.totalEmails ?? 0,
        icon: 'emails',
        context: `${overview?.emailsToday ?? 0} today`,
      },
      {
        id: 'email-success',
        label: 'Email success rate',
        value: `${overview?.emailSuccessRate ?? 0}%`,
        icon: 'check',
        context: `${overview?.successfulEmails ?? 0} delivered`,
      },
      {
        id: 'emails-failed',
        label: 'Failed emails',
        value: overview?.failedEmails ?? 0,
        icon: 'alert',
        context: 'Needs attention',
      },
      {
        id: 'activity',
        label: 'Total activity',
        value: overview?.totalCommunicationActivity ?? 0,
        icon: 'analytics',
        context: 'Calls and emails combined',
      },
    ];
  });

  public load(): void {
    const selection = this.rangeSignal();
    this.stateSignal.update((previous) => loadingState(previous));

    this.api
      .get<DashboardSnapshot>(API_ENDPOINTS.dashboard, {
        preset: selection.preset,
        timezone: this.resolveTimezone(),
        from: selection.from,
        to: selection.to,
      })
      .subscribe({
        next: (snapshot) => this.stateSignal.set(loadedState(snapshot)),
        error: (error: unknown) => {
          const message =
            error instanceof AppError
              ? error.message
              : 'Dashboard data could not be loaded. Please try again.';
          this.stateSignal.set(errorState(message));
        },
      });
  }

  public changeRange(selection: DashboardRangeSelection): void {
    this.rangeSignal.set(selection);
    this.load();
  }

  /** The backend buckets days in this zone, so local dates match what users see. */
  private resolveTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private formatDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) {
      return '0m';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${totalSeconds}s`;
  }
}
