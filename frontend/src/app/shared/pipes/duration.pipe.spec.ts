import { describe, expect, it } from 'vitest';

import { DurationPipe } from './duration.pipe';

describe('DurationPipe', () => {
  const pipe = new DurationPipe();

  it('formats minutes and seconds', () => {
    expect(pipe.transform(332)).toBe('5m 32s');
  });

  it('formats hours', () => {
    expect(pipe.transform(3840)).toBe('1h 04m');
  });

  it('formats seconds only', () => {
    expect(pipe.transform(42)).toBe('42s');
  });

  it('handles missing and invalid values', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform(-5)).toBe('—');
  });
});
