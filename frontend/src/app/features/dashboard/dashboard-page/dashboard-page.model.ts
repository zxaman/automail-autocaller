import type { MetricCardData } from '../../../shared/components/ui-metric-card/ui-metric-card.model';

export type DashboardRangePreset = 'today' | 'week' | 'month' | 'custom';

export interface DashboardRange {
  readonly preset: DashboardRangePreset;
  readonly timezone: string;
  readonly from: string;
  readonly to: string;
}

export interface DashboardOverview {
  readonly totalContacts: number;
  readonly totalCalls: number;
  readonly callsToday: number;
  readonly completedCalls: number;
  readonly missedCalls: number;
  readonly failedCalls: number;
  readonly totalCallDurationSeconds: number;
  readonly averageCallDurationSeconds: number;
  readonly totalEmails: number;
  readonly emailsToday: number;
  readonly successfulEmails: number;
  readonly failedEmails: number;
  readonly callSuccessRate: number;
  readonly emailSuccessRate: number;
  readonly totalCommunicationActivity: number;
}

export interface DashboardRecentCall {
  readonly id: string;
  readonly contactId: string | null;
  readonly contactName: string;
  readonly phoneNumber: string;
  readonly direction: 'inbound' | 'outbound';
  readonly status: string;
  readonly durationSeconds: number;
  readonly occurredAt: string;
}

export interface DashboardRecentEmail {
  readonly id: string;
  readonly contactId: string | null;
  readonly contactName: string;
  readonly subject: string;
  readonly status: string;
  readonly occurredAt: string;
}

export interface DashboardRecentImport {
  readonly id: string;
  readonly fileName: string;
  readonly totalRows: number;
  readonly successfulRows: number;
  readonly duplicateRows: number;
  readonly failedRows: number;
  readonly status: string;
  readonly importedAt: string;
}

/** One point per day of the selected range; days without activity are zeroes. */
export interface DashboardActivityPoint {
  readonly date: string;
  readonly calls: number;
  readonly emails: number;
}

export interface DashboardSnapshot {
  readonly range: DashboardRange;
  readonly overview: DashboardOverview;
  readonly activity: readonly DashboardActivityPoint[];
  readonly recentCalls: readonly DashboardRecentCall[];
  readonly recentEmails: readonly DashboardRecentEmail[];
  readonly recentImports: readonly DashboardRecentImport[];
}

/** What the page sends to the API when the user changes the range control. */
export interface DashboardRangeSelection {
  readonly preset: DashboardRangePreset;
  readonly from?: string;
  readonly to?: string;
}

export type DashboardMetricCards = readonly MetricCardData[];
