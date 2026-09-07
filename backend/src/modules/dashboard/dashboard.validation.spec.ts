import { describe, expect, it } from 'vitest';

import { dashboardQuerySchema } from './dashboard.validation';

describe('dashboardQuerySchema', () => {
  it('applies defaults when no query is supplied', () => {
    const result = dashboardQuerySchema.parse({});
    expect(result).toEqual({ preset: 'today', timezone: 'UTC' });
  });

  it('accepts a valid custom range', () => {
    const result = dashboardQuerySchema.parse({
      preset: 'custom',
      timezone: 'Asia/Kolkata',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(result.preset).toBe('custom');
    expect(result.from).toBe('2026-01-01');
  });

  it('rejects a custom range that is missing bounds', () => {
    const result = dashboardQuerySchema.safeParse({ preset: 'custom', from: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects an inverted custom range', () => {
    const result = dashboardQuerySchema.safeParse({
      preset: 'custom',
      from: '2026-02-01',
      to: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a custom range longer than the allowed span', () => {
    const result = dashboardQuerySchema.safeParse({
      preset: 'custom',
      from: '2024-01-01',
      to: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed dates and unknown presets', () => {
    expect(dashboardQuerySchema.safeParse({ preset: 'quarter' }).success).toBe(false);
    expect(
      dashboardQuerySchema.safeParse({ preset: 'custom', from: '01-01-2026', to: '2026-01-31' })
        .success,
    ).toBe(false);
  });
});
