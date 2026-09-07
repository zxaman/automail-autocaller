/**
 * Timezone-aware date range resolution.
 *
 * "Today" must mean today in the *user's* timezone, not the server's. A
 * recruiter in Asia/Kolkata at 02:00 IST is still on the previous UTC day, so
 * naive UTC boundaries would show the wrong numbers. These helpers compute the
 * UTC instants that bound a local calendar day using the Intl database, which
 * handles daylight saving without a date library.
 */

export const DATE_RANGE_PRESETS = ['today', 'week', 'month', 'custom'] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export interface DateRange {
  /** Inclusive lower bound as a UTC instant. */
  from: Date;
  /** Exclusive upper bound as a UTC instant. */
  to: Date;
  timezone: string;
  preset: DateRangePreset;
}

/** Falls back to UTC when a client supplies an unknown timezone. */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(timezone: string | undefined): string {
  return timezone && isValidTimezone(timezone) ? timezone : 'UTC';
}

/** Calendar parts of an instant as observed in the given timezone. */
function localParts(instant: Date, timezone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = formatter.format(instant).split('-').map(Number);
  return { year: year as number, month: month as number, day: day as number };
}

/** Offset in minutes between the timezone and UTC at the given instant. */
function offsetMinutes(instant: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts['year']),
    Number(parts['month']) - 1,
    Number(parts['day']),
    Number(parts['hour']) === 24 ? 0 : Number(parts['hour']),
    Number(parts['minute']),
    Number(parts['second']),
  );

  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * The UTC instant corresponding to local midnight of the given calendar date.
 * The offset is resolved twice so a DST transition on that date is respected.
 */
export function startOfLocalDay(
  parts: { year: number; month: number; day: number },
  timezone: string,
): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), timezone) * 60_000);
  return new Date(naive - offsetMinutes(firstGuess, timezone) * 60_000);
}

function addDays(parts: { year: number; month: number; day: number }, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export interface ResolveRangeInput {
  preset: DateRangePreset;
  timezone: string;
  /** ISO date strings (YYYY-MM-DD) required when the preset is 'custom'. */
  from?: string;
  to?: string;
  now?: Date;
}

/** Maximum span for a custom range, protecting the aggregation from abuse. */
export const MAX_CUSTOM_RANGE_DAYS = 366;

export function resolveDateRange(input: ResolveRangeInput): DateRange {
  const timezone = resolveTimezone(input.timezone);
  const now = input.now ?? new Date();
  const today = localParts(now, timezone);

  if (input.preset === 'custom' && input.from && input.to) {
    const [fy, fm, fd] = input.from.split('-').map(Number);
    const [ty, tm, td] = input.to.split('-').map(Number);
    const fromParts = { year: fy as number, month: fm as number, day: fd as number };
    const toParts = { year: ty as number, month: tm as number, day: td as number };

    const from = startOfLocalDay(fromParts, timezone);
    // Exclusive upper bound: midnight at the start of the following day.
    const to = startOfLocalDay(addDays(toParts, 1), timezone);

    return { from, to, timezone, preset: 'custom' };
  }

  const endExclusive = startOfLocalDay(addDays(today, 1), timezone);

  switch (input.preset) {
    case 'week': {
      // Rolling seven days including today, which matches how users read
      // "this week" on an activity dashboard.
      return {
        from: startOfLocalDay(addDays(today, -6), timezone),
        to: endExclusive,
        timezone,
        preset: 'week',
      };
    }
    case 'month': {
      return {
        from: startOfLocalDay(addDays(today, -29), timezone),
        to: endExclusive,
        timezone,
        preset: 'month',
      };
    }
    case 'today':
    default:
      return {
        from: startOfLocalDay(today, timezone),
        to: endExclusive,
        timezone,
        preset: 'today',
      };
  }
}

/** Number of whole days a range spans, used for validation and bucketing. */
export function rangeDayCount(range: DateRange): number {
  return Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
}
