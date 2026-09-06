import type { MetricCardData } from '../../../shared/components/ui-metric-card/ui-metric-card.model';

export interface DashboardOverview {
  readonly totalContacts: number;
  readonly totalCalls: number;
  readonly callsToday: number;
  readonly completedCalls: number;
  readonly missedCalls: number;
  readonly failedCalls: number;
  readonly totalCallDurationSeconds: number;
  readonly totalEmails: number;
  readonly emailsToday: number;
  readonly successfulEmails: number;
  readonly failedEmails: number;
}

export interface DashboardRecentCall {
  readonly id: string;
  readonly contactName: string;
  readonly direction: 'incoming' | 'outgoing';
  readonly status: string;
  readonly durationSeconds: number;
  readonly occurredAt: string;
}

export interface DashboardRecentEmail {
  readonly id: string;
  readonly contactName: string;
  readonly subject: string;
  readonly status: string;
  readonly occurredAt: string;
}

export interface DashboardRecentImport {
  readonly id: string;
  readonly fileName: string;
  readonly successfulRows: number;
  readonly importedAt: string;
}

export interface DashboardSnapshot {
  readonly overview: DashboardOverview;
  readonly recentCalls: readonly DashboardRecentCall[];
  readonly recentEmails: readonly DashboardRecentEmail[];
  readonly recentImports: readonly DashboardRecentImport[];
}

export type DashboardMetricCards = readonly MetricCardData[];
