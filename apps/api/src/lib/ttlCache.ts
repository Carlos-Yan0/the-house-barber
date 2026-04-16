type CacheValue<T> = {
  value: T;
  expiresAt: number;
};

type InflightValue<T> = {
  promise: Promise<T>;
};

export class TtlCache {
  private values = new Map<string, CacheValue<unknown>>();
  private inflight = new Map<string, InflightValue<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.values.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const inflight = this.inflight.get(key);
    if (inflight) return inflight.promise as Promise<T>;

    const promise = factory()
      .then((value) => {
        this.values.set(key, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
        this.inflight.delete(key);
        return value;
      })
      .catch((error) => {
        this.inflight.delete(key);
        throw error;
      });

    this.inflight.set(key, { promise });
    return promise;
  }

  delete(key: string) {
    this.values.delete(key);
    this.inflight.delete(key);
  }

  deleteByPrefix(prefix: string) {
    for (const key of this.values.keys()) {
      if (key.startsWith(prefix)) this.values.delete(key);
    }

    for (const key of this.inflight.keys()) {
      if (key.startsWith(prefix)) this.inflight.delete(key);
    }
  }
}

export const publicRouteCache = new TtlCache();
