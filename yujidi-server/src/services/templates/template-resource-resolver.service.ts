import { isValidObjectId, Types } from "mongoose";

import { SymbolModel } from "../../models/Symbol.js";
import type { MarketSnapshot } from "../../types/market-snapshot.types.js";
import type { ScoringContextSymbolIds } from "../../types/scoring.types.js";
import { buildMarketResourceKey, sharedMarketSnapshotService } from "../market-data/market-snapshot.service.js";

type QueryExec<T> = { exec: () => Promise<T> };
type LeanQueryExec<T> = { lean: () => QueryExec<T> };
type SymbolRepository = {
  findOne: (
    filter: Record<string, unknown>,
    projection?: Record<string, 0 | 1>,
  ) => LeanQueryExec<Record<string, any> | null>;
};

type Dependencies = {
  symbolRepository: SymbolRepository;
  marketSnapshotService: {
    getSnapshot: (resourceKey: string) => MarketSnapshot | null;
  };
};

export type ResolvedScoringResource = {
  role: "INDEX" | "SECTOR" | "VIX";
  symbolId?: string;
  resourceKey?: string;
  snapshot: MarketSnapshot | null;
  reasonCode?: string;
};

export type IndiaEquityScoringResources = {
  index: ResolvedScoringResource;
  sector: ResolvedScoringResource;
  vix: ResolvedScoringResource;
};

const projection = {
  _id: 1,
  provider: 1,
  exchange: 1,
  symbol: 1,
  providerSymbol: 1,
  instrumentToken: 1,
  status: 1,
} as const;

export class TemplateResourceResolverService {
  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public async resolveIndiaEquityResources(input: {
    userId: string;
    contextSymbolIds?: ScoringContextSymbolIds;
  }): Promise<IndiaEquityScoringResources> {
    const index = await this.resolveResource({
      role: "INDEX",
      userId: input.userId,
      ...(input.contextSymbolIds?.indexSymbolId
        ? { symbolId: input.contextSymbolIds.indexSymbolId }
        : {}),
      defaultFilter: {
        status: { $in: ["ACTIVE", "TRADING"] },
        marketType: "INDEX",
        $or: [
          { symbol: { $in: ["NIFTY50", "NIFTY 50"] } },
          { providerSymbol: { $in: ["NIFTY50", "NIFTY 50"] } },
          { name: { $in: ["NIFTY50", "NIFTY 50"] } },
        ],
      },
    });
    const sector = input.contextSymbolIds?.sectorSymbolId
      ? await this.resolveResource({
        role: "SECTOR",
        userId: input.userId,
        symbolId: input.contextSymbolIds.sectorSymbolId,
      })
      : {
        role: "SECTOR" as const,
        snapshot: null,
        reasonCode: "SECTOR_MAPPING_UNAVAILABLE",
      };
    const vix = await this.resolveResource({
      role: "VIX",
      userId: input.userId,
      ...(input.contextSymbolIds?.vixSymbolId
        ? { symbolId: input.contextSymbolIds.vixSymbolId }
        : {}),
      defaultFilter: {
        status: { $in: ["ACTIVE", "TRADING"] },
        marketType: "INDEX",
        $or: [
          { symbol: { $in: ["INDIA_VIX", "INDIAVIX"] } },
          { providerSymbol: { $in: ["INDIA_VIX", "INDIAVIX"] } },
          { name: { $in: ["INDIA VIX", "INDIA_VIX", "INDIAVIX"] } },
        ],
      },
    });
    return { index, sector, vix };
  }

  private async resolveResource(input: {
    role: ResolvedScoringResource["role"];
    userId: string;
    symbolId?: string;
    defaultFilter?: Record<string, unknown>;
  }): Promise<ResolvedScoringResource> {
    const filter = input.symbolId
      ? isValidObjectId(input.symbolId)
        ? { _id: new Types.ObjectId(input.symbolId) }
        : null
      : input.defaultFilter ?? null;
    if (!filter) {
      return {
        role: input.role,
        ...(input.symbolId ? { symbolId: input.symbolId } : {}),
        snapshot: null,
        reasonCode: `${input.role}_SYMBOL_INVALID`,
      };
    }
    const symbol = await this.getSymbolRepository().findOne(filter, projection).lean().exec();
    if (!symbol) {
      return {
        role: input.role,
        ...(input.symbolId ? { symbolId: input.symbolId } : {}),
        snapshot: null,
        reasonCode: `${input.role}_SYMBOL_UNAVAILABLE`,
      };
    }
    const resourceKey = buildMarketResourceKey({
      provider: String(symbol.provider),
      exchange: String(symbol.exchange),
      ...(symbol.instrumentToken ? { instrumentToken: String(symbol.instrumentToken) } : {}),
      ...(symbol.providerSymbol ? { providerSymbol: String(symbol.providerSymbol) } : {}),
      symbol: String(symbol.symbol),
      ...(symbol.provider === "ANGEL_ONE" ? { userId: input.userId } : {}),
    });
    return {
      role: input.role,
      symbolId: String(symbol._id),
      resourceKey,
      snapshot: this.getMarketSnapshotService().getSnapshot(resourceKey),
    };
  }

  private getSymbolRepository(): SymbolRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }

  private getMarketSnapshotService(): Dependencies["marketSnapshotService"] {
    return this.dependencies.marketSnapshotService ?? sharedMarketSnapshotService;
  }
}

export const sharedTemplateResourceResolver = new TemplateResourceResolverService();
