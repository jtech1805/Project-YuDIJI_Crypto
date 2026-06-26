import { isValidObjectId, Types } from "mongoose";

import { AppError } from "../errors/AppError.js";
import { SymbolModel } from "../models/Symbol.js";
import type { AnalyzerRuntimeSnapshot } from "./analyzer.service.js";
import {
  buildMarketResourceKey,
  sharedMarketSnapshotService,
  type MarketSnapshotService,
} from "./market-snapshot.service.js";
import { ScoringTemplateRegistryService } from "./scoring-template-registry.service.js";
import {
  sharedTemplateMonitoringOrchestrator,
  type TemplateMonitoringOrchestratorService,
} from "./template-monitoring-orchestrator.service.js";
import {
  sharedTemplateResourceResolver,
  type IndiaEquityScoringResources,
  type TemplateResourceResolverService,
} from "./template-resource-resolver.service.js";
import type { MarketSnapshot } from "../types/market-snapshot.types.js";
import type {
  ScoringContextSymbolIds,
  ScoringSetupType,
  ScoringTemplateKey,
  ScoringUserLevels,
} from "../types/scoring.types.js";
import type { TradeDirection } from "../types/trade.types.js";
import type { ScoringEngineInput } from "./scoring-engine.service.js";
import { buildMarketSubscriptionKey } from "../utils/market-subscription-key.js";

type QueryExec<T> = { exec: () => Promise<T> };
type LeanQueryExec<T> = { lean: () => QueryExec<T> };
type SymbolRepository = {
  findOne: (
    filter: Record<string, unknown>,
    projection?: Record<string, 0 | 1>,
  ) => LeanQueryExec<Record<string, any> | null>;
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
  templateResourceResolver: Pick<TemplateResourceResolverService, "resolveIndiaEquityResources">;
};

export type ScoringContextBuildInput = {
  userId: string;
  symbolId?: string;
  symbol?: string;
  provider?: string;
  exchange?: string;
  instrumentToken?: string;
  templateKey?: ScoringTemplateKey;
  contextSymbolIds?: ScoringContextSymbolIds;
  includeBuffers?: boolean;
  bufferLimit?: number;
  scoring?: {
    scoringTemplateKey: ScoringTemplateKey;
    scoringTemplateVersion: string;
    marketType: ScoringEngineInput["marketType"];
    tradeStyle: string;
    instrumentType: ScoringEngineInput["instrumentType"];
    rewardRiskRatio: number;
    dataConfidence?: ScoringEngineInput["dataConfidence"];
    direction: TradeDirection;
    entry: number;
    stopLoss: number;
    target1: number;
    target2?: number;
    setupType?: ScoringSetupType;
    userLevels?: ScoringUserLevels;
    evaluatedAt?: Date;
  };
};

export type BuiltScoringContext = {
  symbolRecord: Record<string, any>;
  resourceKey: string;
  runtime: AnalyzerRuntimeSnapshot;
  marketSnapshot: MarketSnapshot | null;
  marketSnapshotSummary: Record<string, unknown> | null;
  templateResources: IndiaEquityScoringResources | null;
  evaluatorInput?: ScoringEngineInput;
  snapshotRefs: Record<string, string>;
  runtimeSnapshotSummary: Record<string, unknown>;
  response: Record<string, unknown>;
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

const missingMarketSummary = (resourceKey: string): Record<string, unknown> => ({
  resourceKey,
  freshness: { status: "MISSING" },
  vwap: { status: "UNAVAILABLE" },
  volume: { status: "UNAVAILABLE" },
  candleSummary: {},
  dataConfidence: "UNAVAILABLE",
});

const snapshotFreshnessWarning = (snapshot: MarketSnapshot | null): string[] => {
  if (!snapshot) return ["MARKET_SNAPSHOT_MISSING", "TEMPLATE_RESOURCE_SUBSCRIPTION_INTEGRATION_PENDING"];
  if (snapshot.freshness.status === "STALE") return ["MARKET_SNAPSHOT_STALE"];
  return [];
};

export class ScoringContextBuilderService {
  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public async build(input: ScoringContextBuildInput): Promise<BuiltScoringContext> {
    const symbolRecord = await this.resolveSymbol(input);
    const includeBuffers = input.includeBuffers === true;
    const bufferLimit = Math.min(100, Math.max(1, Math.trunc(input.bufferLimit ?? 20)));
    const streamKeys = this.buildStreamKeys(input.userId, symbolRecord);
    const runtimeProvider = await this.getRuntimeProvider();
    const runtime = runtimeProvider.getAnalyzerRuntimeSnapshot({
      streamKeys,
      includeBuffers,
      bufferLimit,
    });
    const resourceKey = this.buildResourceKey(input.userId, symbolRecord);
    const marketSnapshot = this.getMarketSnapshotService().getSnapshot(resourceKey);
    const marketSnapshotSummary = this.getMarketSnapshotService().getDebugSnapshot(resourceKey);
    const templateHealth = this.getTemplateOrchestrator().ensure(resourceKey, marketSnapshot);
    const health = runtimeProvider
      .getTradeMonitoringHealthSnapshot()
      .find((entry) => entry.subscriptionKey === resourceKey);
    const subscription = runtimeProvider
      .getActiveTradeSubscriptionSnapshot()
      .find((entry) => entry.subscriptionKey === resourceKey);
    const templateKey = input.templateKey ?? input.scoring?.scoringTemplateKey;
    const template = templateKey ? this.getTemplateRegistry().get(templateKey, 1) : undefined;
    const templateResources = templateKey === "INDIA_EQUITY_INTRADAY_V1"
      ? await this.getTemplateResourceResolver().resolveIndiaEquityResources({
        userId: input.userId,
        ...(input.contextSymbolIds ? { contextSymbolIds: input.contextSymbolIds } : {}),
      })
      : null;
    const additionalHealth = templateResources
      ? [templateResources.index, templateResources.sector, templateResources.vix]
        .filter((resource) => resource.resourceKey)
        .map((resource) => this.getTemplateOrchestrator().ensure(resource.resourceKey!, resource.snapshot))
      : [];
    const warnings = [
      ...(runtime.priceBuffer.available ? [] : ["PRICE_BUFFER_UNAVAILABLE"]),
      ...snapshotFreshnessWarning(marketSnapshot),
    ];
    const runtimeSnapshotSummary = this.buildRuntimeSummary(runtime, resourceKey, health, subscription);
    const evaluatorInput = input.scoring
      ? this.buildEvaluatorInput(input.scoring, symbolRecord, runtime, marketSnapshot, templateResources)
      : undefined;
    const snapshotRefs = {
      marketSnapshotId: resourceKey,
      ...(templateResources?.index.resourceKey ? { indexSnapshotId: templateResources.index.resourceKey } : {}),
      ...(templateResources?.sector.resourceKey ? { sectorSnapshotId: templateResources.sector.resourceKey } : {}),
      ...(templateResources?.vix.resourceKey ? { vixSnapshotId: templateResources.vix.resourceKey } : {}),
    };

    return {
      symbolRecord,
      resourceKey,
      runtime,
      marketSnapshot,
      marketSnapshotSummary,
      templateResources,
      ...(evaluatorInput ? { evaluatorInput } : {}),
      snapshotRefs,
      runtimeSnapshotSummary,
      response: {
        query: {
          ...(input.symbolId ? { symbolId: input.symbolId } : {}),
          symbol: symbolRecord.symbol,
          provider: symbolRecord.provider,
          exchange: symbolRecord.exchange,
          ...(templateKey ? { templateKey } : {}),
          includeBuffers,
          bufferLimit,
        },
        symbol: this.buildSymbolResponse(symbolRecord),
        runtime: runtimeSnapshotSummary,
        marketSnapshot: marketSnapshotSummary ?? missingMarketSummary(resourceKey),
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
                this.evaluatorAvailability(key, runtime, marketSnapshot, templateResources)),
            })),
            resources: [templateHealth, ...additionalHealth].map((resource) => ({
              resourceKey: resource.resourceKey,
              readiness: resource.lastSnapshotStatus,
              registeredAt: resource.registeredAt,
              lastTickAt: resource.lastTickAt,
              refCount: resource.refCount,
            })),
          },
        } : {}),
        warnings,
      },
    };
  }

  private buildEvaluatorInput(
    scoring: NonNullable<ScoringContextBuildInput["scoring"]>,
    symbol: Record<string, any>,
    runtime: AnalyzerRuntimeSnapshot,
    marketSnapshot: MarketSnapshot | null,
    templateResources: IndiaEquityScoringResources | null,
  ): ScoringEngineInput {
    return {
      scoringTemplateKey: scoring.scoringTemplateKey,
      scoringTemplateVersion: scoring.scoringTemplateVersion,
      marketType: scoring.marketType,
      tradeStyle: scoring.tradeStyle,
      instrumentType: scoring.instrumentType,
      rewardRiskRatio: scoring.rewardRiskRatio,
      ...(scoring.dataConfidence ? { dataConfidence: scoring.dataConfidence } : {}),
      ...(scoring.evaluatedAt ? { evaluatedAt: scoring.evaluatedAt } : {}),
      direction: scoring.direction,
      entry: scoring.entry,
      stopLoss: scoring.stopLoss,
      target1: scoring.target1,
      ...(scoring.target2 !== undefined ? { target2: scoring.target2 } : {}),
      ...(scoring.setupType ? { setupType: scoring.setupType } : {}),
      ...(scoring.userLevels ? { userLevels: scoring.userLevels } : {}),
      symbol: {
        status: symbol.status,
        marketType: symbol.marketType,
        exchange: symbol.exchange,
        instrumentType: symbol.instrumentType,
        ...(symbol.lotSize !== undefined ? { lotSize: symbol.lotSize } : {}),
        ...(symbol.tickSize !== undefined ? { tickSize: symbol.tickSize } : {}),
        ...(symbol.expiry ? { expiry: symbol.expiry } : {}),
        ...(typeof symbol.requiresBrokerLogin === "boolean"
          ? { requiresBrokerLogin: symbol.requiresBrokerLogin }
          : {}),
      },
      runtime: {
        priceBufferAvailable: runtime.priceBuffer.available,
        currentCvdAvailable: runtime.cvd.available,
        orderBookAvailable: runtime.orderBook.available,
        priceBuffer: {
          available: runtime.priceBuffer.available,
          count: runtime.priceBuffer.count,
          ...(runtime.priceBuffer.changePercent !== undefined
            ? { changePercent: runtime.priceBuffer.changePercent }
            : {}),
        },
        cvd: {
          available: runtime.cvd.available,
          bufferCount: runtime.cvd.bufferCount,
          ...(runtime.cvd.currentCVD !== undefined ? { currentCVD: runtime.cvd.currentCVD } : {}),
          ...(runtime.cvd.netDelta !== undefined ? { netDelta: runtime.cvd.netDelta } : {}),
        },
        orderBook: {
          available: runtime.orderBook.available,
          bidLevels: runtime.orderBook.bidLevels,
          askLevels: runtime.orderBook.askLevels,
          ...(runtime.orderBook.bestBid !== undefined ? { bestBid: runtime.orderBook.bestBid } : {}),
          ...(runtime.orderBook.bestAsk !== undefined ? { bestAsk: runtime.orderBook.bestAsk } : {}),
        },
      },
      marketSnapshot,
      ...(templateResources ? {
        indexSnapshot: templateResources.index.snapshot,
        sectorSnapshot: templateResources.sector.snapshot,
        vixSnapshot: templateResources.vix.snapshot,
      } : {}),
    };
  }

  private evaluatorAvailability(
    evaluatorKey: string,
    runtime: AnalyzerRuntimeSnapshot,
    marketSnapshot: MarketSnapshot | null,
    resources: IndiaEquityScoringResources | null,
  ): Record<string, unknown> {
    const freshness = marketSnapshot?.freshness.status;
    const marketFresh = freshness === "FRESH";
    const staleReason = freshness === "STALE" ? "MARKET_SNAPSHOT_STALE" : undefined;
    const runtimeReady = (evaluatorKey === "PRICE_BUFFER_CONTEXT" && runtime.priceBuffer.available)
      || (evaluatorKey === "CVD_CONTEXT" && runtime.cvd.available)
      || (evaluatorKey === "ORDER_BOOK_CONTEXT" && runtime.orderBook.available);
    const deterministicReady = [
      "REWARD_RISK_RATIO",
      "DIRECTION_GEOMETRY",
      "TRADE_MANAGEMENT_LEVELS",
      "SYMBOL_METADATA_SANITY",
      "COMMODITY_CONTRACT_SANITY",
    ].includes(evaluatorKey);
    const marketReady = this.isMarketEvaluatorReady(evaluatorKey, marketSnapshot, resources);
    const ready = deterministicReady || runtimeReady || marketReady;
    const status = ready && (!runtimeReady || marketFresh || !marketSnapshot)
      ? "READY"
      : ready
        ? "PARTIAL"
        : this.isPartialEvaluator(evaluatorKey, marketSnapshot)
          ? "PARTIAL"
          : "MISSING";
    const related = this.relatedResources(evaluatorKey, marketSnapshot, resources);
    const reasonCodes = status === "READY" ? [] : [
      staleReason ?? `${evaluatorKey}_DATA_UNAVAILABLE`,
    ];
    return {
      evaluatorKey,
      status,
      dataAvailable: ready,
      resourceKeys: related
        .map((resource) => resource?.resourceKey)
        .filter((value): value is string => Boolean(value)),
      snapshotFreshness: related
        .map((resource) => resource?.snapshot?.freshness.status)
        .filter((value): value is "FRESH" | "STALE" | "MISSING" => value !== undefined),
      reasonCodes,
      warnings: status === "READY" ? [] : [
        staleReason ?? `${evaluatorKey} requires additional realtime or user context.`,
      ],
    };
  }

  private isMarketEvaluatorReady(
    evaluatorKey: string,
    marketSnapshot: MarketSnapshot | null,
    resources: IndiaEquityScoringResources | null,
  ): boolean {
    const primaryCandleReady = Boolean(
      marketSnapshot?.candles["5m"].length && marketSnapshot?.candles["15m"].length,
    );
    const indexCandleReady = Boolean(
      resources?.index.snapshot?.candles["5m"].length && resources.index.snapshot.candles["15m"].length,
    );
    const sectorCandleReady = Boolean(
      resources?.sector.snapshot?.candles["5m"].length && resources.sector.snapshot.candles["15m"].length,
    );
    return (evaluatorKey === "PRICE_VS_VWAP_CONTEXT" && marketSnapshot?.vwap.value !== undefined)
      || (evaluatorKey === "VWAP_DISTANCE_CONTEXT" && marketSnapshot?.vwap.distanceFromVwapPercent !== undefined)
      || (evaluatorKey === "LIQUIDITY_FRESHNESS_CONTEXT" && marketSnapshot !== null)
      || (evaluatorKey === "RVOL_CONTEXT" && marketSnapshot?.volume.relativeVolume !== undefined)
      || (["VOLUME_EXPANSION_CONTEXT", "CANDLE_VOLUME_CONTEXT", "VOLUME_DRY_UP_CONTEXT"]
        .includes(evaluatorKey) && (marketSnapshot?.candles["1m"].length ?? 0) >= 2)
      || (["STOCK_INTRADAY_STRUCTURE", "CANDLE_CONFIRMATION_CONTEXT"]
        .includes(evaluatorKey) && primaryCandleReady)
      || (evaluatorKey === "SPREAD_DEPTH_CONTEXT" && marketSnapshot?.spreadPercent !== undefined)
      || (evaluatorKey === "VWAP_RECLAIM_HOLD_CONTEXT"
        && marketSnapshot?.vwap.value !== undefined
        && (marketSnapshot.candles["5m"].length ?? 0) >= 2)
      || (evaluatorKey === "INDEX_VWAP_TREND_ALIGNMENT"
        && resources?.index.snapshot?.vwap.value !== undefined)
      || (["INDEX_MULTI_TIMEFRAME_STRUCTURE", "MARKET_CHOPPINESS_CONTEXT"]
        .includes(evaluatorKey) && indexCandleReady)
      || (evaluatorKey === "VIX_STABILITY_CONTEXT"
        && resources?.vix.snapshot?.changePercent !== undefined)
      || (["SECTOR_RELATIVE_STRENGTH", "SECTOR_VWAP_CONTEXT"]
        .includes(evaluatorKey) && resources?.sector.snapshot !== null && resources?.index.snapshot !== null)
      || (evaluatorKey === "SECTOR_TREND_CONTEXT" && sectorCandleReady)
      || (evaluatorKey === "STOCK_VS_SECTOR_RS"
        && marketSnapshot?.changePercent !== undefined
        && resources?.sector.snapshot?.changePercent !== undefined)
      || (evaluatorKey === "STOCK_VS_INDEX_RS"
        && marketSnapshot?.changePercent !== undefined
        && resources?.index.snapshot?.changePercent !== undefined);
  }

  private isPartialEvaluator(evaluatorKey: string, marketSnapshot: MarketSnapshot | null): boolean {
    return [
      "SETUP_TYPE_CONTEXT",
      "ENTRY_LEVEL_CONTEXT",
      "STOPLOSS_STRUCTURE_CONTEXT",
      "STOCK_KEY_LEVEL_CONTEXT",
      "NEARBY_LEVEL_BLOCK_CONTEXT",
      "MARKET_BREADTH_CONTEXT",
      "SECTOR_BREADTH_CONTEXT",
      "VIX_STABILITY_CONTEXT",
    ].includes(evaluatorKey)
      || evaluatorKey.startsWith("SECTOR_")
      || marketSnapshot !== null;
  }

  private relatedResources(
    evaluatorKey: string,
    marketSnapshot: MarketSnapshot | null,
    resources: IndiaEquityScoringResources | null,
  ): Array<{ resourceKey?: string; snapshot: MarketSnapshot | null } | undefined> {
    if (evaluatorKey.startsWith("INDEX_") || evaluatorKey === "MARKET_CHOPPINESS_CONTEXT") {
      return [resources?.index];
    }
    if (evaluatorKey.startsWith("SECTOR_") || evaluatorKey === "STOCK_VS_SECTOR_RS") {
      return [resources?.sector, resources?.index];
    }
    if (evaluatorKey === "VIX_STABILITY_CONTEXT") {
      return [resources?.vix];
    }
    return [{
      ...(marketSnapshot?.resourceKey ? { resourceKey: marketSnapshot.resourceKey } : {}),
      snapshot: marketSnapshot,
    }];
  }

  private buildRuntimeSummary(
    runtime: AnalyzerRuntimeSnapshot,
    subscriptionKey: string,
    health?: Record<string, unknown>,
    subscription?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...runtime,
      activeTradeMonitoring: {
        subscriptionKey,
        ...(health ?? {}),
        ...(subscription ?? {}),
        available: Boolean(health || subscription),
      },
    };
  }

  private buildSymbolResponse(symbol: Record<string, any>): Record<string, unknown> {
    return {
      symbolId: String(symbol._id),
      symbol: symbol.symbol,
      displayName: symbol.displayName ?? symbol.symbol,
      provider: symbol.provider,
      marketType: symbol.marketType,
      exchange: symbol.exchange,
      instrumentType: symbol.instrumentType,
      providerSymbol: symbol.providerSymbol,
      requiresBrokerLogin: symbol.requiresBrokerLogin === true,
      status: symbol.status,
    };
  }

  private async resolveSymbol(input: ScoringContextBuildInput): Promise<Record<string, any>> {
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
    if (symbol.provider === "ANGEL_ONE") {
      return buildMarketSubscriptionKey({
        provider: "ANGEL_ONE",
        userId,
        exchange: String(symbol.exchange),
        instrumentToken: String(symbol.instrumentToken ?? symbol.providerSymbol ?? symbol.symbol).trim(),
      });
    }
    return buildMarketResourceKey({
      provider: String(symbol.provider),
      exchange: String(symbol.exchange),
      ...(symbol.instrumentToken ? { instrumentToken: String(symbol.instrumentToken) } : {}),
      ...(symbol.providerSymbol ? { providerSymbol: String(symbol.providerSymbol) } : {}),
      symbol: String(symbol.symbol),
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
  private getMarketSnapshotService(): Pick<MarketSnapshotService, "getSnapshot" | "getDebugSnapshot"> {
    return this.dependencies.marketSnapshotService ?? sharedMarketSnapshotService;
  }
  private getTemplateOrchestrator(): Pick<TemplateMonitoringOrchestratorService, "ensure" | "get"> {
    return this.dependencies.templateOrchestrator ?? sharedTemplateMonitoringOrchestrator;
  }
  private getTemplateResourceResolver(): Pick<
    TemplateResourceResolverService,
    "resolveIndiaEquityResources"
  > {
    return this.dependencies.templateResourceResolver ?? sharedTemplateResourceResolver;
  }
}
