import { describe, expect, it } from 'vitest';

import { InitialsPipe } from './initials.pipe';

describe('InitialsPipe', () => {
  const pipe = new InitialsPipe();

  it('returns two initials', () => {
    expect(pipe.transform('Rahul Sharma')).toBe('RS');
  });

  it('ignores extra names', () => {
    expect(pipe.transform('Priya Ann Singh')).toBe('PA');
  });

  it('falls back for empty input', () => {
    expect(pipe.transform('')).toBe('?');
    expect(pipe.transform(null)).toBe('?');
  });
});
