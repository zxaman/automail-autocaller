export type AnalyticsPreset = 'today' | 'week' | 'month' | 'custom';
export type AnalyticsGranularity = 'day' | 'week' | 'month';

export interface AnalyticsRange {
  readonly preset: AnalyticsPreset;
  readonly granularity: AnalyticsGranularity;
  readonly timezone: string;
  readonly from: string;
  readonly to: string;
}

export interface AnalyticsStatusCount {
  readonly status: string;
  readonly count: number;
}

export interface AnalyticsActivityPoint {
  readonly date: string;
  readonly label: string;
  readonly calls: number;
  readonly emails: number;
  readonly connectedCalls: number;
  readonly sentEmails: number;
}

export interface CallAnalytics {
  readonly totalCalls: number;
  readonly connectedCalls: number;
  readonly missedCalls: number;
  readonly failedCalls: number;
  readonly totalDurationSeconds: number;
  readonly averageDurationSeconds: number;
  readonly longestCallSeconds: number;
  readonly successRate: number;
  readonly byStatus: readonly AnalyticsStatusCount[];
}

export interface EmailAnalytics {
  readonly totalEmails: number;
  readonly sentEmails: number;
  readonly failedEmails: number;
  readonly pendingEmails: number;
  readonly successRate: number;
  readonly byStatus: readonly AnalyticsStatusCount[];
}

export interface ImportAnalytics {
  readonly totalBatches: number;
  readonly totalRows: number;
  readonly successfulRows: number;
  readonly duplicateRows: number;
  readonly failedRows: number;
  readonly successRate: number;
}

export interface MostContactedEntry {
  readonly contactId: string;
  readonly contactName: string;
  readonly company: string | null;
  readonly callCount: number;
  readonly emailCount: number;
  readonly totalInteractions: number;
  readonly lastInteractionAt: string | null;
}

export interface AnalyticsSummary {
  readonly range: AnalyticsRange;
  readonly calls: CallAnalytics;
  readonly emails: EmailAnalytics;
  readonly imports: ImportAnalytics;
  readonly activity: readonly AnalyticsActivityPoint[];
  readonly mostContacted: readonly MostContactedEntry[];
}

export interface AnalyticsRangeSelection {
  readonly preset: AnalyticsPreset;
  readonly from?: string;
  readonly to?: string;
}

/** Granularity choices the user can force, overriding the server default. */
export const GRANULARITY_OPTIONS: readonly {
  readonly value: AnalyticsGranularity;
  readonly label: string;
}[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];
