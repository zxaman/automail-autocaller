/**
 * A small in-process cache with per-entry expiry.
 *
 * Analytics re-aggregates several collections on every page load, and the
 * numbers do not change second to second, so a short TTL removes most of that
 * work. This is deliberately in-process rather than Redis-backed: the data is
 * cheap to recompute and safe to lose, so a shared store would add an
 * operational dependency for no correctness benefit. Each instance simply
 * keeps its own copy.
 *
 * Entries are capped so a workspace cannot grow the cache without bound by
 * requesting many distinct ranges.
 */
export interface TtlCacheOptions {
  readonly ttlMs: number;
  readonly maxEntries?: number;
  /** Injectable clock, so expiry is testable without waiting. */
  readonly now?: () => number;
}

interface CacheEntry<TValue> {
  readonly value: TValue;
  readonly expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 500;

export class TtlCache<TValue> {
  private readonly store = new Map<string, CacheEntry<TValue>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? (() => Date.now());
  }

  public get(key: string): TValue | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh recency so the eviction below drops genuinely cold entries.
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value;
  }

  public set(key: string, value: TValue): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });

    // Evict the least recently used entry once over capacity.
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next();

      if (oldest.done) {
        break;
      }

      this.store.delete(oldest.value);
    }
  }

  /**
   * Drops every entry under a prefix.
   *
   * Used to invalidate one workspace without disturbing the others, so a
   * tenant never sees numbers refreshed by another tenant's activity.
   */
  public invalidatePrefix(prefix: string): void {
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  public clear(): void {
    this.store.clear();
  }

  public get size(): number {
    return this.store.size;
  }
}
