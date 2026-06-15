import type {
  InstrumentSubscription,
  MarketDataProvider,
} from "../../../ports/market-data-provider.port.js";
import type { NormalizedMarketTick } from "../../../types/market-data.types.js";
import type { AngelSmartApiConfig } from "./angel.types.js";

export class AngelMarketDataProvider implements MarketDataProvider {
  public readonly provider = "ANGEL_ONE" as const;

  private tickHandler: ((tick: NormalizedMarketTick) => void) | null = null;
  private connected = false;
  private subscriptions = new Map<string, InstrumentSubscription>();

  public constructor(private readonly config: AngelSmartApiConfig) {}

  public async connect(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error("Angel SmartAPI market data is disabled. Set ANGEL_SMARTAPI_ENABLED=true before connecting.");
    }

    throw new Error(
      "Angel live WebSocket connection is not implemented yet. Official feed-token flow must be approved before enabling live data.",
    );
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    this.subscriptions.clear();
  }

  public async subscribe(instruments: InstrumentSubscription[]): Promise<void> {
    if (!this.connected) {
      throw new Error("AngelMarketDataProvider is not connected");
    }

    for (const instrument of instruments) {
      this.subscriptions.set(this.getSubscriptionKey(instrument), instrument);
    }
  }

  public async unsubscribe(instruments: InstrumentSubscription[]): Promise<void> {
    for (const instrument of instruments) {
      this.subscriptions.delete(this.getSubscriptionKey(instrument));
    }
  }

  public onTick(handler: (tick: NormalizedMarketTick) => void): void {
    this.tickHandler = handler;
  }

  public getRegisteredTickHandler(): ((tick: NormalizedMarketTick) => void) | null {
    return this.tickHandler;
  }

  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  private getSubscriptionKey(instrument: InstrumentSubscription): string {
    return `${instrument.provider}:${instrument.exchange}:${instrument.instrumentToken}`;
  }
}
