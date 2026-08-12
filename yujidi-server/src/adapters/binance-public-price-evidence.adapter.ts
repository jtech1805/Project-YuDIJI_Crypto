import type { EvidenceProviderAdapter } from "../ports/evidence-provider-adapter.port.js";
import type { BinancePublicMarketClient } from "../ports/binance-public-market-client.port.js";
import type { Clock } from "../ports/clock.port.js";
import type {
  EvidenceCandidate,
  EvidenceObservationCandidate,
} from "../types/evidence-ingestion.types.js";
import {
  BinancePriceAdapterError,
  MAX_BINANCE_PRICE_SYMBOLS,
} from "../types/binance-public-price-evidence.types.js";

export const BINANCE_PUBLIC_PRICE_ADAPTER_ID =
  "BINANCE_PUBLIC_MARKET_PRICE_V1";
export const BINANCE_MARKET_PRICE_FACTOR_KEY = "MARKET.PRICE";

const BINANCE_USDT_SYMBOL_PATTERN = /^[A-Z0-9]{2,14}USDT$/;
const STRICT_POSITIVE_DECIMAL_PATTERN =
  /^(?:0\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/;

export type BinancePublicPriceEvidenceAdapterDependencies = {
  client: BinancePublicMarketClient;
  clock: Clock;
  symbols: readonly string[];
};

export class BinancePublicPriceEvidenceAdapter
implements EvidenceProviderAdapter {
  public readonly adapterId = BINANCE_PUBLIC_PRICE_ADAPTER_ID;
  private readonly symbols: readonly string[];

  public constructor(
    private readonly dependencies:
      BinancePublicPriceEvidenceAdapterDependencies,
  ) {
    this.symbols = validateSymbols(dependencies.symbols);
  }

  public async readCandidates(): Promise<readonly EvidenceCandidate[]> {
    const clockValue = this.dependencies.clock.now();
    if (!(clockValue instanceof Date) || !Number.isFinite(clockValue.getTime())) {
      throw new BinancePriceAdapterError("INVALID_CLOCK");
    }
    const observedAtMs = clockValue.getTime();
    const candidates: EvidenceObservationCandidate[] = [];

    for (const symbol of this.symbols) {
      let payload: unknown;
      try {
        payload = await this.dependencies.client.getTickerPrice(symbol);
      } catch {
        throw new BinancePriceAdapterError("PROVIDER_REQUEST_FAILED");
      }
      const price = validatePayload(payload, symbol);
      const observedAt = new Date(observedAtMs);
      candidates.push({
        recordType: "OBSERVATION",
        factorKey: BINANCE_MARKET_PRICE_FACTOR_KEY,
        subject: {
          type: "INSTRUMENT",
          key: `CRYPTO:BINANCE:${symbol}`,
          symbol,
          exchange: "BINANCE",
          marketType: "CRYPTO",
        },
        provenance: {
          sourceType: "MARKET_DATA",
          provider: "BINANCE",
          sourceName: BINANCE_PUBLIC_PRICE_ADAPTER_ID,
          externalReference:
            `${BINANCE_PUBLIC_PRICE_ADAPTER_ID}:${symbol}:${observedAt.toISOString()}`,
        },
        value: {
          type: "NUMBER",
          numberValue: price,
          unit: "USDT",
        },
        observedAt,
        schemaVersion: "1.0",
      });
    }

    return candidates;
  }
}

const validateSymbols = (symbols: readonly string[]): readonly string[] => {
  if (
    !Array.isArray(symbols)
    || symbols.length < 1
    || symbols.length > MAX_BINANCE_PRICE_SYMBOLS
  ) {
    throw new BinancePriceAdapterError("INVALID_CONFIGURATION");
  }
  const unique = new Set<string>();
  for (const symbol of symbols) {
    if (
      typeof symbol !== "string"
      || symbol.trim() !== symbol
      || !BINANCE_USDT_SYMBOL_PATTERN.test(symbol)
      || unique.has(symbol)
    ) {
      throw new BinancePriceAdapterError("INVALID_CONFIGURATION");
    }
    unique.add(symbol);
  }
  return Object.freeze([...symbols]);
};

const validatePayload = (payload: unknown, requestedSymbol: string): number => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new BinancePriceAdapterError("INVALID_PROVIDER_RESPONSE");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.symbol !== "string" || typeof record.price !== "string") {
    throw new BinancePriceAdapterError("INVALID_PROVIDER_RESPONSE");
  }
  if (
    record.symbol.trim() !== record.symbol
    || !BINANCE_USDT_SYMBOL_PATTERN.test(record.symbol)
  ) {
    throw new BinancePriceAdapterError("INVALID_PROVIDER_RESPONSE");
  }
  if (record.symbol !== requestedSymbol) {
    throw new BinancePriceAdapterError("SYMBOL_MISMATCH");
  }
  if (!STRICT_POSITIVE_DECIMAL_PATTERN.test(record.price)) {
    throw new BinancePriceAdapterError("INVALID_PRICE");
  }
  const price = Number(record.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new BinancePriceAdapterError("INVALID_PRICE");
  }
  return price;
};
