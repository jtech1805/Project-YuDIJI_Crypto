import type { IncomingMessage } from "node:http";
import type { Server as HttpServer } from "node:http";

import pino from "pino";
import { z } from "zod";
import WebSocket, { WebSocketServer } from "ws";

import { AppError } from "../../errors/AppError.js";
import { AnalyzerEngine } from "./analyzer.service.js";
import { ActiveTradeLiveMonitorService } from "./active-trade-live-monitor.service.js";
import { sharedTradeMonitoringHealthService } from "./trade-monitoring-health.service.js";
import {
  sharedActiveTradeSubscriptionService,
  type ActiveTradeStreamSubscription,
} from "./active-trade-subscription.service.js";
import { AngelUserMarketDataSessionService } from "../market-data/angel-user-market-data-session.service.js";
import { MarketSubscriptionResolver, type ResolvedMarketSubscription } from "../market-data/market-subscription-resolver.service.js";
import { MarketSubscriptionRouter } from "../market-data/market-subscription-router.service.js";
import { parseCookieHeader } from "../../utils/cookieUtils.js";
import { verifyAccessToken } from "../../utils/jwt.js";
import { buildMarketSubscriptionKey } from "../../utils/market-subscription-key.js";
import type { NormalizedMarketTick } from "../../types/market-data.types.js";
import { sharedMarketSnapshotService } from "../market-data/market-snapshot.service.js";
import { sharedTemplateMonitoringOrchestrator } from "../templates/template-monitoring-orchestrator.service.js";

interface BinanceTickerMessage {
  s: string;
  c: string;
  x: string;
  P: string;
  E: number;
  m: boolean;
  q: string;
  v?: string;
  o?: string;
  h?: string;
  l?: string;
}

interface OutboundTickerPayload {
  type: "TICKER_UPDATE";
  symbol: string;
  currentPrice: string;
  previousClose: string;
  priceChangePercent: string;
}

interface OutboundAckPayload {
  type: "SUBSCRIPTION_ACK";
  subscriptions: string[];
}

interface OutboundSubscriptionUpdateResultPayload {
  type: "SUBSCRIPTION_UPDATE_RESULT";
  data: {
    subscribed: Array<{
      symbol: string;
      displayName?: string;
      provider: string;
      subscriptionKey: string;
    }>;
    unsubscribed: Array<{
      symbol: string;
      displayName?: string;
      provider: string;
      subscriptionKey: string;
    }>;
    failed: Array<{
      symbol: string;
      reason: string;
      message: string;
    }>;
  };
}

interface OutboundMarketTickPayload {
  type: "MARKET_TICK";
  provider: string;
  marketType: string;
  exchange: string;
  symbol: string;
  displayName?: string;
  instrumentToken: string;
  providerSymbol?: string;
  price: number;
  currentPrice: string;
  previousClose: string;
  priceChangePercent: string;
  timestamp: number;
}

interface OutboundErrorPayload {
  type: "ERROR";
  message: string;
}

interface OutboundAlertPayload {
  type: "NEW_ALERT";
  payload: unknown;
}
interface OutboundTradeEventPayload {
  type: "TRADE_EVENT_CREATED";
  payload: unknown;
}

type UserScopedOutboundPayload = OutboundAlertPayload | OutboundTradeEventPayload;
export interface BinanceDepthMessage {
  lastUpdateId: number;
  bids: string[][];
  asks: string[][];
}
const subscriptionMessageSchema = z.object({
  action: z.literal("UPDATE_SUBSCRIPTIONS"),
  subscribe: z.array(z.string()).default([]),
  unsubscribe: z.array(z.string()).default([]),
});

type SubscriptionMessage = z.infer<typeof subscriptionMessageSchema>;

const logger = pino({ name: "websocket-manager" });

export class WebSocketManager {
  private readonly wsServer: WebSocketServer;
  private readonly analyzerEngine: AnalyzerEngine;
  private readonly activeTradeLiveMonitorService: ActiveTradeLiveMonitorService;
  private readonly subscriptionResolver: MarketSubscriptionResolver;
  private readonly subscriptionRouter: MarketSubscriptionRouter;
  private binanceSocket: WebSocket | null;
  private reconnectTimer: NodeJS.Timeout | null;
  private readonly reconnectDelayMs: number;
  private readonly binanceUrl: string;
  private readonly activeBinanceSymbols: Set<string>;
  private readonly authenticatedRequestUsers: WeakMap<IncomingMessage, string>;

  private readonly clientUsers: Map<WebSocket, string>;
  private readonly userSockets: Map<string, Set<WebSocket>>;

  public readonly clientSubscriptions: Map<WebSocket, Set<string>>;
  public readonly globalSymbolCounts: Map<string, number>;
  public readonly globalSubscriptionCounts: Map<string, number>;
  private readonly subscriptionMetadata: Map<string, ResolvedMarketSubscription>;
  private readonly previousMarketTickPrices: Map<string, number>;

  public constructor() {
    this.wsServer = new WebSocketServer({ noServer: true });
    this.binanceSocket = null;
    this.reconnectTimer = null;
    this.reconnectDelayMs = 3000;
    // this.binanceUrl = "wss://stream.binance.com:9443/ws";
    this.binanceUrl = "wss://stream.binance.com:9443/stream";
    this.activeBinanceSymbols = new Set<string>();
    this.authenticatedRequestUsers = new WeakMap<IncomingMessage, string>();

    this.clientUsers = new Map<WebSocket, string>();
    this.userSockets = new Map<string, Set<WebSocket>>();
    this.clientSubscriptions = new Map<WebSocket, Set<string>>();
    this.globalSymbolCounts = new Map<string, number>();
    this.globalSubscriptionCounts = new Map<string, number>();
    this.subscriptionMetadata = new Map<string, ResolvedMarketSubscription>();
    this.previousMarketTickPrices = new Map<string, number>();
    const angelSessionService = new AngelUserMarketDataSessionService({
      onTick: (tick): void => this.handleAngelMarketTick(tick),
    });
    this.subscriptionResolver = new MarketSubscriptionResolver();
    this.subscriptionRouter = new MarketSubscriptionRouter({
      angelSessionService,
    });
    sharedActiveTradeSubscriptionService.configureStreamOrchestrator({
      subscribe: (userId, subscription) => this.subscribeActiveTradeStream(userId, subscription),
      unsubscribe: (userId, subscription) => this.unsubscribeActiveTradeStream(userId, subscription),
    });
    this.analyzerEngine = new AnalyzerEngine((userId, payload): void => {
      this.emitToUser(userId, payload);
    });
    this.activeTradeLiveMonitorService = new ActiveTradeLiveMonitorService();
  }

  public initialize(server: HttpServer): void {
    logger.info({ event: "WS_MANAGER_INIT" }, "Initializing websocket manager");
    server.on("upgrade", (request: IncomingMessage, socket, head): void => {
      try {
        const userId = this.authenticateUpgradeRequest(request);
        this.authenticatedRequestUsers.set(request, userId);
        logger.info(
          {
            event: "WS_UPGRADE_AUTH_SUCCESS",
            userId,
            remoteAddress: request.socket.remoteAddress,
          },
          "Websocket upgrade authenticated",
        );
      } catch (error: unknown) {
        logger.warn({ error }, "Rejected websocket upgrade due to failed authentication");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.wsServer.handleUpgrade(request, socket, head, (ws: WebSocket): void => {
        this.wsServer.emit("connection", ws, request);
      });
    });

    this.wsServer.on("connection", (ws: WebSocket, req: IncomingMessage): void => {
      const userId = this.authenticatedRequestUsers.get(req);
      this.authenticatedRequestUsers.delete(req);
      if (!userId) {
        ws.close(1008, "Unauthenticated");
        return;
      }

      this.handleClientConnection(ws, req, userId);
    });

    this.connectBinanceMaster();
  }

  public handleClientConnection(ws: WebSocket, _req: IncomingMessage, userId: string): void {
    this.clientSubscriptions.set(ws, new Set<string>());
    this.clientUsers.set(ws, userId);

    const sockets = this.userSockets.get(userId) ?? new Set<WebSocket>();
    sockets.add(ws);
    this.userSockets.set(userId, sockets);
    logger.info(
      {
        event: "WS_CLIENT_CONNECTED",
        userId,
        userSocketCount: sockets.size,
        totalConnectedUsers: this.userSockets.size,
      },
      "Websocket client connected",
    );

    ws.on("message", (rawMessage: WebSocket.RawData): void => {
      void this.handleClientMessage(ws, rawMessage);
    });

    ws.on("close", (): void => {
      void this.cleanupClientSubscriptions(ws);
    });

    ws.on("error", (): void => {
      void this.cleanupClientSubscriptions(ws);
    });
  }

  public emitToUser(userId: string, payload: UserScopedOutboundPayload): number {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      logger.warn(
        {
          event: "WS_ALERT_EMIT_SKIPPED",
          userId,
          reason: "NO_ACTIVE_SOCKETS",
        },
        "Alert emission skipped because user has no active sockets",
      );
      return 0;
    }

    logger.warn(
      {
        event: "WS_ALERT_EMIT_START",
        userId,
        socketCount: sockets.size,
        payloadType: payload.type,
      },
      "Emitting alert payload to user sockets",
    );
    let deliveredSocketCount = 0;
    for (const socket of sockets) {
      if (this.sendToClient(socket, payload)) {
        deliveredSocketCount += 1;
      }
    }
    return deliveredSocketCount;
  }

  public async handleClientMessage(ws: WebSocket, message: WebSocket.RawData): Promise<void> {
    const parsed = this.parseClientMessage(message);
    if (!parsed) {
      this.sendToClient(ws, { type: "ERROR", message: "Invalid websocket payload" });
      return;
    }

    const subscriptions = this.clientSubscriptions.get(ws);
    logger.info(
      {
        event: "WS_SUBSCRIPTION_UPDATE_REQUEST",
        userId: this.clientUsers.get(ws) ?? null,
        subscribe: parsed.subscribe.map((item): string => this.normalizeSymbol(item)),
        unsubscribe: parsed.unsubscribe.map((item): string => this.normalizeSymbol(item)),
      },
      "Received websocket subscription update payload",
    );

    if (!subscriptions) {
      this.sendToClient(ws, { type: "ERROR", message: "Socket not initialized" });
      return;
    }

    const userId = this.clientUsers.get(ws);
    if (!userId) {
      this.sendToClient(ws, { type: "ERROR", message: "Socket not authenticated" });
      return;
    }

    const result: OutboundSubscriptionUpdateResultPayload["data"] = {
      subscribed: [],
      unsubscribed: [],
      failed: [],
    };

    for (const rawSymbol of parsed.unsubscribe) {
      const symbol = this.normalizeSymbol(rawSymbol);
      const existingSubscription = this.findClientSubscriptionBySymbol(ws, symbol);
      if (!existingSubscription) {
        continue;
      }

      subscriptions.delete(existingSubscription.subscriptionKey);
      const shouldRouteUnsubscribe = this.decrementGlobalCount(existingSubscription.subscriptionKey);
      if (shouldRouteUnsubscribe) {
        try {
          await this.subscriptionRouter.unsubscribe(userId, existingSubscription);
        } catch (error: unknown) {
          result.failed.push({
            symbol,
            reason: this.errorReason(error),
            message: "UNSUBSCRIPTION_FAILED",
          });
          continue;
        }
      }
      result.unsubscribed.push(this.toSubscriptionResult(existingSubscription));
    }

    const resolvedSubscribeRequests: ResolvedMarketSubscription[] = [];
    for (const rawSymbol of parsed.subscribe) {
      const symbol = this.normalizeSymbol(rawSymbol);
      let resolvedSubscription: ResolvedMarketSubscription;
      try {
        resolvedSubscription = await this.subscriptionResolver.resolveSubscription(userId, symbol);
      } catch (error: unknown) {
        result.failed.push({
          symbol,
          reason: this.errorReason(error),
          message: this.safeSubscriptionFailureMessage(error),
        });
        continue;
      }

      if (subscriptions.has(resolvedSubscription.subscriptionKey)) {
        continue;
      }

      resolvedSubscribeRequests.push(resolvedSubscription);
    }

    const sortedSubscribeRequests = resolvedSubscribeRequests.sort(
      (left, right): number => {
        if (left.provider === right.provider) {
          return 0;
        }
        return left.provider === "BINANCE" ? -1 : 1;
      },
    );

    for (const resolvedSubscription of sortedSubscribeRequests) {
      if (subscriptions.has(resolvedSubscription.subscriptionKey)) {
        continue;
      }

      const shouldRouteSubscribe = this.incrementGlobalCount(resolvedSubscription.subscriptionKey);
      try {
        if (shouldRouteSubscribe) {
          await this.subscriptionRouter.subscribe(userId, resolvedSubscription);
        }
      } catch (error: unknown) {
        this.decrementGlobalCount(resolvedSubscription.subscriptionKey);
        result.failed.push({
          symbol: resolvedSubscription.symbol,
          reason: this.errorReason(error),
          message: "SUBSCRIPTION_FAILED",
        });
        continue;
      }

      subscriptions.add(resolvedSubscription.subscriptionKey);
      this.subscriptionMetadata.set(resolvedSubscription.subscriptionKey, resolvedSubscription);
      result.subscribed.push(this.toSubscriptionResult(resolvedSubscription));

      if (resolvedSubscription.provider === "BINANCE") {
        this.updateBinanceSubscriptions();
      }
    }

    this.updateBinanceSubscriptions();
    logger.info(
      {
        event: "WS_SUBSCRIPTION_UPDATE_APPLIED",
        userId: this.clientUsers.get(ws) ?? null,
        userSubscriptions: Array.from(subscriptions),
        globalSubscriptionCounts: Object.fromEntries(this.globalSubscriptionCounts),
      },
      "Applied subscription update",
    );
    this.sendToClient(ws, {
      type: "SUBSCRIPTION_UPDATE_RESULT",
      data: result,
    });
    this.sendToClient(ws, {
      type: "SUBSCRIPTION_ACK",
      subscriptions: Array.from(subscriptions)
        .map((subscriptionKey): string => this.subscriptionMetadata.get(subscriptionKey)?.symbol ?? subscriptionKey)
        .sort((a, b): number => a.localeCompare(b)),
    });
  }

  public updateBinanceSubscriptions(): void {
    if (!this.binanceSocket || this.binanceSocket.readyState !== WebSocket.OPEN) {
      logger.info(
        {
          event: "WS_BINANCE_SUBSCRIPTION_DEFERRED",
          reason: "MASTER_SOCKET_NOT_READY",
          pendingGlobalCounts: Object.fromEntries(this.globalSubscriptionCounts),
        },
        "Skipped Binance subscription sync; socket not open",
      );
      return;
    }

    const desiredSymbols = new Set<string>(
      Array.from(this.globalSubscriptionCounts.entries())
        .filter((entry): boolean => entry[1] > 0)
        .map((entry): ResolvedMarketSubscription | undefined => this.subscriptionMetadata.get(entry[0]))
        .filter((subscription): subscription is ResolvedMarketSubscription => {
          return subscription?.provider === "BINANCE";
        })
        .map((subscription): string => subscription.instrumentToken),
    );

    const symbolsToSubscribe = Array.from(desiredSymbols).filter(
      (symbol): boolean => !this.activeBinanceSymbols.has(symbol),
    );
    const symbolsToUnsubscribe = Array.from(this.activeBinanceSymbols).filter(
      (symbol): boolean => !desiredSymbols.has(symbol),
    );

    if (symbolsToSubscribe.length > 0) {
      logger.info(
        {
          event: "WS_BINANCE_SUBSCRIBE",
          symbolsToSubscribe,
        },
        "Subscribing symbols on Binance master socket",
      );
      this.sendBinanceControlMessage("SUBSCRIBE", symbolsToSubscribe);
      for (const symbol of symbolsToSubscribe) {
        this.activeBinanceSymbols.add(symbol);
      }
    }

    if (symbolsToUnsubscribe.length > 0) {
      logger.info(
        {
          event: "WS_BINANCE_UNSUBSCRIBE",
          symbolsToUnsubscribe,
        },
        "Unsubscribing symbols on Binance master socket",
      );
      this.sendBinanceControlMessage("UNSUBSCRIBE", symbolsToUnsubscribe);
      for (const symbol of symbolsToUnsubscribe) {
        this.activeBinanceSymbols.delete(symbol);
      }
    }
  }

  public async subscribeActiveTradeStream(
    userId: string,
    subscription: ActiveTradeStreamSubscription,
  ): Promise<void> {
    const shouldRouteSubscribe = this.incrementGlobalCount(subscription.subscriptionKey);
    this.subscriptionMetadata.set(subscription.subscriptionKey, subscription);
    try {
      if (shouldRouteSubscribe) {
        await this.subscriptionRouter.subscribe(userId, subscription);
      }
      if (subscription.provider === "BINANCE") this.updateBinanceSubscriptions();
    } catch (error: unknown) {
      this.decrementGlobalCount(subscription.subscriptionKey);
      throw error;
    }
  }

  public async unsubscribeActiveTradeStream(
    userId: string,
    subscription: ActiveTradeStreamSubscription,
  ): Promise<void> {
    const shouldRouteUnsubscribe = this.decrementGlobalCount(subscription.subscriptionKey);
    if (shouldRouteUnsubscribe) {
      await this.subscriptionRouter.unsubscribe(userId, subscription);
    }
    if (subscription.provider === "BINANCE") this.updateBinanceSubscriptions();
  }

  private authenticateUpgradeRequest(request: IncomingMessage): string {
    const cookies = parseCookieHeader(request.headers.cookie);
    const accessToken = cookies.accessToken;

    if (!accessToken) {
      throw new AppError("Missing access token cookie", 401);
    }

    const payload = verifyAccessToken(accessToken);
    return payload.sub;
  }

  private parseClientMessage(rawData: WebSocket.RawData): SubscriptionMessage | null {
    try {
      const rawString = rawData.toString();
      const rawJson = JSON.parse(rawString) as unknown;
      const parsed = subscriptionMessageSchema.safeParse(rawJson);
      if (!parsed.success) {
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private incrementGlobalCount(subscriptionKey: string): boolean {
    const currentCount = this.globalSubscriptionCounts.get(subscriptionKey) ?? 0;
    this.globalSubscriptionCounts.set(subscriptionKey, currentCount + 1);
    return currentCount === 0;
  }

  private decrementGlobalCount(subscriptionKey: string): boolean {
    const currentCount = this.globalSubscriptionCounts.get(subscriptionKey) ?? 0;
    const nextCount = currentCount - 1;

    if (nextCount <= 0) {
      this.globalSubscriptionCounts.delete(subscriptionKey);
      this.subscriptionMetadata.delete(subscriptionKey);
      return true;
    }

    this.globalSubscriptionCounts.set(subscriptionKey, nextCount);
    return false;
  }

  private async cleanupClientSubscriptions(ws: WebSocket): Promise<void> {
    const subscriptions = this.clientSubscriptions.get(ws);
    const userId = this.clientUsers.get(ws);
    if (subscriptions) {
      for (const subscriptionKey of subscriptions) {
        const metadata = this.subscriptionMetadata.get(subscriptionKey);
        const shouldRouteUnsubscribe = this.decrementGlobalCount(subscriptionKey);
        if (shouldRouteUnsubscribe && userId && metadata) {
          try {
            await this.subscriptionRouter.unsubscribe(userId, metadata);
          } catch (error: unknown) {
            logger.warn(
              { error, userId, subscriptionKey },
              "Failed to route subscription cleanup",
            );
          }
        }
      }
    }
    this.clientSubscriptions.delete(ws);

    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
    this.clientUsers.delete(ws);
    this.updateBinanceSubscriptions();
    logger.info(
      {
        event: "WS_CLIENT_DISCONNECTED",
        userId: userId ?? null,
        remainingUserSockets: userId ? this.userSockets.get(userId)?.size ?? 0 : 0,
        remainingGlobalSubscriptionCounts: Object.fromEntries(this.globalSubscriptionCounts),
      },
      "Websocket client disconnected and subscriptions cleaned",
    );
  }

  private connectBinanceMaster(): void {
    if (this.binanceSocket && this.binanceSocket.readyState === WebSocket.OPEN) {
      return;
    }

    this.binanceSocket = new WebSocket(this.binanceUrl);
    logger.info({ event: "BINANCE_MASTER_CONNECTING", url: this.binanceUrl }, "Connecting to Binance");

    this.binanceSocket.on("open", (): void => {
      logger.info({ event: "BINANCE_MASTER_CONNECTED" }, "Binance master websocket connected");
      this.updateBinanceSubscriptions();
    });

    this.binanceSocket.on("message", (rawData: WebSocket.RawData): void => {
      this.handleBinanceMessage(rawData);
    });

    this.binanceSocket.on("error", (error: Error): void => {
      logger.warn({ error }, "Binance master websocket error");
      this.scheduleReconnect();
    });

    this.binanceSocket.on("close", (): void => {
      logger.warn("Binance master websocket closed; scheduling reconnect");
      this.activeBinanceSymbols.clear();
      this.binanceSocket = null;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout((): void => {
      this.reconnectTimer = null;
      this.connectBinanceMaster();
    }, this.reconnectDelayMs);
  }

  private isBinanceDepthMessage(payload: unknown): payload is { bids: string[][], asks: string[][], s?: string, stream?: string } {
    if (!payload || typeof payload !== "object") return false;

    // Check if it's a Combined Stream payload (e.g., {"stream": "btcusdt@depth", "data": {...}})
    const candidate = payload as any;
    if (candidate.data && Array.isArray(candidate.data.bids)) {
      return true;
    }

    // Check if it's a Raw Stream payload
    return (
      Array.isArray(candidate.bids) &&
      Array.isArray(candidate.asks)
    );
  }
  // 1. The Ticker Guard (You already have this one!)
  private isBinanceTickerMessage(payload: unknown): payload is BinanceTickerMessage {
    if (!payload || typeof payload !== "object") return false;
    const candidate = payload as Record<string, unknown>;
    return (
      candidate.e === "24hrTicker" && // Safer to check the exact event type!
      typeof candidate.s === "string" &&
      typeof candidate.c === "string"
    );
  }

  // 2. THE NEW AGGTRADE GUARD
  private isBinanceAggTradeMessage(payload: unknown): payload is any { // Replace 'any' with your interface
    if (!payload || typeof payload !== "object") return false;
    const candidate = payload as Record<string, unknown>;

    return (
      candidate.e === "aggTrade" &&
      typeof candidate.s === "string" &&
      typeof candidate.p === "string" &&
      typeof candidate.q === "string" &&
      typeof candidate.m === "boolean"
    );
  }
  private handleBinanceMessage(rawData: WebSocket.RawData): void {
    // let parsedPayload: unknown;
    // try {
    //   parsedPayload = JSON.parse(rawData.toString());
    // } catch {
    //   return;
    // }
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(rawData.toString());
    } catch {
      return;
    }

    // 🎁 THE UNWRAPPER (Add this at the very top!)
    let streamSymbol = "UNKNOWN";
    if (parsedPayload && parsedPayload.stream && parsedPayload.data) {
      // Extract "ETCUSDT" from "etcusdt@depth20@100ms"
      streamSymbol = parsedPayload.stream.split('@')[0].toUpperCase();

      // Strip the wrapper away so the rest of your code works normally
      parsedPayload = parsedPayload.data;
    }
    // ==========================================
    // 🚦 ROUTE 1: THE UI STREAM
    // ==========================================
    if (this.isBinanceTickerMessage(parsedPayload)) {
      const symbol = parsedPayload.s.toUpperCase();
      try {
        const snapshot = sharedMarketSnapshotService.recordTick({
          provider: "BINANCE",
          exchange: "BINANCE",
          marketType: "CRYPTO",
          symbol,
          providerSymbol: symbol,
          instrumentToken: symbol,
          price: Number(parsedPayload.c),
          ...(parsedPayload.v !== undefined ? { cumulativeVolume: Number(parsedPayload.v) } : {}),
          ...(parsedPayload.o !== undefined ? { open: Number(parsedPayload.o) } : {}),
          ...(parsedPayload.h !== undefined ? { high: Number(parsedPayload.h) } : {}),
          ...(parsedPayload.l !== undefined ? { low: Number(parsedPayload.l) } : {}),
          previousClose: Number(parsedPayload.x),
          occurredAt: new Date(parsedPayload.E),
          receivedAt: new Date(),
          source: "BINANCE_WS",
        });
        sharedTemplateMonitoringOrchestrator.recordSnapshot(snapshot.resourceKey, snapshot);
      } catch (error: unknown) {
        logger.warn(
          { event: "MARKET_SNAPSHOT_BINANCE_TICK_REJECTED", symbol, error },
          "Market snapshot enrichment rejected a Binance tick",
        );
      }

      // Add the explicit type right here! 👇
      const outboundPayload: OutboundTickerPayload = {
        type: "TICKER_UPDATE",
        symbol,
        currentPrice: parsedPayload.c,
        previousClose: parsedPayload.x,
        priceChangePercent: parsedPayload.P,
      };
      for (const [client, subscriptions] of this.clientSubscriptions.entries()) {
        const subscriptionKey = buildMarketSubscriptionKey({
          provider: "BINANCE",
          exchange: "BINANCE",
          instrumentToken: symbol,
        });
        if (subscriptions.has(subscriptionKey)) {
          this.sendToClient(client, outboundPayload);
        }
      }
      void this.activeTradeLiveMonitorService.handleTick({
        provider: "BINANCE",
        exchange: "BINANCE",
        symbol,
        providerSymbol: symbol,
        instrumentToken: symbol,
        price: Number(parsedPayload.c),
        occurredAt: new Date(parsedPayload.E),
        receivedAt: new Date(),
        source: "BINANCE_WS",
      }).catch((error: unknown): void => {
        logger.warn(
          { event: "WS_ACTIVE_TRADE_BINANCE_TICK_FAILED", symbol, error },
          "Failed to route Binance tick to ActiveTrade monitoring",
        );
      });
      return; // Message handled, exit function
    }

    // ==========================================
    // 🧠 ROUTE 2: THE AI ENGINE STREAM
    // ==========================================
    if (this.isBinanceAggTradeMessage(parsedPayload)) {
      const symbol = parsedPayload.s.toUpperCase();
      const currentPrice = parseFloat(parsedPayload.p);
      const quantity = parseFloat(parsedPayload.q);
      const timestamp = Number(parsedPayload.E);
      const isbuyermaker = parsedPayload.m;

      // Pass it to the engine!
      void this.analyzerEngine
        .processTick(symbol, currentPrice, timestamp, isbuyermaker, quantity)
        .catch((error: unknown): void => {
          logger.error({ error, symbol }, "Analyzer engine processing failed");
        });

      return; // Message handled, exit function
    }
    // ==========================================
    // 📊 ROUTE 3: THE ORDER BOOK STREAM
    // ==========================================
    if (this.isBinanceDepthMessage(parsedPayload)) {
      let symbol = "UNKNOWN";
      let bids: string[][] = [];
      let asks: string[][] = [];

      const candidate = parsedPayload as any;

      // Logic to extract the symbol and data based on Binance's payload format
      if (candidate.stream && candidate.data) {
        // Combined Stream format: "stream": "btcusdt@depth20@100ms"
        symbol = candidate.stream.split('@')[0].toUpperCase();
        bids = candidate.data.bids;
        asks = candidate.data.asks;
      } else {
        // Raw Stream format
        // If 's' exists, great. If not, we have to rely on a fallback (like if you only track one coin per WS connection)
        symbol = candidate.s ? candidate.s.toUpperCase() : "BTCUSDT"; // Change fallback if needed
        bids = candidate.bids;
        asks = candidate.asks;
      }

      // 🛑 The Bouncer: Don't update if we couldn't figure out the symbol
      if (symbol === "UNKNOWN") return;

      // ✅ Now it will pass "BTCUSDT", "ETCUSDT", etc., perfectly!
      this.analyzerEngine.updateOrderBook(streamSymbol, bids, asks);
      return;

      return; // Message handled, exit function
    }
    // If it reaches here, it's an unknown message from Binance. Just ignore it.
  }
  public sendBinanceControlMessage(action: "SUBSCRIBE" | "UNSUBSCRIBE", symbols: string[]): void {
    if (!this.binanceSocket || this.binanceSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    // const params = symbols.map((symbol): string => `${symbol.toLowerCase()}@ticker`);
    const params = symbols.flatMap((symbol) => {
      const lowerSymbol = symbol.toLowerCase();
      return [
        `${lowerSymbol}@aggTrade`,  // 2. Feeds your new CVD Risk Engine
        `${lowerSymbol}@ticker`,   // 1. Keeps your React UI happy
        `${lowerSymbol}@depth20@100ms`
      ];
    })
    const requestId = Date.now();
    logger.info(
      {
        event: "BINANCE_CONTROL_MESSAGE",
        action,
        requestId,
        symbols,
        streamParams: params,
      },
      "Dispatching Binance subscription control message",
    );

    this.binanceSocket.send(
      JSON.stringify({
        method: action,
        params,
        id: requestId,
      }),
    );
  }

  private findClientSubscriptionBySymbol(
    ws: WebSocket,
    symbol: string,
  ): ResolvedMarketSubscription | null {
    const subscriptions = this.clientSubscriptions.get(ws);
    if (!subscriptions) {
      return null;
    }

    for (const subscriptionKey of subscriptions) {
      const metadata = this.subscriptionMetadata.get(subscriptionKey);
      if (metadata?.symbol === symbol || metadata?.displayName.toUpperCase() === symbol) {
        return metadata;
      }
    }

    return null;
  }

  private toSubscriptionResult(subscription: ResolvedMarketSubscription): {
    symbol: string;
    displayName?: string;
    provider: string;
    subscriptionKey: string;
  } {
    return {
      symbol: subscription.symbol,
      displayName: subscription.displayName,
      provider: subscription.provider,
      subscriptionKey: subscription.subscriptionKey,
    };
  }

  private handleAngelMarketTick(tick: NormalizedMarketTick): void {
    if (!tick.userId || tick.provider !== "ANGEL_ONE") {
      return;
    }

    const subscriptionKey = buildMarketSubscriptionKey({
      provider: "ANGEL_ONE",
      userId: tick.userId,
      exchange: tick.exchange,
      instrumentToken: tick.instrumentToken,
    });
    const subscription = this.subscriptionMetadata.get(subscriptionKey);
    const previousPrice = this.previousMarketTickPrices.get(subscriptionKey);
    const previousClose = previousPrice ?? tick.price;
    const priceChangePercent = previousPrice && previousPrice > 0
      ? ((tick.price - previousPrice) / previousPrice) * 100
      : 0;
    this.previousMarketTickPrices.set(subscriptionKey, tick.price);
    try {

      const marketSnapshot = sharedMarketSnapshotService.recordTick({
        provider: tick.provider,
        exchange: tick.exchange,
        marketType: tick.marketType,
        userId: tick.userId,
        symbol: subscription?.symbol ?? tick.symbol,
        ...(subscription?.providerSymbol || tick.providerSymbol
          ? { providerSymbol: subscription?.providerSymbol ?? tick.providerSymbol }
          : {}),
        instrumentToken: tick.instrumentToken,
        price: tick.price,
        ...(tick.volume !== undefined ? { volume: tick.volume } : {}),
        occurredAt: new Date(tick.timestamp),
        receivedAt: new Date(),
        source: "ANGEL_WS",
      });
      sharedTemplateMonitoringOrchestrator.recordSnapshot(
        marketSnapshot.resourceKey,
        marketSnapshot,
      );
    } catch (error: unknown) {
      logger.warn(
        {
          event: "MARKET_SNAPSHOT_ANGEL_TICK_REJECTED",
          userId: tick.userId,
          exchange: tick.exchange,
          symbol: subscription?.symbol ?? tick.symbol,
          error,
        },
        "Market snapshot enrichment rejected an Angel tick",
      );
    }

    const payload: OutboundMarketTickPayload = {
      type: "MARKET_TICK",
      provider: tick.provider,
      marketType: tick.marketType,
      exchange: tick.exchange,
      symbol: subscription?.symbol ?? tick.symbol,
      instrumentToken: tick.instrumentToken,
      price: tick.price,
      currentPrice: tick.price.toString(),
      previousClose: previousClose.toString(),
      priceChangePercent: priceChangePercent.toFixed(3),
      timestamp: tick.timestamp,
    };
    const displayName = subscription?.displayName ?? tick.displayName;
    if (displayName) {
      payload.displayName = displayName;
    }
    const providerSymbol = subscription?.providerSymbol ?? tick.providerSymbol;
    if (providerSymbol) {
      payload.providerSymbol = providerSymbol;
    }

    for (const [client, subscriptions] of this.clientSubscriptions.entries()) {
      if (subscriptions.has(subscriptionKey)) {
        this.sendToClient(client, payload);
      }
    }

    void this.analyzerEngine.processNormalizedTick({
      ...tick,
      raw: tick.raw,
    }).catch((error: unknown): void => {
      logger.error(
        {
          event: "WS_ANALYZER_NORMALIZED_TICK_FAILED",
          error,
          provider: tick.provider,
          userId: tick.userId,
          exchange: tick.exchange,
          symbol: tick.symbol,
          instrumentToken: tick.instrumentToken,
        },
        "Analyzer failed while processing normalized market tick",
      );
    });
    void this.activeTradeLiveMonitorService.handleTick({
      provider: tick.provider,
      exchange: tick.exchange,
      symbol: tick.symbol,
      ...(tick.providerSymbol ? { providerSymbol: tick.providerSymbol } : {}),
      instrumentToken: tick.instrumentToken,
      userId: tick.userId,
      price: tick.price,
      occurredAt: new Date(tick.timestamp),
      receivedAt: new Date(),
      source: "ANGEL_WS",
    }).catch((error: unknown): void => {
      logger.warn(
        {
          event: "WS_ACTIVE_TRADE_ANGEL_TICK_FAILED",
          userId: tick.userId,
          exchange: tick.exchange,
          symbol: tick.symbol,
          error,
        },
        "Failed to route Angel tick to ActiveTrade monitoring",
      );
    });
  }

  private errorReason(error: unknown): string {
    const message = error instanceof Error ? error.message : "SUBSCRIPTION_FAILED";
    return message.split(":")[0]?.trim() || "SUBSCRIPTION_FAILED";
  }

  private safeSubscriptionFailureMessage(error: unknown): string {
    const reason = this.errorReason(error);
    if (reason === "BROKER_LOGIN_REQUIRED") {
      return "Connect Angel One to subscribe to this symbol.";
    }
    if (reason === "SYMBOL_NOT_FOUND") {
      return "Symbol was not found.";
    }
    if (reason === "PROVIDER_NOT_SUPPORTED") {
      return "Provider is not supported for websocket subscription yet.";
    }
    if (reason === "BROKER_SESSION_EXPIRED") {
      return "Broker session expired. Reconnect Angel One.";
    }

    return "Subscription failed.";
  }

  private sendToClient(
    ws: WebSocket,
    payload:
      | OutboundTickerPayload
      | OutboundAckPayload
      | OutboundErrorPayload
      | OutboundAlertPayload
      | OutboundTradeEventPayload
      | OutboundSubscriptionUpdateResultPayload
      | OutboundMarketTickPayload,
  ): boolean {
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch (error: unknown) {
      logger.warn({ error }, "Failed to send payload to websocket client");
      return false;
    }
  }
  public getEngineSnapshot() {
    return this.analyzerEngine.getEngineStateSnapshot();
  }
  public getAnalyzerRuntimeSnapshot(input: Parameters<AnalyzerEngine["getRuntimeSnapshot"]>[0]) {
    return this.analyzerEngine.getRuntimeSnapshot(input);
  }
  public getTradeMonitoringHealthSnapshot() {
    return sharedTradeMonitoringHealthService.getSnapshot();
  }
  public getActiveTradeSubscriptionSnapshot() {
    return sharedActiveTradeSubscriptionService.getSnapshot();
  }
  public getSupportResistance(symbol: string) {
    const orderBookData = this.analyzerEngine.findStructuralSupportResistance(symbol);
    const currentCvd = this.analyzerEngine.currentCVD.get(symbol) || 0;
    return { orderBookData, currentCvd }
  }
  public invalidateMonitorCache(symbol?: string): void {
    this.analyzerEngine.invalidateMonitorCache(symbol);
  }
  public async refreshMonitorCache(symbol: string, reason?: string): Promise<void> {
    await this.analyzerEngine.refreshMonitorCache(symbol, reason);
  }
  /**
   * Called by the HTTP getLtp Controller (MeDo Frontend)
   * Acts as an "Ignition Switch" for symbols requested via REST.
   */
  public addHttpSubscription(rawSymbol: string): void {
    const symbol = this.normalizeSymbol(rawSymbol);
    const subscriptionKey = buildMarketSubscriptionKey({
      provider: "BINANCE",
      exchange: "BINANCE",
      instrumentToken: symbol,
    });

    // Check if the engine is already tracking this coin (either via WS or previous HTTP call)
    const currentCount = this.globalSymbolCounts.get(symbol) || 0;

    if (currentCount === 0) {
      logger.info(
        { event: "HTTP_IGNITION", symbol },
        "HTTP Polling detected. Forcing Binance subscription."
      );

      // Increment global count to 1 so the engine knows it is active
      this.globalSymbolCounts.set(symbol, 1);
      this.incrementGlobalCount(subscriptionKey);
      this.subscriptionMetadata.set(subscriptionKey, {
        symbolId: "",
        symbol,
        displayName: symbol,
        provider: "BINANCE",
        marketType: "CRYPTO",
        exchange: "BINANCE",
        instrumentToken: symbol,
        providerSymbol: symbol,
        requiresBrokerLogin: false,
        supportedBroker: "NONE",
        subscriptionKey,
      });

      // Tell Binance to start sending data!
      this.updateBinanceSubscriptions();
    }
  }
}
// This creates the single "bucket" that the whole app will share
export const sharedWebsocketManager = new WebSocketManager();
