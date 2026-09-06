import { describe, expect, it } from 'vitest';

import { RelativeTimePipe } from './relative-time.pipe';

describe('RelativeTimePipe', () => {
  const pipe = new RelativeTimePipe();

  it('marks recent timestamps as just now', () => {
    expect(pipe.transform(new Date())).toBe('Just now');
  });

  it('labels earlier times today', () => {
    const earlier = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = pipe.transform(earlier);
    expect(result === 'Just now' || result.startsWith('Today') || result.startsWith('Yesterday')).toBe(
      true,
    );
  });

  it('handles invalid input', () => {
    expect(pipe.transform('not-a-date')).toBe('—');
    expect(pipe.transform(null)).toBe('—');
  });
});
