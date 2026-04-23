import type { IncomingMessage } from "node:http";
import type { Server as HttpServer } from "node:http";

import pino from "pino";
import { z } from "zod";
import WebSocket, { WebSocketServer } from "ws";

import { AppError } from "../errors/AppError.js";
import { AnalyzerEngine } from "./analyzer.service.js";
import { parseCookieHeader } from "../utils/cookieUtils.js";
import { verifyAccessToken } from "../utils/jwt.js";

interface BinanceTickerMessage {
  s: string;
  c: string;
  x: string;
  P: string;
  E: number;
  m: boolean;
  q: string;
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

interface OutboundErrorPayload {
  type: "ERROR";
  message: string;
}

interface OutboundAlertPayload {
  type: "NEW_ALERT";
  payload: unknown;
}
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
    this.analyzerEngine = new AnalyzerEngine((userId, payload): void => {
      this.emitToUser(userId, payload);
    });
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
      this.handleClientMessage(ws, rawMessage);
    });

    ws.on("close", (): void => {
      this.cleanupClientSubscriptions(ws);
    });

    ws.on("error", (): void => {
      this.cleanupClientSubscriptions(ws);
    });
  }

  public emitToUser(userId: string, payload: OutboundAlertPayload): void {
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
      return;
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
    for (const socket of sockets) {
      this.sendToClient(socket, payload);
    }
  }

  public handleClientMessage(ws: WebSocket, message: WebSocket.RawData): void {
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

    for (const rawSymbol of parsed.unsubscribe) {
      const symbol = this.normalizeSymbol(rawSymbol);
      if (!subscriptions.has(symbol)) {
        continue;
      }

      subscriptions.delete(symbol);
      this.decrementGlobalCount(symbol);
    }

    for (const rawSymbol of parsed.subscribe) {
      const symbol = this.normalizeSymbol(rawSymbol);
      if (subscriptions.has(symbol)) {
        continue;
      }

      subscriptions.add(symbol);
      this.incrementGlobalCount(symbol);
    }

    this.updateBinanceSubscriptions();
    logger.info(
      {
        event: "WS_SUBSCRIPTION_UPDATE_APPLIED",
        userId: this.clientUsers.get(ws) ?? null,
        userSubscriptions: Array.from(subscriptions),
        globalSymbolCounts: Object.fromEntries(this.globalSymbolCounts),
      },
      "Applied subscription update",
    );
    this.sendToClient(ws, {
      type: "SUBSCRIPTION_ACK",
      subscriptions: Array.from(subscriptions).sort((a, b): number => a.localeCompare(b)),
    });
  }

  public updateBinanceSubscriptions(): void {
    if (!this.binanceSocket || this.binanceSocket.readyState !== WebSocket.OPEN) {
      logger.info(
        {
          event: "WS_BINANCE_SUBSCRIPTION_DEFERRED",
          reason: "MASTER_SOCKET_NOT_READY",
          pendingGlobalCounts: Object.fromEntries(this.globalSymbolCounts),
        },
        "Skipped Binance subscription sync; socket not open",
      );
      return;
    }

    const desiredSymbols = new Set<string>(
      Array.from(this.globalSymbolCounts.entries())
        .filter((entry): boolean => entry[1] > 0)
        .map((entry): string => entry[0]),
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

  private incrementGlobalCount(symbol: string): void {
    const currentCount = this.globalSymbolCounts.get(symbol) ?? 0;
    this.globalSymbolCounts.set(symbol, currentCount + 1);
  }

  private decrementGlobalCount(symbol: string): void {
    const currentCount = this.globalSymbolCounts.get(symbol) ?? 0;
    const nextCount = currentCount - 1;

    if (nextCount <= 0) {
      this.globalSymbolCounts.delete(symbol);
      return;
    }

    this.globalSymbolCounts.set(symbol, nextCount);
  }

  private cleanupClientSubscriptions(ws: WebSocket): void {
    const subscriptions = this.clientSubscriptions.get(ws);
    if (subscriptions) {
      for (const symbol of subscriptions) {
        this.decrementGlobalCount(symbol);
      }
    }
    this.clientSubscriptions.delete(ws);

    const userId = this.clientUsers.get(ws);
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
        remainingGlobalSymbolCounts: Object.fromEntries(this.globalSymbolCounts),
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

      // Add the explicit type right here! 👇
      const outboundPayload: OutboundTickerPayload = {
        type: "TICKER_UPDATE",
        symbol,
        currentPrice: parsedPayload.c,
        previousClose: parsedPayload.x,
        priceChangePercent: parsedPayload.P,
      };
      for (const [client, subscriptions] of this.clientSubscriptions.entries()) {
        if (subscriptions.has(symbol)) {
          this.sendToClient(client, outboundPayload);
        }
      }
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
  private sendBinanceControlMessage(action: "SUBSCRIBE" | "UNSUBSCRIBE", symbols: string[]): void {
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

  private sendToClient(
    ws: WebSocket,
    payload: OutboundTickerPayload | OutboundAckPayload | OutboundErrorPayload | OutboundAlertPayload,
  ): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      ws.send(JSON.stringify(payload));
    } catch (error: unknown) {
      logger.warn({ error }, "Failed to send payload to websocket client");
    }
  }
  public getEngineSnapshot() {
    return this.analyzerEngine.getEngineStateSnapshot();
  }
}
// This creates the single "bucket" that the whole app will share
export const sharedWebsocketManager = new WebSocketManager();