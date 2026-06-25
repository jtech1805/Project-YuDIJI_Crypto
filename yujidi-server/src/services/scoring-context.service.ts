import { isValidObjectId, Types } from "mongoose";

import { AppError } from "../errors/AppError.js";
import { SymbolModel } from "../models/Symbol.js";
import type { AnalyzerRuntimeSnapshot } from "./analyzer.service.js";
import { ScoringTemplateRegistryService } from "./scoring-template-registry.service.js";
import { buildMarketSubscriptionKey } from "../utils/market-subscription-key.js";
import type { ScoringTemplateKey } from "../types/scoring.types.js";
import type { MarketSnapshot } from "../types/market-snapshot.types.js";
import {
  sharedMarketSnapshotService,
  type MarketSnapshotService,
} from "./market-snapshot.service.js";
import {
  sharedTemplateMonitoringOrchestrator,
  type TemplateMonitoringOrchestratorService,
} from "./template-monitoring-orchestrator.service.js";

type QueryExec<T> = { exec: () => Promise<T> };
type LeanQueryExec<T> = { lean: () => QueryExec<T> };
type SymbolRepository = {
  findOne: (
    filter: Record<string, unknown>,
    projection?: Record<string, 0 | 1>,
  ) => LeanQueryExec<Record<string, unknown> | null>;
};

type RuntimeProvider = {
  getAnalyzerRuntimeSnapshot: (input: {
    streamKeys: string[];
    includeBuffers: boolean;
    bufferLimit: number;
  }) => AnalyzerRuntimeSnapshot;
  getTradeMonitoringHealthSnapshot: () => Array<Record<string, unknown>>;
  getActiveTradeSubscriptionSnapshot: () => Array<Record<string, unknown>>;
};

type Dependencies = {
  symbolRepository: SymbolRepository;
  runtimeProvider: RuntimeProvider;
  templateRegistry: ScoringTemplateRegistryService;
  marketSnapshotService: Pick<MarketSnapshotService, "getSnapshot" | "getDebugSnapshot">;
  templateOrchestrator: Pick<TemplateMonitoringOrchestratorService, "ensure" | "get">;
};

export type ScoringContextInput = {
  userId: string;
  symbolId?: string;
  symbol?: string;
  provider?: string;
  exchange?: string;
  instrumentToken?: string;
  templateKey?: ScoringTemplateKey;
  includeBuffers?: boolean;
  bufferLimit?: number;
};

const projection = {
  symbol: 1,
  displayName: 1,
  provider: 1,
  marketType: 1,
  exchange: 1,
  instrumentType: 1,
  providerSymbol: 1,
  instrumentToken: 1,
  lotSize: 1,
  tickSize: 1,
  expiry: 1,
  requiresBrokerLogin: 1,
  status: 1,
} as const;

const evaluatorAvailability = (
  evaluatorKey: string,
  runtime: AnalyzerRuntimeSnapshot,
  marketSnapshot: MarketSnapshot | null,
): { evaluatorKey: string; dataAvailable: boolean; reasonCodes: string[] } => {
  const available = evaluatorKey === "REWARD_RISK_RATIO"
    || evaluatorKey === "SYMBOL_METADATA_SANITY"
    || evaluatorKey === "COMMODITY_CONTRACT_SANITY"
    || (evaluatorKey === "PRICE_BUFFER_CONTEXT" && runtime.priceBuffer.available)
    || (evaluatorKey === "CVD_CONTEXT" && runtime.cvd.available)
    || (evaluatorKey === "ORDER_BOOK_CONTEXT" && runtime.orderBook.available)
    || (evaluatorKey === "PRICE_VS_VWAP_CONTEXT" && marketSnapshot?.vwap.value !== undefined)
    || (evaluatorKey === "VWAP_DISTANCE_CONTEXT" && marketSnapshot?.vwap.distanceFromVwapPercent !== undefined)
    || (evaluatorKey === "LIQUIDITY_FRESHNESS_CONTEXT" && marketSnapshot !== null)
    || (evaluatorKey === "RVOL_CONTEXT" && marketSnapshot?.volume.relativeVolume !== undefined);
  return {
    evaluatorKey,
    dataAvailable: available,
    reasonCodes: available ? [] : [`${evaluatorKey}_DATA_UNAVAILABLE`],
  };
};

export class ScoringContextService {
  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public async getRealtimeContext(input: ScoringContextInput): Promise<Record<string, unknown>> {
    const symbolRecord = await this.resolveSymbol(input);
    const bufferLimit = Math.min(100, Math.max(1, Math.trunc(input.bufferLimit ?? 20)));
    const includeBuffers = input.includeBuffers === true;
    const streamKeys = this.buildStreamKeys(input.userId, symbolRecord);
    const runtimeProvider = await this.getRuntimeProvider();
    const runtime = runtimeProvider.getAnalyzerRuntimeSnapshot({
      streamKeys,
      includeBuffers,
      bufferLimit,
    });
    const resourceKey = this.buildResourceKey(input.userId, symbolRecord);
    const subscriptionKey = resourceKey;
    const marketSnapshot = this.getMarketSnapshotService().getSnapshot(resourceKey);
    const marketSnapshotSummary = this.getMarketSnapshotService().getDebugSnapshot(resourceKey);
    const templateResourceHealth = this.getTemplateOrchestrator().ensure(
      resourceKey,
      marketSnapshot,
    );
    const health = runtimeProvider
      .getTradeMonitoringHealthSnapshot()
      .find((entry) => entry.subscriptionKey === subscriptionKey);
    const subscription = runtimeProvider
      .getActiveTradeSubscriptionSnapshot()
      .find((entry) => entry.subscriptionKey === subscriptionKey);
    const template = input.templateKey
      ? this.getTemplateRegistry().get(input.templateKey, 1)
      : undefined;

    return {
      query: {
        ...(input.symbolId ? { symbolId: input.symbolId } : {}),
        symbol: symbolRecord.symbol,
        provider: symbolRecord.provider,
        exchange: symbolRecord.exchange,
        ...(input.templateKey ? { templateKey: input.templateKey } : {}),
        includeBuffers,
        bufferLimit,
      },
      symbol: {
        symbolId: String(symbolRecord._id),
        symbol: symbolRecord.symbol,
        displayName: symbolRecord.displayName ?? symbolRecord.symbol,
        provider: symbolRecord.provider,
        marketType: symbolRecord.marketType,
        exchange: symbolRecord.exchange,
        instrumentType: symbolRecord.instrumentType,
        providerSymbol: symbolRecord.providerSymbol,
        requiresBrokerLogin: symbolRecord.requiresBrokerLogin === true,
        status: symbolRecord.status,
      },
      runtime: {
        ...runtime,
        activeTradeMonitoring: {
          subscriptionKey,
          ...(health ?? {}),
          ...(subscription ?? {}),
          available: Boolean(health || subscription),
        },
      },
      marketSnapshot: marketSnapshotSummary ?? {
        resourceKey,
        freshness: { status: "MISSING" },
        vwap: { status: "UNAVAILABLE" },
        volume: { status: "UNAVAILABLE" },
        candleSummary: {},
        dataConfidence: "UNAVAILABLE",
      },
      ...(template ? {
        templateContext: {
          templateKey: template.key,
          templateVersion: template.version,
          sections: template.sections.map((section) => ({
            sectionKey: section.key,
            label: section.label,
            weight: section.weight,
            missingDataPolicy: section.missingDataPolicy,
            evaluators: section.evaluators.map((key) =>
              evaluatorAvailability(key, runtime, marketSnapshot)),
          })),
          resources: [{
            resourceKey,
            readiness: templateResourceHealth.lastSnapshotStatus,
            registeredAt: templateResourceHealth.registeredAt,
            lastTickAt: templateResourceHealth.lastTickAt,
            refCount: templateResourceHealth.refCount,
          }],
        },
      } : {}),
      warnings: runtime.priceBuffer.available ? [] : ["PRICE_BUFFER_UNAVAILABLE"],
    };
  }

  private async resolveSymbol(input: ScoringContextInput): Promise<Record<string, any>> {
    const filter: Record<string, unknown> = {};
    if (input.symbolId) {
      if (!isValidObjectId(input.symbolId)) throw new AppError("Invalid symbolId", 400);
      filter._id = new Types.ObjectId(input.symbolId);
    } else if (input.instrumentToken) {
      filter.instrumentToken = input.instrumentToken.trim();
    } else if (input.symbol) {
      filter.symbol = input.symbol.trim().toUpperCase();
    } else {
      throw new AppError("symbolId, symbol, or instrumentToken is required", 400);
    }
    if (input.provider) filter.provider = input.provider.trim().toUpperCase();
    if (input.exchange) filter.exchange = input.exchange.trim().toUpperCase();
    const symbol = await this.getSymbolRepository().findOne(filter, projection).lean().exec();
    if (!symbol) throw new AppError("SYMBOL_NOT_FOUND", 404);
    return symbol;
  }

  private buildStreamKeys(userId: string, symbol: Record<string, any>): string[] {
    const keys = [String(symbol.symbol).toUpperCase()];
    if (symbol.providerSymbol) keys.push(String(symbol.providerSymbol).toUpperCase());
    if (symbol.instrumentToken) keys.push(this.buildResourceKey(userId, symbol));
    return [...new Set(keys)];
  }

  private buildResourceKey(userId: string, symbol: Record<string, any>): string {
    return buildMarketSubscriptionKey({
      provider: String(symbol.provider),
      ...(symbol.provider === "ANGEL_ONE" ? { userId } : {}),
      exchange: String(symbol.exchange),
      instrumentToken: String(
        symbol.instrumentToken
        ?? symbol.providerSymbol
        ?? symbol.symbol,
      ).trim(),
    });
  }

  private getSymbolRepository(): SymbolRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }
  private async getRuntimeProvider(): Promise<RuntimeProvider> {
    if (this.dependencies.runtimeProvider) return this.dependencies.runtimeProvider;
    const { sharedWebsocketManager } = await import("./websocket.service.js");
    return sharedWebsocketManager;
  }
  private getTemplateRegistry(): ScoringTemplateRegistryService {
    return this.dependencies.templateRegistry ?? new ScoringTemplateRegistryService();
  }
  private getMarketSnapshotService(): Pick<
    MarketSnapshotService,
    "getSnapshot" | "getDebugSnapshot"
  > {
    return this.dependencies.marketSnapshotService ?? sharedMarketSnapshotService;
  }
  private getTemplateOrchestrator(): Pick<
    TemplateMonitoringOrchestratorService,
    "ensure" | "get"
  > {
    return this.dependencies.templateOrchestrator ?? sharedTemplateMonitoringOrchestrator;
  }
}
