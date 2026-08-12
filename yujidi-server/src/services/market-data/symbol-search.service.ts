import { z } from "zod";

import { SymbolModel } from "../../models/Symbol.js";
import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../../types/market-data.types.js";
import { SimpleLruCache } from "../../utils/simple-lru-cache.js";
import { normalizeSearchText } from "../../utils/symbol-search-tokenizer.js";
import type { Clock } from "../../ports/clock.port.js";

const ACTIVE_STATUSES = ["ACTIVE", "TRADING"];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CANDIDATE_LIMIT = 120;
const systemClock: Clock = {
  now: () => new Date(),
};

const searchInputSchema = z.object({
  q: z.string().optional(),
  provider: z.enum(MARKET_PROVIDERS).optional(),
  marketType: z.enum(MARKET_TYPES).optional(),
  exchange: z.enum(EXCHANGES).optional(),
  instrumentType: z.enum(INSTRUMENT_TYPES).optional(),
  underlyingSymbol: z.string().trim().transform((value) => value.toUpperCase()).optional(),
  expiry: z.coerce.date().optional(),
  optionType: z.enum(["CE", "PE"]).optional(),
  strikePrice: z.coerce.number().positive().optional(),
  includeExpired: z.boolean().default(false),
  limit: z.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type SymbolSearchInput = z.input<typeof searchInputSchema>;

export type SymbolSearchResult = {
  symbolId: string;
  symbol: string;
  displayName: string;
  provider: string;
  exchange: string;
  marketType: string;
  instrumentType?: string;
  providerSymbol: string;
  instrumentToken: string;
  expiry?: string;
  underlyingSymbol?: string;
  strikePrice?: number;
  optionType?: "CE" | "PE";
  lotSize?: number;
  tickSize?: number;
  requiresBrokerLogin: boolean;
  supportedBroker: string;
};

export type SymbolSearchResponse = {
  results: SymbolSearchResult[];
  meta: {
    query: string;
    normalizedQuery: string;
    limit: number;
    count: number;
  };
};

type SymbolSearchDocument = Record<string, unknown> & {
  _id?: { toString(): string };
  symbol?: string;
  displayName?: string;
  provider?: string;
  exchange?: string;
  marketType?: string;
  instrumentType?: string;
  providerSymbol?: string;
  instrumentToken?: string;
  expiry?: Date | string;
  underlyingSymbol?: string;
  strikePrice?: number;
  optionType?: "CE" | "PE";
  lotSize?: number;
  tickSize?: number;
  requiresBrokerLogin?: boolean;
  supportedBroker?: string;
  status?: string;
  searchName?: string;
  searchSymbol?: string;
  searchDisplayName?: string;
  searchProviderSymbol?: string;
  searchTokens?: string[];
  autocompleteTokens?: string[];
  searchRank?: number;
};

type SymbolSearchRepository = {
  find: (filter: Record<string, unknown>, projection: Record<string, number>) => {
    sort: (sort: Record<string, number>) => {
      limit: (limit: number) => {
        lean: () => {
          exec: () => Promise<SymbolSearchDocument[]>;
        };
      };
    };
  };
};

const projection = {
  searchTokens: 1,
  autocompleteTokens: 1,
  searchName: 1,
  searchSymbol: 1,
  searchDisplayName: 1,
  searchProviderSymbol: 1,
  searchRank: 1,
  symbol: 1,
  displayName: 1,
  provider: 1,
  exchange: 1,
  marketType: 1,
  instrumentType: 1,
  providerSymbol: 1,
  instrumentToken: 1,
  expiry: 1,
  underlyingSymbol: 1,
  strikePrice: 1,
  optionType: 1,
  lotSize: 1,
  tickSize: 1,
  requiresBrokerLogin: 1,
  supportedBroker: 1,
  status: 1,
} as const;

export class SymbolSearchService {
  private readonly cache = new SimpleLruCache<SymbolSearchResponse>(500, 60_000);

  public constructor(
    private readonly repository: SymbolSearchRepository = SymbolModel as unknown as SymbolSearchRepository,
    private readonly clock: Clock = systemClock,
  ) { }

  public async search(input: SymbolSearchInput): Promise<SymbolSearchResponse> {
    const parsed = searchInputSchema.parse(input);
    const query = parsed.q?.trim() ?? "";
    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery.length < 2) {
      return {
        results: [],
        meta: {
          query,
          normalizedQuery,
          limit: parsed.limit,
          count: 0,
        },
      };
    }

    const queryTokens = this.queryTokens(normalizedQuery);
    if (queryTokens.length === 0) {
      return {
        results: [],
        meta: {
          query,
          normalizedQuery,
          limit: parsed.limit,
          count: 0,
        },
      };
    }

    const cacheKey = this.cacheKey(parsed, normalizedQuery, queryTokens);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const filter: Record<string, unknown> = {
      status: { $in: ACTIVE_STATUSES },
      autocompleteTokens: queryTokens.length > 1
        ? { $all: queryTokens }
        : { $in: queryTokens },
    };

    if (parsed.provider) {
      filter.provider = parsed.provider;
    }
    if (parsed.marketType) {
      filter.marketType = parsed.marketType;
    }
    if (parsed.exchange) {
      filter.exchange = parsed.exchange;
    }
    if (parsed.instrumentType) {
      filter.instrumentType = parsed.instrumentType;
    }
    if (parsed.underlyingSymbol) {
      filter.underlyingSymbol = parsed.underlyingSymbol;
    }
    if (parsed.expiry) {
      const start = new Date(parsed.expiry);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.expiry = { $gte: start, $lt: end };
    }
    if (parsed.optionType) {
      filter.optionType = parsed.optionType;
    }
    if (parsed.strikePrice !== undefined) {
      filter.strikePrice = parsed.strikePrice;
    }
    if (!parsed.includeExpired) {
      const evaluatedAt = this.clock.now();
      filter.$or = [
        { expiry: { $exists: false } },
        { expiry: null },
        { expiry: { $gte: evaluatedAt } },
      ];
    }

    const candidates = await this.repository.find(filter, projection)
      .sort({ searchRank: -1, expiry: 1, symbol: 1 })
      .limit(CANDIDATE_LIMIT)
      .lean()
      .exec();
    const results = candidates
      .map((candidate) => ({
        candidate,
        score: this.score(candidate, normalizedQuery, queryTokens),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return this.expirySortValue(left.candidate) - this.expirySortValue(right.candidate);
      })
      .slice(0, parsed.limit)
      .map((entry) => this.toResult(entry.candidate));

    const response: SymbolSearchResponse = {
      results,
      meta: {
        query,
        normalizedQuery,
        limit: parsed.limit,
        count: results.length,
      },
    };
    this.cache.set(cacheKey, response);
    return response;
  }

  private queryTokens(normalizedQuery: string): string[] {
    return Array.from(new Set(
      normalizedQuery
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ));
  }

  private cacheKey(parsed: z.infer<typeof searchInputSchema>, normalizedQuery: string, queryTokens: string[]): string {
    return [
      "symbols:search",
      `q=${normalizedQuery}`,
      `tokens=${queryTokens.join(",")}`,
      `provider=${parsed.provider ?? ""}`,
      `marketType=${parsed.marketType ?? ""}`,
      `exchange=${parsed.exchange ?? ""}`,
      `instrumentType=${parsed.instrumentType ?? ""}`,
      `underlyingSymbol=${parsed.underlyingSymbol ?? ""}`,
      `expiry=${parsed.expiry?.toISOString() ?? ""}`,
      `optionType=${parsed.optionType ?? ""}`,
      `strikePrice=${parsed.strikePrice ?? ""}`,
      `includeExpired=${parsed.includeExpired}`,
      `limit=${parsed.limit}`,
    ].join(":");
  }

  private score(candidate: SymbolSearchDocument, normalizedQuery: string, queryTokens: string[]): number {
    const searchTokens = new Set([
      ...(candidate.searchTokens ?? []),
      ...(candidate.autocompleteTokens ?? []),
    ]);
    let score = Number(candidate.searchRank ?? 0);

    if (candidate.searchSymbol === normalizedQuery) score += 1000;
    if (candidate.searchProviderSymbol === normalizedQuery) score += 900;
    if (candidate.searchName === normalizedQuery) score += 800;
    if (candidate.searchSymbol?.startsWith(normalizedQuery)) score += 700;
    if (candidate.searchProviderSymbol?.startsWith(normalizedQuery)) score += 650;
    if (candidate.searchDisplayName?.startsWith(normalizedQuery)) score += 600;

    const allTokensMatch = queryTokens.every((token) => searchTokens.has(token));
    if (allTokensMatch) score += 500;
    for (const token of queryTokens) {
      if (searchTokens.has(token)) score += 50;
    }

    if (candidate.instrumentType === "FUTURE") score += 120;
    if (candidate.instrumentType === "SPOT" || candidate.instrumentType === "CASH") score += 100;
    if (candidate.instrumentType === "OPTION") score += 40;
    if (candidate.status === "ACTIVE" || candidate.status === "TRADING") score += 20;
    if (candidate.expiry && this.expirySortValue(candidate) !== Number.MAX_SAFE_INTEGER) score += 10;

    return score;
  }

  private expirySortValue(candidate: SymbolSearchDocument): number {
    if (!candidate.expiry) {
      return Number.MAX_SAFE_INTEGER;
    }
    const expiryTime = candidate.expiry instanceof Date
      ? candidate.expiry.getTime()
      : new Date(candidate.expiry).getTime();
    return Number.isFinite(expiryTime) ? expiryTime : Number.MAX_SAFE_INTEGER;
  }

  private toResult(candidate: SymbolSearchDocument): SymbolSearchResult {
    const expiry = candidate.expiry
      ? new Date(candidate.expiry).toISOString()
      : undefined;

    return {
      symbolId: candidate._id?.toString() ?? "",
      symbol: candidate.symbol ?? "",
      displayName: candidate.displayName ?? candidate.symbol ?? "",
      provider: candidate.provider ?? "BINANCE",
      exchange: candidate.exchange ?? "BINANCE",
      marketType: candidate.marketType ?? "CRYPTO",
      ...(candidate.instrumentType ? { instrumentType: candidate.instrumentType } : {}),
      providerSymbol: candidate.providerSymbol ?? candidate.symbol ?? "",
      instrumentToken: candidate.instrumentToken ?? candidate.symbol ?? "",
      ...(expiry ? { expiry } : {}),
      ...(candidate.underlyingSymbol ? { underlyingSymbol: candidate.underlyingSymbol } : {}),
      ...(candidate.strikePrice !== undefined ? { strikePrice: candidate.strikePrice } : {}),
      ...(candidate.optionType ? { optionType: candidate.optionType } : {}),
      ...(candidate.lotSize !== undefined ? { lotSize: candidate.lotSize } : {}),
      ...(candidate.tickSize !== undefined ? { tickSize: candidate.tickSize } : {}),
      requiresBrokerLogin: candidate.requiresBrokerLogin === true,
      supportedBroker: candidate.supportedBroker ?? "NONE",
    };
  }
}
