import { Types } from 'mongoose';

import { TtlCache } from '../../infrastructure/cache/ttl-cache';
import { AppError } from '../../shared/errors/app-error';
import {
  MAX_CUSTOM_RANGE_DAYS,
  rangeDayCount,
  resolveDateRange,
  startOfLocalDay,
  type DateRange,
  type DateRangePreset,
} from '../../shared/utils/date-range';
import type { AnalyticsRepository, AnalyticsScope } from './analytics.repository';
import type {
  AnalyticsActivityPoint,
  AnalyticsGranularity,
  AnalyticsSummary,
  CallAnalytics,
  EmailAnalytics,
  ImportAnalytics,
  MostContactedEntry,
  RawBucket,
} from './analytics.types';

export interface AnalyticsQuery {
  readonly preset: DateRangePreset;
  readonly timezone: string;
  readonly from?: string;
  readonly to?: string;
  readonly granularity?: AnalyticsGranularity;
  /** How many contacts the most-contacted ranking returns. */
  readonly leaderboardLimit?: number;
  readonly now?: Date;
}

/**
 * Analytics are recomputed at most this often per distinct query.
 *
 * Short enough that the numbers still feel live, long enough to absorb the
 * repeated loads that happen while a user switches between ranges.
 */
export const ANALYTICS_CACHE_TTL_MS = 30_000;

export const DEFAULT_LEADERBOARD_LIMIT = 10;
export const MAX_LEADERBOARD_LIMIT = 50;

/**
 * Builds the analytics summary.
 *
 * Aggregation happens in MongoDB; this layer resolves the range, chooses a
 * sensible bucket size, fills gaps, and derives rates. Rates are computed here
 * rather than in the pipeline so every one has a single, documented
 * denominator.
 */
export class AnalyticsService {
  private readonly cache: TtlCache<AnalyticsSummary>;

  constructor(
    private readonly repository: AnalyticsRepository,
    cache?: TtlCache<AnalyticsSummary>,
  ) {
    this.cache = cache ?? new TtlCache<AnalyticsSummary>({ ttlMs: ANALYTICS_CACHE_TTL_MS });
  }

  public async getSummary(
    scope: AnalyticsScope,
    query: AnalyticsQuery,
  ): Promise<AnalyticsSummary> {
    const range = this.resolveRange(query);
    const granularity = query.granularity ?? this.defaultGranularity(range);
    const limit = this.resolveLeaderboardLimit(query.leaderboardLimit);

    // Validation happens before the cache lookup so a bad range is always
    // rejected, never served from a previous good one.
    const cacheKey = this.cacheKey(scope, range, granularity, limit);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const [
      rawCalls,
      callStatuses,
      rawEmails,
      emailStatuses,
      rawImports,
      callBuckets,
      emailBuckets,
      ranked,
    ] = await Promise.all([
      this.repository.callAnalytics(scope, range),
      this.repository.callStatusBreakdown(scope, range),
      this.repository.emailAnalytics(scope, range),
      this.repository.emailStatusBreakdown(scope, range),
      this.repository.importAnalytics(scope, range),
      this.repository.callBuckets(scope, range, granularity),
      this.repository.emailBuckets(scope, range, granularity),
      this.repository.mostContacted(scope, range, limit),
    ]);

    const calls: CallAnalytics = {
      totalCalls: rawCalls.totalCalls,
      connectedCalls: rawCalls.connectedCalls,
      missedCalls: rawCalls.missedCalls,
      failedCalls: rawCalls.failedCalls,
      totalDurationSeconds: rawCalls.totalDurationSeconds,
      // Averaged over connected calls: including unanswered calls would drag
      // the mean toward zero and misrepresent conversation length.
      averageDurationSeconds: this.safeAverage(
        rawCalls.totalDurationSeconds,
        rawCalls.connectedCalls,
      ),
      longestCallSeconds: rawCalls.longestCallSeconds ?? 0,
      successRate: this.safeRate(rawCalls.connectedCalls, rawCalls.totalCalls),
      byStatus: callStatuses,
    };

    const attempted = rawEmails.sentEmails + rawEmails.failedEmails;
    const emails: EmailAnalytics = {
      totalEmails: rawEmails.totalEmails,
      sentEmails: rawEmails.sentEmails,
      failedEmails: rawEmails.failedEmails,
      pendingEmails: Math.max(0, rawEmails.totalEmails - attempted),
      // Denominator is delivery attempts, not all emails: a draft has not
      // succeeded or failed, so counting it would understate the rate.
      successRate: this.safeRate(rawEmails.sentEmails, attempted),
      byStatus: emailStatuses,
    };

    const imports: ImportAnalytics = {
      ...rawImports,
      successRate: this.safeRate(rawImports.successfulRows, rawImports.totalRows),
    };

    const summary: AnalyticsSummary = {
      range: {
        preset: range.preset,
        granularity,
        timezone: range.timezone,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      calls,
      emails,
      imports,
      activity: this.buildActivitySeries(range, granularity, callBuckets, emailBuckets),
      mostContacted: await this.resolveMostContacted(scope, ranked),
    };

    this.cache.set(cacheKey, summary);

    return summary;
  }

  /**
   * Drops a workspace's cached analytics.
   *
   * Exposed so a write path can force fresh numbers when staleness would be
   * confusing, without flushing other tenants.
   */
  public invalidate(scope: AnalyticsScope): void {
    this.cache.invalidatePrefix(`${scope.workspaceId.toString()}:`);
  }

  /**
   * Cache keys are prefixed by workspace so one tenant can be invalidated
   * alone, and so no key can ever collide across tenants.
   */
  private cacheKey(
    scope: AnalyticsScope,
    range: DateRange,
    granularity: AnalyticsGranularity,
    limit: number,
  ): string {
    return [
      scope.workspaceId.toString(),
      range.preset,
      range.timezone,
      range.from.toISOString(),
      range.to.toISOString(),
      granularity,
      limit,
    ].join(':');
  }

  private resolveLeaderboardLimit(requested: number | undefined): number {
    if (requested === undefined) {
      return DEFAULT_LEADERBOARD_LIMIT;
    }

    return Math.min(Math.max(Math.trunc(requested), 1), MAX_LEADERBOARD_LIMIT);
  }

  private resolveRange(query: AnalyticsQuery): DateRange {
    if (query.preset === 'custom') {
      if (!query.from || !query.to) {
        throw new AppError(
          'A custom range needs both a start and an end date',
          400,
          'ANALYTICS_RANGE_INCOMPLETE',
        );
      }

      if (query.from > query.to) {
        throw new AppError(
          'The start date must not be after the end date',
          400,
          'ANALYTICS_RANGE_INVERTED',
        );
      }
    }

    const range = resolveDateRange({
      preset: query.preset,
      timezone: query.timezone,
      from: query.from,
      to: query.to,
      now: query.now,
    });

    // An unbounded range would scan the whole collection.
    if (rangeDayCount(range) > MAX_CUSTOM_RANGE_DAYS) {
      throw new AppError(
        `A range cannot be longer than ${MAX_CUSTOM_RANGE_DAYS} days`,
        400,
        'ANALYTICS_RANGE_TOO_LARGE',
      );
    }

    return range;
  }

  /**
   * Picks a bucket size that keeps the chart readable.
   *
   * 366 daily points is unreadable and needlessly large, so long ranges roll
   * up. The client can still override this explicitly.
   */
  private defaultGranularity(range: DateRange): AnalyticsGranularity {
    const days = rangeDayCount(range);

    if (days > 120) {
      return 'month';
    }
    if (days > 31) {
      return 'week';
    }

    return 'day';
  }

  /**
   * Produces one point per period, including periods with no activity.
   *
   * Gaps must be explicit zeros: a chart that simply omits quiet days implies
   * activity was continuous and distorts the shape of the trend.
   */
  private buildActivitySeries(
    range: DateRange,
    granularity: AnalyticsGranularity,
    callBuckets: readonly RawBucket[],
    emailBuckets: readonly RawBucket[],
  ): AnalyticsActivityPoint[] {
    const callsByKey = new Map(callBuckets.map((bucket) => [bucket._id, bucket]));
    const emailsByKey = new Map(emailBuckets.map((bucket) => [bucket._id, bucket]));

    const points: AnalyticsActivityPoint[] = [];
    const seen = new Set<string>();

    for (const day of this.eachLocalDay(range)) {
      const key = this.bucketKey(day, granularity, range.timezone);

      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const call = callsByKey.get(key);
      const email = emailsByKey.get(key);

      points.push({
        date: this.formatLocalDate(day, range.timezone),
        label: key,
        calls: call?.total ?? 0,
        emails: email?.total ?? 0,
        connectedCalls: call?.successful ?? 0,
        sentEmails: email?.successful ?? 0,
      });
    }

    return points;
  }

  /** Local calendar days in the range, as UTC instants at local midnight. */
  private *eachLocalDay(range: DateRange): Generator<Date> {
    const parts = this.localParts(range.from, range.timezone);
    let cursor = startOfLocalDay(parts, range.timezone);

    while (cursor < range.to) {
      yield cursor;

      const next = this.localParts(new Date(cursor.getTime() + 36 * 3_600_000), range.timezone);
      cursor = startOfLocalDay(next, range.timezone);
    }
  }

  private localParts(instant: Date, timezone: string) {
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

  private formatLocalDate(instant: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  }

  /** Mirrors the Mongo `$dateToString` keys so buckets line up exactly. */
  private bucketKey(
    instant: Date,
    granularity: AnalyticsGranularity,
    timezone: string,
  ): string {
    const date = this.formatLocalDate(instant, timezone);

    if (granularity === 'day') {
      return date;
    }
    if (granularity === 'month') {
      return date.slice(0, 7);
    }

    return this.isoWeekKey(date);
  }

  /** ISO-8601 week key (`%G-W%V`), matching MongoDB's own definition. */
  private isoWeekKey(localDate: string): string {
    const [year, month, day] = localDate.split('-').map(Number);
    const date = new Date(Date.UTC(year as number, (month as number) - 1, day as number));

    // Thursday determines the ISO week-numbering year.
    const dayOfWeek = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayOfWeek + 3);

    const isoYear = date.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstDayOfWeek = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayOfWeek + 3);

    const week =
      1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));

    return `${isoYear}-W${String(week).padStart(2, '0')}`;
  }

  private async resolveMostContacted(
    scope: AnalyticsScope,
    ranked: readonly {
      contactId: unknown;
      callCount: number;
      emailCount: number;
      lastInteractionAt: Date | null;
    }[],
  ): Promise<MostContactedEntry[]> {
    if (ranked.length === 0) {
      return [];
    }

    const ids = ranked.map((row) => new Types.ObjectId(String(row.contactId)));
    const contacts = await this.repository.findContactsByIds(scope, ids);
    const byId = new Map(contacts.map((contact) => [contact._id.toString(), contact]));

    return ranked
      .map((row) => {
        const id = String(row.contactId);
        const contact = byId.get(id);

        // A contact deleted since the interaction is skipped rather than
        // listed as "Unknown": the ranking should not resurrect it.
        if (!contact) {
          return null;
        }

        return {
          contactId: id,
          contactName: contact.name,
          company: contact.company ?? null,
          callCount: row.callCount,
          emailCount: row.emailCount,
          totalInteractions: row.callCount + row.emailCount,
          lastInteractionAt: row.lastInteractionAt
            ? new Date(row.lastInteractionAt).toISOString()
            : null,
        };
      })
      .filter((entry): entry is MostContactedEntry => entry !== null);
  }

  /** Percentage to one decimal place; an empty denominator is 0, not NaN. */
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
