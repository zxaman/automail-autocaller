import { describe, expect, it } from 'vitest';

import {
  rangeDayCount,
  resolveDateRange,
  resolveTimezone,
  startOfLocalDay,
} from './date-range';

describe('resolveTimezone', () => {
  it('accepts a valid IANA zone and falls back to UTC otherwise', () => {
    expect(resolveTimezone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(resolveTimezone('Not/AZone')).toBe('UTC');
    expect(resolveTimezone(undefined)).toBe('UTC');
  });
});

describe('startOfLocalDay', () => {
  it('returns the UTC instant of local midnight in Asia/Kolkata', () => {
    // IST is UTC+5:30, so local midnight is 18:30 UTC the previous day.
    const start = startOfLocalDay({ year: 2026, month: 9, day: 6 }, 'Asia/Kolkata');
    expect(start.toISOString()).toBe('2026-09-05T18:30:00.000Z');
  });

  it('matches UTC midnight for UTC', () => {
    const start = startOfLocalDay({ year: 2026, month: 9, day: 6 }, 'UTC');
    expect(start.toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });

  it('handles a negative offset zone', () => {
    // New York is UTC-4 in September (EDT).
    const start = startOfLocalDay({ year: 2026, month: 9, day: 6 }, 'America/New_York');
    expect(start.toISOString()).toBe('2026-09-06T04:00:00.000Z');
  });

  it('respects a daylight-saving transition date', () => {
    // London moves to GMT on 2026-10-25; local midnight is still 23:00 UTC prior.
    const start = startOfLocalDay({ year: 2026, month: 10, day: 25 }, 'Europe/London');
    expect(start.toISOString()).toBe('2026-10-24T23:00:00.000Z');
  });
});

describe('resolveDateRange', () => {
  // 02:00 IST on 6 Sep is still 5 Sep in UTC: the classic off-by-one-day bug.
  const earlyMorningIst = new Date('2026-09-05T20:30:00.000Z');

  it('uses the local calendar day, not the UTC day', () => {
    const range = resolveDateRange({
      preset: 'today',
      timezone: 'Asia/Kolkata',
      now: earlyMorningIst,
    });

    expect(range.from.toISOString()).toBe('2026-09-05T18:30:00.000Z');
    expect(range.to.toISOString()).toBe('2026-09-06T18:30:00.000Z');
    expect(rangeDayCount(range)).toBe(1);
  });

  it('produces the same instant range for UTC when asked for UTC', () => {
    const range = resolveDateRange({
      preset: 'today',
      timezone: 'UTC',
      now: earlyMorningIst,
    });

    expect(range.from.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });

  it('spans seven days for the week preset', () => {
    const range = resolveDateRange({
      preset: 'week',
      timezone: 'Asia/Kolkata',
      now: earlyMorningIst,
    });
    expect(rangeDayCount(range)).toBe(7);
  });

  it('spans thirty days for the month preset', () => {
    const range = resolveDateRange({
      preset: 'month',
      timezone: 'Asia/Kolkata',
      now: earlyMorningIst,
    });
    expect(rangeDayCount(range)).toBe(30);
  });

  it('treats a custom range as inclusive of the end date', () => {
    const range = resolveDateRange({
      preset: 'custom',
      timezone: 'Asia/Kolkata',
      from: '2026-09-01',
      to: '2026-09-03',
    });

    expect(range.from.toISOString()).toBe('2026-08-31T18:30:00.000Z');
    expect(range.to.toISOString()).toBe('2026-09-03T18:30:00.000Z');
    expect(rangeDayCount(range)).toBe(3);
  });

  it('falls back to a preset when custom bounds are missing', () => {
    const range = resolveDateRange({ preset: 'custom', timezone: 'UTC', now: earlyMorningIst });
    expect(range.preset).toBe('today');
  });

  it('uses an exclusive upper bound so the two ends never overlap', () => {
    const today = resolveDateRange({ preset: 'today', timezone: 'UTC', now: earlyMorningIst });
    // An event exactly at `to` belongs to the next day, not this one.
    expect(today.to.getTime()).toBeGreaterThan(today.from.getTime());
    expect(today.to.getTime() - today.from.getTime()).toBe(86_400_000);
  });
});
