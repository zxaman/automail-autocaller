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
import type { DashboardSnapshot } from './dashboard-page.model';

/**
 * Loads the dashboard snapshot from the backend aggregation endpoint.
 * No metric is calculated or invented on the client.
 */
@Injectable()
export class DashboardPageService {
  private readonly api = inject(ApiClientService);

  private readonly stateSignal = signal<AsyncState<DashboardSnapshot>>(idleState());

  public readonly state = this.stateSignal.asReadonly();
  public readonly isLoading = computed(() => this.stateSignal().status === 'loading');
  public readonly hasError = computed(() => this.stateSignal().status === 'error');
  public readonly errorMessage = computed(() => this.stateSignal().error);
  public readonly snapshot = computed(() => this.stateSignal().data);

  public readonly metrics = computed<readonly MetricCardData[]>(() => {
    const overview = this.snapshot()?.overview;
    return [
      { id: 'contacts', label: 'Total contacts', value: overview?.totalContacts ?? 0, icon: 'contacts' },
      { id: 'calls', label: 'Total calls', value: overview?.totalCalls ?? 0, icon: 'calls' },
      { id: 'calls-today', label: 'Calls today', value: overview?.callsToday ?? 0, icon: 'calls' },
      {
        id: 'completed-calls',
        label: 'Completed calls',
        value: overview?.completedCalls ?? 0,
        icon: 'check',
      },
      { id: 'emails', label: 'Total emails', value: overview?.totalEmails ?? 0, icon: 'emails' },
      { id: 'emails-today', label: 'Emails today', value: overview?.emailsToday ?? 0, icon: 'emails' },
      {
        id: 'emails-sent',
        label: 'Successful emails',
        value: overview?.successfulEmails ?? 0,
        icon: 'check',
      },
      {
        id: 'emails-failed',
        label: 'Failed emails',
        value: overview?.failedEmails ?? 0,
        icon: 'alert',
      },
    ];
  });

  public load(): void {
    this.stateSignal.update((previous) => loadingState(previous));

    this.api.get<DashboardSnapshot>(API_ENDPOINTS.dashboard).subscribe({
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
}
