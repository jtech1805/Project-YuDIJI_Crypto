import type {
  InstrumentSubscription,
  MarketDataProvider,
} from "../../../ports/market-data-provider.port.js";
import type { NormalizedMarketTick } from "../../../types/market-data.types.js";
import type { AngelSmartApiConfig } from "./angel.types.js";

export class AngelMarketDataProvider implements MarketDataProvider {
  public readonly provider = "ANGEL_ONE" as const;

  private tickHandler: ((tick: NormalizedMarketTick) => void) | null = null;

  public constructor(private readonly config: AngelSmartApiConfig) {}

  public async connect(): Promise<void> {
    void this.config;
    throw new Error("AngelMarketDataProvider.connect is not implemented yet. Phase 0 scaffold only.");
  }

  public async disconnect(): Promise<void> {
    throw new Error("AngelMarketDataProvider.disconnect is not implemented yet. Phase 0 scaffold only.");
  }

  public async subscribe(_instruments: InstrumentSubscription[]): Promise<void> {
    throw new Error("AngelMarketDataProvider.subscribe is not implemented yet. Phase 0 scaffold only.");
  }

  public async unsubscribe(_instruments: InstrumentSubscription[]): Promise<void> {
    throw new Error("AngelMarketDataProvider.unsubscribe is not implemented yet. Phase 0 scaffold only.");
  }

  public onTick(handler: (tick: NormalizedMarketTick) => void): void {
    this.tickHandler = handler;
  }

  public getRegisteredTickHandler(): ((tick: NormalizedMarketTick) => void) | null {
    return this.tickHandler;
  }
}
