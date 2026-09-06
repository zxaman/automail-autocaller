import type { DateRangePreset } from '../../shared/utils/date-range';

/** How activity is bucketed along the time axis. */
export const ANALYTICS_GRANULARITIES = ['day', 'week', 'month'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export interface AnalyticsRange {
  readonly preset: DateRangePreset;
  readonly granularity: AnalyticsGranularity;
  readonly timezone: string;
  readonly from: string;
  readonly to: string;
}

/**
 * One bucket on the activity chart.
 *
 * `date` is the first local day of the bucket in YYYY-MM-DD form, so a client
 * never has to re-derive bucket boundaries from a timezone it may not share.
 */
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
  /** Calls that reached a live conversation. */
  readonly connectedCalls: number;
  /** Placed, but the person did not pick up (no_answer or busy). */
  readonly missedCalls: number;
  /** Never reached the network, or was abandoned (failed or canceled). */
  readonly failedCalls: number;
  readonly totalDurationSeconds: number;
  /** Mean over CONNECTED calls only; an unanswered call has no conversation. */
  readonly averageDurationSeconds: number;
  /** Longest single connected call, in seconds. */
  readonly longestCallSeconds: number;
  /** connectedCalls / totalCalls, as a percentage to one decimal place. */
  readonly successRate: number;
  readonly byStatus: readonly AnalyticsStatusCount[];
}

export interface EmailAnalytics {
  readonly totalEmails: number;
  readonly sentEmails: number;
  readonly failedEmails: number;
  readonly pendingEmails: number;
  /** sentEmails / (sentEmails + failedEmails): delivery attempts only. */
  readonly successRate: number;
  readonly byStatus: readonly AnalyticsStatusCount[];
}

export interface AnalyticsStatusCount {
  readonly status: string;
  readonly count: number;
}

export interface ImportAnalytics {
  readonly totalBatches: number;
  readonly totalRows: number;
  readonly successfulRows: number;
  readonly duplicateRows: number;
  readonly failedRows: number;
  /** successfulRows / totalRows, as a percentage to one decimal place. */
  readonly successRate: number;
}

/** A contact ranked by how much communication it has received. */
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

/**
 * Plain-language definition of every published metric.
 *
 * Shipped with the payload deliberately: a rate is meaningless unless the
 * reader knows its denominator, and two people reading "success rate"
 * differently is how reporting loses trust.
 */
export const METRIC_DEFINITIONS: Readonly<Record<string, string>> = {
  totalCalls: 'Calls placed in the selected range, counted by when the call started.',
  connectedCalls: 'Calls that reached a live conversation.',
  missedCalls: 'Calls that rang but were not answered, including busy numbers.',
  failedCalls: 'Calls that never connected due to an error, or were canceled before answer.',
  callSuccessRate: 'Connected calls divided by total calls placed, as a percentage.',
  totalCallDuration: 'Sum of the talk time of connected calls.',
  averageCallDuration:
    'Mean talk time across connected calls only. Unanswered calls are excluded because they contain no conversation.',
  longestCall: 'Talk time of the single longest connected call.',
  totalEmails: 'Emails created in the range, including drafts and queued messages.',
  sentEmails: 'Emails accepted for delivery by the mail server.',
  failedEmails: 'Emails the mail server rejected or that exhausted their retries.',
  emailSuccessRate:
    'Sent emails divided by delivery attempts (sent plus failed). Drafts and queued emails are excluded because they have not been attempted yet.',
  importSuccessRate: 'Rows imported as new contacts divided by all rows read from the files.',
  mostContacted:
    'Contacts ranked by calls plus emails in the range. Contacts with no activity are not listed.',
};

/** Raw shapes returned by the aggregation, before rates are derived. */
export interface RawCallAnalytics {
  readonly totalCalls: number;
  readonly connectedCalls: number;
  readonly missedCalls: number;
  readonly failedCalls: number;
  readonly totalDurationSeconds: number;
  readonly longestCallSeconds: number;
}

export interface RawEmailAnalytics {
  readonly totalEmails: number;
  readonly sentEmails: number;
  readonly failedEmails: number;
}

export interface RawImportAnalytics {
  readonly totalBatches: number;
  readonly totalRows: number;
  readonly successfulRows: number;
  readonly duplicateRows: number;
  readonly failedRows: number;
}

export interface RawBucket {
  readonly _id: string;
  readonly total: number;
  readonly successful: number;
}

export interface RawMostContacted {
  readonly contactId: string;
  readonly callCount: number;
  readonly emailCount: number;
  readonly lastInteractionAt: Date | null;
}
