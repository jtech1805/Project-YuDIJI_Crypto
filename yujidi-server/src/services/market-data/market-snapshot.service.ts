import type {
  CandleSnapshot,
  CandleTimeframe,
  MarketResourceKey,
  MarketSnapshot,
  SnapshotMarketTick,
} from "../../types/market-snapshot.types.js";
import { buildMarketSubscriptionKey } from "../../utils/market-subscription-key.js";

const TIMEFRAME_MS: Record<CandleTimeframe, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
};
const TIMEFRAMES = Object.keys(TIMEFRAME_MS) as CandleTimeframe[];

type InternalSnapshot = MarketSnapshot & {
  lastCumulativeVolume?: number;
  touchedAt: number;
};

export const buildMarketResourceKey = (tick: Pick<
  SnapshotMarketTick,
  "provider" | "exchange" | "instrumentToken" | "providerSymbol" | "symbol" | "userId"
>): MarketResourceKey => {
  const instrumentToken = tick.instrumentToken?.trim()
    || tick.providerSymbol?.trim().toUpperCase()
    || tick.symbol?.trim().toUpperCase();
  if (!instrumentToken) throw new Error("Market snapshot tick identity is required");
  if (tick.provider === "ANGEL_ONE" && !tick.userId) {
    throw new Error("Angel market snapshot requires userId");
  }
  return buildMarketSubscriptionKey({
    provider: tick.provider as "BINANCE" | "ANGEL_ONE" | "KITE",
    exchange: tick.exchange as any,
    instrumentToken,
    ...(tick.provider === "ANGEL_ONE" ? { userId: tick.userId } : {}),
  });
};

export class MarketSnapshotService {
  private readonly snapshots = new Map<MarketResourceKey, InternalSnapshot>();

  public constructor(
    private readonly options: {
      maxResources?: number;
      maxCandlesPerTimeframe?: number;
      freshThresholdMs?: number;
      now?: () => Date;
    } = {},
  ) { }

  public recordTick(tick: SnapshotMarketTick): MarketSnapshot {
    if (!Number.isFinite(tick.price) || tick.price <= 0) {
      throw new Error("Invalid market snapshot price");
    }
    const resourceKey = buildMarketResourceKey(tick);
    const occurredAt = tick.occurredAt ?? tick.receivedAt;
    const timestamp = occurredAt.getTime();
    const existing = this.snapshots.get(resourceKey);
    const volumeDelta = this.resolveVolumeDelta(tick, existing);
    const snapshot = existing ?? this.createSnapshot(resourceKey, tick);

    if (snapshot.latestPrice !== undefined) {
      snapshot.previousPrice = snapshot.latestPrice;
    }
    snapshot.latestPrice = tick.price;
    if (tick.bid !== undefined && tick.bid > 0) snapshot.bid = tick.bid;
    if (tick.ask !== undefined && tick.ask > 0) snapshot.ask = tick.ask;
    if (snapshot.bid && snapshot.ask && snapshot.ask >= snapshot.bid) {
      const midpoint = (snapshot.bid + snapshot.ask) / 2;
      snapshot.spreadPercent = Number(
        (((snapshot.ask - snapshot.bid) / midpoint) * 100).toFixed(4),
      );
    }
    snapshot.lastTickAt = new Date(timestamp);
    snapshot.tickCount += 1;
    snapshot.touchedAt = this.getNow().getTime();
    snapshot.dayOpen = tick.open ?? snapshot.dayOpen ?? tick.price;
    snapshot.high = Math.max(tick.high ?? tick.price, snapshot.high ?? tick.price);
    snapshot.low = Math.min(tick.low ?? tick.price, snapshot.low ?? tick.price);
    if (tick.previousClose !== undefined) {
      snapshot.previousClose = tick.previousClose;
    }
    if (snapshot.previousClose && snapshot.previousClose > 0) {
      snapshot.changePercent = Number(
        (((tick.price - snapshot.previousClose) / snapshot.previousClose) * 100).toFixed(4),
      );
    } else if (snapshot.dayOpen && snapshot.dayOpen > 0) {
      snapshot.changePercent = Number(
        (((tick.price - snapshot.dayOpen) / snapshot.dayOpen) * 100).toFixed(4),
      );
    }
    if (tick.cumulativeVolume !== undefined) snapshot.lastCumulativeVolume = tick.cumulativeVolume;

    for (const timeframe of TIMEFRAMES) {
      this.updateCandle(snapshot, timeframe, tick.price, timestamp, volumeDelta);
    }
    this.updateVwap(snapshot, tick.price, volumeDelta);
    this.updateVolume(snapshot, tick, volumeDelta);
    this.updateDerivedStatus(snapshot, this.getNow());
    this.snapshots.set(resourceKey, snapshot);
    this.enforceResourceCap();
    return this.cloneSnapshot(snapshot);
  }

  public getSnapshot(resourceKey: MarketResourceKey, now = this.getNow()): MarketSnapshot | null {
    const snapshot = this.snapshots.get(resourceKey);
    if (!snapshot) return null;
    this.updateDerivedStatus(snapshot, now);
    snapshot.touchedAt = now.getTime();
    return this.cloneSnapshot(snapshot);
  }

  public getDebugSnapshot(resourceKey: MarketResourceKey): Record<string, unknown> | null {
    const snapshot = this.getSnapshot(resourceKey);
    if (!snapshot) return null;
    return {
      resourceKey: snapshot.resourceKey,
      latestPrice: snapshot.latestPrice,
      previousPrice: snapshot.previousPrice,
      bid: snapshot.bid,
      ask: snapshot.ask,
      spreadPercent: snapshot.spreadPercent,
      dayOpen: snapshot.dayOpen,
      high: snapshot.high,
      low: snapshot.low,
      previousClose: snapshot.previousClose,
      changePercent: snapshot.changePercent,
      lastTickAt: snapshot.lastTickAt,
      tickCount: snapshot.tickCount,
      candleSummary: Object.fromEntries(
        TIMEFRAMES.map((timeframe) => {
          const candles = snapshot.candles[timeframe];
          return [timeframe, {
            count: candles.length,
            latest: candles.at(-1),
          }];
        }),
      ),
      vwap: snapshot.vwap,
      volume: snapshot.volume,
      freshness: snapshot.freshness,
      dataConfidence: snapshot.dataConfidence,
    };
  }

  public getResourceCount(): number {
    return this.snapshots.size;
  }

  private createSnapshot(resourceKey: string, tick: SnapshotMarketTick): InternalSnapshot {
    return {
      resourceKey,
      provider: tick.provider,
      exchange: tick.exchange,
      ...(tick.marketType ? { marketType: tick.marketType } : {}),
      ...(tick.symbolId ? { symbolId: tick.symbolId } : {}),
      ...(tick.symbol ? { symbol: tick.symbol } : {}),
      ...(tick.providerSymbol ? { providerSymbol: tick.providerSymbol } : {}),
      ...(tick.instrumentToken ? { instrumentToken: tick.instrumentToken } : {}),
      ...(tick.userId ? { userId: tick.userId } : {}),
      tickCount: 0,
      candles: { "1m": [], "3m": [], "5m": [], "15m": [] },
      vwap: {
        cumulativePriceVolume: 0,
        cumulativeVolume: 0,
        status: "UNAVAILABLE",
      },
      volume: { status: "UNAVAILABLE" },
      freshness: { status: "MISSING" },
      dataConfidence: "UNAVAILABLE",
      touchedAt: this.getNow().getTime(),
    };
  }

  private updateCandle(
    snapshot: InternalSnapshot,
    timeframe: CandleTimeframe,
    price: number,
    timestamp: number,
    volume?: number,
  ): void {
    const duration = TIMEFRAME_MS[timeframe];
    const start = Math.floor(timestamp / duration) * duration;
    const candles = snapshot.candles[timeframe];
    const current = candles.at(-1);
    if (!current || current.startTime.getTime() !== start) {
      candles.push({
        timeframe,
        startTime: new Date(start),
        endTime: new Date(start + duration),
        open: price,
        high: price,
        low: price,
        close: price,
        ...(volume !== undefined ? { volume } : {}),
        tickCount: 1,
      });
      const overflow = candles.length - this.getMaxCandles();
      if (overflow > 0) candles.splice(0, overflow);
      return;
    }
    current.high = Math.max(current.high, price);
    current.low = Math.min(current.low, price);
    current.close = price;
    current.tickCount += 1;
    if (volume !== undefined) current.volume = (current.volume ?? 0) + volume;
  }

  private updateVwap(snapshot: InternalSnapshot, price: number, volume?: number): void {
    if (volume === undefined || volume <= 0) {
      snapshot.vwap.status = snapshot.vwap.cumulativeVolume > 0 ? "PARTIAL" : "UNAVAILABLE";
      return;
    }
    snapshot.vwap.cumulativePriceVolume += price * volume;
    snapshot.vwap.cumulativeVolume += volume;
    const value = snapshot.vwap.cumulativePriceVolume / snapshot.vwap.cumulativeVolume;
    const distance = ((price - value) / value) * 100;
    snapshot.vwap.value = Number(value.toFixed(6));
    snapshot.vwap.distanceFromVwapPercent = Number(distance.toFixed(4));
    snapshot.vwap.positionVsVwap = Math.abs(distance) <= 0.3
      ? "NEAR"
      : distance > 0 ? "ABOVE" : "BELOW";
    snapshot.vwap.status = "READY";
  }

  private updateVolume(
    snapshot: InternalSnapshot,
    tick: SnapshotMarketTick,
    volumeDelta?: number,
  ): void {
    if (volumeDelta === undefined && tick.cumulativeVolume === undefined) {
      snapshot.volume.status = "UNAVAILABLE";
      return;
    }
    if (volumeDelta !== undefined) {
      snapshot.volume.latestVolume = volumeDelta;
    }
    snapshot.volume.cumulativeVolume = tick.cumulativeVolume
      ?? (snapshot.volume.cumulativeVolume ?? 0) + (volumeDelta ?? 0);
    const oneMinuteCandles = snapshot.candles["1m"];
    const currentVolume = oneMinuteCandles.at(-1)?.volume;
    const baselines = oneMinuteCandles
      .slice(-21, -1)
      .map((candle) => candle.volume)
      .filter((value): value is number => value !== undefined && value > 0);
    if (currentVolume !== undefined && baselines.length > 0) {
      const average = baselines.reduce((total, value) => total + value, 0) / baselines.length;
      const relativeVolume = currentVolume / average;
      snapshot.volume.relativeVolume = Number(relativeVolume.toFixed(4));
      snapshot.volume.volumeTrend = relativeVolume >= 1.2
        ? "EXPANDING"
        : relativeVolume <= 0.8 ? "DRYING" : "FLAT";
      snapshot.volume.status = "READY";
    } else {
      snapshot.volume.status = "PARTIAL";
    }
  }

  private updateDerivedStatus(snapshot: InternalSnapshot, now: Date): void {
    if (!snapshot.lastTickAt) {
      snapshot.freshness = { status: "MISSING" };
      snapshot.dataConfidence = "UNAVAILABLE";
      return;
    }
    const ageMs = Math.max(0, now.getTime() - snapshot.lastTickAt.getTime());
    snapshot.freshness = {
      status: ageMs <= this.getFreshThreshold() ? "FRESH" : "STALE",
      ageMs,
    };
    snapshot.dataConfidence = snapshot.freshness.status === "STALE"
      ? "LOW"
      : snapshot.vwap.status === "READY" && snapshot.volume.status === "READY"
        ? "HIGH"
        : "MEDIUM";
  }

  private resolveVolumeDelta(
    tick: SnapshotMarketTick,
    existing?: InternalSnapshot,
  ): number | undefined {
    if (tick.volume !== undefined && tick.volume >= 0) return tick.volume;
    if (tick.cumulativeVolume !== undefined && tick.cumulativeVolume >= 0) {
      if (existing?.lastCumulativeVolume !== undefined) {
        return Math.max(0, tick.cumulativeVolume - existing.lastCumulativeVolume);
      }
      return undefined;
    }
    return undefined;
  }

  private enforceResourceCap(): void {
    const overflow = this.snapshots.size - this.getMaxResources();
    if (overflow <= 0) return;
    const oldest = [...this.snapshots.entries()]
      .sort((left, right) => left[1].touchedAt - right[1].touchedAt)
      .slice(0, overflow);
    for (const [key] of oldest) this.snapshots.delete(key);
  }

  private cloneSnapshot(snapshot: InternalSnapshot): MarketSnapshot {
    return {
      ...snapshot,
      ...(snapshot.lastTickAt ? { lastTickAt: new Date(snapshot.lastTickAt) } : {}),
      candles: Object.fromEntries(
        TIMEFRAMES.map((timeframe) => [
          timeframe,
          snapshot.candles[timeframe].map((candle): CandleSnapshot => ({
            ...candle,
            startTime: new Date(candle.startTime),
            endTime: new Date(candle.endTime),
          })),
        ]),
      ) as MarketSnapshot["candles"],
      vwap: { ...snapshot.vwap },
      volume: { ...snapshot.volume },
      freshness: { ...snapshot.freshness },
    };
  }

  private getNow(): Date {
    return this.options.now?.() ?? new Date();
  }
  private getMaxResources(): number {
    return this.options.maxResources ?? 5_000;
  }
  private getMaxCandles(): number {
    return this.options.maxCandlesPerTimeframe ?? 100;
  }
  private getFreshThreshold(): number {
    return this.options.freshThresholdMs ?? 10_000;
  }
}

export const sharedMarketSnapshotService = new MarketSnapshotService();
