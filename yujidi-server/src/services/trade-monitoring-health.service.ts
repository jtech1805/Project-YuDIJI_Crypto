export type TradeMonitoringHealthEntry = {
  subscriptionKey: string;
  lastTickAt?: Date;
  lastEvaluatedAt?: Date;
  skippedCount: number;
  evaluatedCount: number;
  staleTickCount: number;
  cooldownSkipCount: number;
  workloadCapHitCount: number;
};

export class TradeMonitoringHealthService {
  private readonly entries = new Map<string, TradeMonitoringHealthEntry>();

  public constructor(private readonly maxEntries = 5_000) {}

  public recordTick(subscriptionKey: string, at: Date): void {
    this.entry(subscriptionKey).lastTickAt = at;
  }

  public recordEvaluated(subscriptionKey: string, at: Date, count = 1): void {
    const entry = this.entry(subscriptionKey);
    entry.lastEvaluatedAt = at;
    entry.evaluatedCount += count;
  }

  public recordSkipped(subscriptionKey: string, count = 1): void {
    this.entry(subscriptionKey).skippedCount += count;
  }

  public recordStale(subscriptionKey: string): void {
    const entry = this.entry(subscriptionKey);
    entry.skippedCount += 1;
    entry.staleTickCount += 1;
  }

  public recordCooldownSkip(subscriptionKey: string, count = 1): void {
    const entry = this.entry(subscriptionKey);
    entry.skippedCount += count;
    entry.cooldownSkipCount += count;
  }

  public recordWorkloadCap(subscriptionKey: string, skippedCount: number): void {
    const entry = this.entry(subscriptionKey);
    entry.skippedCount += skippedCount;
    entry.workloadCapHitCount += 1;
  }

  public getSnapshot(): TradeMonitoringHealthEntry[] {
    return [...this.entries.values()]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => left.subscriptionKey.localeCompare(right.subscriptionKey));
  }

  private entry(subscriptionKey: string): TradeMonitoringHealthEntry {
    const existing = this.entries.get(subscriptionKey);
    if (existing) return existing;

    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey) this.entries.delete(oldestKey);
    }
    const created: TradeMonitoringHealthEntry = {
      subscriptionKey,
      skippedCount: 0,
      evaluatedCount: 0,
      staleTickCount: 0,
      cooldownSkipCount: 0,
      workloadCapHitCount: 0,
    };
    this.entries.set(subscriptionKey, created);
    return created;
  }
}

export const sharedTradeMonitoringHealthService = new TradeMonitoringHealthService();
