import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiClientService } from '../../../core/services/api-client.service';
import type {
  AnalyticsGranularity,
  AnalyticsRangeSelection,
  AnalyticsSummary,
} from '../models/analytics.model';

/** Transport-level access to the analytics API. */
@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly api = inject(ApiClientService);

  public getSummary(
    selection: AnalyticsRangeSelection,
    granularity: AnalyticsGranularity | null,
  ): Observable<AnalyticsSummary> {
    return this.api.get<AnalyticsSummary>('/analytics', {
      preset: selection.preset,
      from: selection.from ?? null,
      to: selection.to ?? null,
      granularity: granularity ?? null,
      // Day boundaries follow the reader's own calendar, not the server's.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  public getDefinitions(): Observable<{ definitions: Record<string, string> }> {
    return this.api.get<{ definitions: Record<string, string> }>('/analytics/definitions');
  }
}
