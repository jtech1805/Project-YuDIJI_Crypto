type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class SimpleLruCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  public constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  public get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: T): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }

  public clear(): void {
    this.entries.clear();
  }
}
