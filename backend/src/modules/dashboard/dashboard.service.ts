import {
  rangeDayCount,
  resolveDateRange,
  type DateRange,
  type DateRangePreset,
} from '../../shared/utils/date-range';
import type { DashboardRepository, DashboardScope } from './dashboard.repository';
import type {
  ActivityPoint,
  DashboardOverview,
  DashboardSnapshot,
  RawCallStats,
  RawEmailStats,
} from './dashboard.types';

export interface DashboardQueryInput {
  preset: DateRangePreset;
  timezone: string;
  from?: string;
  to?: string;
}

/**
 * Assembles the dashboard snapshot.
 *
 * The metric list is data-driven from the raw aggregation counters, so new
 * metrics can be added without changing the page or the transport contract.
 */
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  public async getSnapshot(
    scope: DashboardScope,
    query: DashboardQueryInput,
    now: Date = new Date(),
  ): Promise<DashboardSnapshot> {
    const range = resolveDateRange({ ...query, now });
    // "Today" cards are always today, independent of the selected range.
    const todayRange = resolveDateRange({ preset: 'today', timezone: range.timezone, now });

    const [
      totalContacts,
      allTimeCalls,
      allTimeEmails,
      todayCalls,
      todayEmails,
      activitySeries,
      recentCalls,
      recentEmails,
      recentImports,
    ] = await Promise.all([
      this.dashboardRepository.countContacts(scope),
      this.dashboardRepository.callStats(scope),
      this.dashboardRepository.emailStats(scope),
      this.dashboardRepository.callStats(scope, todayRange),
      this.dashboardRepository.emailStats(scope, todayRange),
      this.dashboardRepository.activitySeries(scope, range),
      this.dashboardRepository.recentCalls(scope),
      this.dashboardRepository.recentEmails(scope),
      this.dashboardRepository.recentImports(scope),
    ]);

    return {
      range: {
        preset: range.preset,
        timezone: range.timezone,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      overview: this.buildOverview({
        totalContacts,
        allTimeCalls,
        allTimeEmails,
        callsToday: todayCalls.totalCalls,
        emailsToday: todayEmails.totalEmails,
      }),
      activity: this.buildActivitySeries(range, activitySeries),
      recentCalls,
      recentEmails,
      recentImports,
    };
  }

  private buildOverview(input: {
    totalContacts: number;
    allTimeCalls: RawCallStats;
    allTimeEmails: RawEmailStats;
    callsToday: number;
    emailsToday: number;
  }): DashboardOverview {
    const { allTimeCalls: calls, allTimeEmails: emails } = input;

    return {
      totalContacts: input.totalContacts,
      totalCalls: calls.totalCalls,
      callsToday: input.callsToday,
      completedCalls: calls.completedCalls,
      missedCalls: calls.missedCalls,
      failedCalls: calls.failedCalls,
      totalCallDurationSeconds: calls.totalCallDurationSeconds,
      averageCallDurationSeconds: this.safeAverage(
        calls.totalCallDurationSeconds,
        calls.completedCalls,
      ),
      totalEmails: emails.totalEmails,
      emailsToday: input.emailsToday,
      successfulEmails: emails.successfulEmails,
      failedEmails: emails.failedEmails,
      callSuccessRate: this.safeRate(calls.completedCalls, calls.totalCalls),
      emailSuccessRate: this.safeRate(emails.successfulEmails, emails.totalEmails),
      totalCommunicationActivity: calls.totalCalls + emails.totalEmails,
    };
  }

  /**
   * Emits one point per day so a chart renders a continuous axis rather than
   * skipping days with no activity.
   */
  private buildActivitySeries(
    range: DateRange,
    series: Map<string, { calls: number; emails: number }>,
  ): ActivityPoint[] {
    const days = rangeDayCount(range);
    const points: ActivityPoint[] = [];

    const startParts = this.localPartsOf(range.from, range.timezone);

    for (let index = 0; index < days; index += 1) {
      const dayStart = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day + index));
      const key = dayStart.toISOString().slice(0, 10);
      const bucket = series.get(key);
      points.push({ date: key, calls: bucket?.calls ?? 0, emails: bucket?.emails ?? 0 });
    }

    return points;
  }

  /** Calendar date of an instant, as seen in the caller's timezone. */
  private localPartsOf(instant: Date, timezone: string): { year: number; month: number; day: number } {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(instant)
      .split('-')
      .map(Number);

    return { year: year as number, month: month as number, day: day as number };
  }

  private safeRate(numerator: number, denominator: number): number {
    if (denominator <= 0) {
      return 0;
    }
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  private safeAverage(total: number, count: number): number {
    if (count <= 0) {
      return 0;
    }
    return Math.round(total / count);
  }
}
