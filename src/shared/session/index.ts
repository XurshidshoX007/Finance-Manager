/**
 * Bot uchun umumiy, TTL'li sessiya do'koni.
 *
 * Avval har bir handler o'zining `Map` obyektini ushlab turardi:
 * yozuvlar hech qachon tozalanmasdi (memory leak) va oqim
 * yarmida tashlab ketilgan sessiyalar abadiy qolib ketardi.
 */

export interface SessionEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 daqiqa

export class SessionStore<T> {
  private readonly store = new Map<string, SessionEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS, maxEntries = 10_000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      this.evictExpired();
      if (this.store.size >= this.maxEntries) {
        const oldest = this.store.keys().next();
        if (!oldest.done) this.store.delete(oldest.value);
      }
    }

    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.store.size;
  }

  evictExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }
}
