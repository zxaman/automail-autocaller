import type { DateRangePreset } from '../../shared/utils/date-range';

export interface DashboardOverview {
  totalContacts: number;
  totalCalls: number;
  callsToday: number;
  completedCalls: number;
  missedCalls: number;
  failedCalls: number;
  totalCallDurationSeconds: number;
  averageCallDurationSeconds: number;
  totalEmails: number;
  emailsToday: number;
  successfulEmails: number;
  failedEmails: number;
  callSuccessRate: number;
  emailSuccessRate: number;
  totalCommunicationActivity: number;
}

export interface DashboardRecentCall {
  id: string;
  contactId: string | null;
  contactName: string;
  phoneNumber: string;
  direction: 'inbound' | 'outbound';
  status: string;
  durationSeconds: number;
  occurredAt: string;
}

export interface DashboardRecentEmail {
  id: string;
  contactId: string | null;
  contactName: string;
  subject: string;
  status: string;
  occurredAt: string;
}

export interface DashboardRecentImport {
  id: string;
  fileName: string;
  totalRows: number;
  successfulRows: number;
  duplicateRows: number;
  failedRows: number;
  status: string;
  importedAt: string;
}

/** One point per day in the selected range, including days with no activity. */
export interface ActivityPoint {
  date: string;
  calls: number;
  emails: number;
}

export interface DashboardRange {
  preset: DateRangePreset;
  timezone: string;
  from: string;
  to: string;
}

export interface DashboardSnapshot {
  range: DashboardRange;
  overview: DashboardOverview;
  activity: ActivityPoint[];
  recentCalls: DashboardRecentCall[];
  recentEmails: DashboardRecentEmail[];
  recentImports: DashboardRecentImport[];
}

/** Raw counters returned by the aggregation, before rates are derived. */
export interface RawCallStats {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  failedCalls: number;
  totalCallDurationSeconds: number;
}

export interface RawEmailStats {
  totalEmails: number;
  successfulEmails: number;
  failedEmails: number;
}
