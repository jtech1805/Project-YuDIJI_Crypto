import type { MarketSnapshot } from "../types/market-snapshot.types.js";

export type TemplateResourceHealth = {
  resourceKey: string;
  registeredAt: Date;
  lastTickAt?: Date;
  lastSnapshotStatus: MarketSnapshot["freshness"]["status"];
  refCount: number;
};

export class TemplateMonitoringOrchestratorService {
  private readonly resources = new Map<string, TemplateResourceHealth>();

  public register(resourceKey: string, snapshot?: MarketSnapshot | null): TemplateResourceHealth {
    const existing = this.resources.get(resourceKey);
    if (existing) {
      existing.refCount += 1;
      this.applySnapshot(existing, snapshot);
      return this.clone(existing);
    }
    const created: TemplateResourceHealth = {
      resourceKey,
      registeredAt: new Date(),
      ...(snapshot?.lastTickAt ? { lastTickAt: new Date(snapshot.lastTickAt) } : {}),
      lastSnapshotStatus: snapshot?.freshness.status ?? "MISSING",
      refCount: 1,
    };
    this.resources.set(resourceKey, created);
    return this.clone(created);
  }

  public ensure(resourceKey: string, snapshot?: MarketSnapshot | null): TemplateResourceHealth {
    const existing = this.resources.get(resourceKey);
    if (existing) {
      this.applySnapshot(existing, snapshot);
      return this.clone(existing);
    }
    return this.register(resourceKey, snapshot);
  }

  public unregister(resourceKey: string): void {
    const existing = this.resources.get(resourceKey);
    if (!existing) return;
    if (existing.refCount <= 1) {
      this.resources.delete(resourceKey);
      return;
    }
    existing.refCount -= 1;
  }

  public recordSnapshot(resourceKey: string, snapshot: MarketSnapshot): void {
    const existing = this.resources.get(resourceKey);
    if (!existing) return;
    this.applySnapshot(existing, snapshot);
  }

  public get(resourceKey: string): TemplateResourceHealth | null {
    const existing = this.resources.get(resourceKey);
    return existing ? this.clone(existing) : null;
  }

  public getSnapshot(): TemplateResourceHealth[] {
    return [...this.resources.values()].map((entry) => this.clone(entry));
  }

  private applySnapshot(
    target: TemplateResourceHealth,
    snapshot?: MarketSnapshot | null,
  ): void {
    if (!snapshot) return;
    target.lastSnapshotStatus = snapshot.freshness.status;
    if (snapshot.lastTickAt) target.lastTickAt = new Date(snapshot.lastTickAt);
  }

  private clone(entry: TemplateResourceHealth): TemplateResourceHealth {
    return {
      ...entry,
      registeredAt: new Date(entry.registeredAt),
      ...(entry.lastTickAt ? { lastTickAt: new Date(entry.lastTickAt) } : {}),
    };
  }
}

export const sharedTemplateMonitoringOrchestrator =
  new TemplateMonitoringOrchestratorService();
