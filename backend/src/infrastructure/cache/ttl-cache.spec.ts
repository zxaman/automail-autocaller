import { describe, expect, it } from 'vitest';

import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  const makeClock = (start = 0) => {
    let current = start;
    return {
      now: () => current,
      advance: (ms: number) => {
        current += ms;
      },
    };
  };

  it('returns a stored value before it expires', () => {
    const clock = makeClock();
    const cache = new TtlCache<number>({ ttlMs: 1000, now: clock.now });

    cache.set('a', 1);
    clock.advance(999);

    expect(cache.get('a')).toBe(1);
  });

  it('discards a value once the ttl has passed', () => {
    const clock = makeClock();
    const cache = new TtlCache<number>({ ttlMs: 1000, now: clock.now });

    cache.set('a', 1);
    clock.advance(1000);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('reports a miss for an unknown key', () => {
    const cache = new TtlCache<number>({ ttlMs: 1000 });

    expect(cache.get('nope')).toBeUndefined();
  });

  it('invalidates only the matching prefix', () => {
    const cache = new TtlCache<number>({ ttlMs: 1000 });

    cache.set('ws1:a', 1);
    cache.set('ws1:b', 2);
    cache.set('ws2:a', 3);

    cache.invalidatePrefix('ws1:');

    expect(cache.get('ws1:a')).toBeUndefined();
    expect(cache.get('ws1:b')).toBeUndefined();
    // Another workspace must be untouched.
    expect(cache.get('ws2:a')).toBe(3);
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new TtlCache<number>({ ttlMs: 10_000, maxEntries: 2 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('replaces a value without growing the cache', () => {
    const cache = new TtlCache<number>({ ttlMs: 1000 });

    cache.set('a', 1);
    cache.set('a', 2);

    expect(cache.get('a')).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('restarts the ttl when a value is replaced', () => {
    const clock = makeClock();
    const cache = new TtlCache<number>({ ttlMs: 1000, now: clock.now });

    cache.set('a', 1);
    clock.advance(900);
    cache.set('a', 2);
    clock.advance(900);

    expect(cache.get('a')).toBe(2);
  });
});
