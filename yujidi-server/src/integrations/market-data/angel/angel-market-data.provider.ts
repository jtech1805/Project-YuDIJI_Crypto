import { randomUUID } from "node:crypto";

import pino from "pino";
import WebSocket from "ws";

import type { NormalizedMarketTick } from "../../../types/market-data.types.js";
import { parseAngelLtpPacket } from "./angel-ltp-packet.parser.js";

const logger = pino({ name: "angel-market-data-provider" });

const ANGEL_SMART_STREAM_URL = "wss://smartapisocket.angelone.in/smart-stream";
const ANGEL_LTP_MODE = 1;
const HEARTBEAT_INTERVAL_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;

const ANGEL_EXCHANGE_TYPE_BY_EXCHANGE: Record<string, number> = {
  NSE: 1,
  NFO: 2,
  BSE: 3,
  BFO: 4,
  MCX: 5,
};

export type AngelMarketSubscription = {
  userId: string;
  marketType: "COMMODITY";
  exchange: "MCX";
  symbol: string;
  displayName: string;
  providerSymbol: string;
  instrumentToken: string;
};

export type AngelMarketDataProviderOptions = {
  userId: string;
  clientCode: string;
  apiKey: string;
  jwtToken: string;
  feedToken: string;
  onTick: (tick: NormalizedMarketTick) => void;
  url?: string;
};

export class AngelMarketDataProvider {
  private socket: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly subscriptionsByToken = new Map<string, AngelMarketSubscription>();
  private connected = false;
  private readonly url: string;

  public constructor(private readonly options: AngelMarketDataProviderOptions) {
    this.url = options.url ?? ANGEL_SMART_STREAM_URL;
  }

  public connect(): Promise<void> {
    if (this.connected && this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject): void => {
      let settled = false;
      const socket = new WebSocket(this.url, {
        headers: {
          Authorization: this.options.jwtToken,
          "x-api-key": this.options.apiKey,
          "x-client-code": this.options.clientCode,
          "x-feed-token": this.options.feedToken,
        },
      });
      this.socket = socket;

      const timeout = setTimeout((): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.connected = false;
        socket.terminate();
        logger.warn(
          { userId: this.options.userId, timeoutMs: CONNECT_TIMEOUT_MS },
          "Angel websocket connect timed out",
        );
        reject(new Error("ANGEL_WEBSOCKET_CONNECT_TIMEOUT"));
      }, CONNECT_TIMEOUT_MS);

      const failConnect = (error: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        logger.warn(
          { userId: this.options.userId, error },
          "Angel websocket connect failed",
        );
        reject(error instanceof Error ? error : new Error("ANGEL_WEBSOCKET_CONNECT_FAILED"));
      };

      socket.once("open", (): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        this.connected = true;
        this.startHeartbeat();
        logger.info({ userId: this.options.userId }, "Angel websocket connected");
        resolve();
      });

      socket.once("error", failConnect);

      socket.on("message", (data, isBinary): void => {
        this.handleMessage(data, isBinary);
      });

      socket.on("close", (code): void => {
        this.connected = false;
        this.stopHeartbeat();
        logger.warn({ userId: this.options.userId, code }, "Angel websocket closed");
      });

      socket.on("error", (error): void => {
        logger.warn({ userId: this.options.userId, error }, "Angel websocket error");
      });
    });
  }

  public async disconnect(): Promise<void> {
    this.stopHeartbeat();
    this.connected = false;

    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      this.socket = null;
      return;
    }

    await new Promise<void>((resolve): void => {
      this.socket?.once("close", (): void => resolve());
      this.socket?.close();
      setTimeout(resolve, 1000);
    });
    this.socket = null;
  }

  public async subscribe(subscription: AngelMarketSubscription): Promise<void> {
    await this.ensureOpen();
    this.subscriptionsByToken.set(subscription.instrumentToken, subscription);
    this.sendSubscriptionMessage(1, subscription);
  }

  public async unsubscribe(subscription: AngelMarketSubscription): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscriptionMessage(0, subscription);
    }
    this.subscriptionsByToken.delete(subscription.instrumentToken);
  }

  public isConnected(): boolean {
    return this.connected && this.socket?.readyState === WebSocket.OPEN;
  }

  private async ensureOpen(): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }
  }

  private sendSubscriptionMessage(action: 0 | 1, subscription: AngelMarketSubscription): void {
    const exchangeType = ANGEL_EXCHANGE_TYPE_BY_EXCHANGE[subscription.exchange];
    if (!exchangeType) {
      throw new Error("ANGEL_SUBSCRIPTION_FAILED: unsupported Angel exchange");
    }

    const payload = {
      correlationID: randomUUID().replace(/-/g, "").slice(0, 16),
      action,
      params: {
        mode: ANGEL_LTP_MODE,
        tokenList: [
          {
            exchangeType,
            tokens: [subscription.instrumentToken],
          },
        ],
      },
    };

    this.socket?.send(JSON.stringify(payload));
    logger.info(
      {
        userId: this.options.userId,
        action,
        exchange: subscription.exchange,
        instrumentToken: subscription.instrumentToken,
        mode: "LTP",
      },
      "Angel websocket subscription message sent",
    );
  }

  private handleMessage(data: WebSocket.RawData, isBinary: boolean): void {
    if (!isBinary) {
      const text = data.toString();
      if (text === "pong") {
        return;
      }
      logger.info({ userId: this.options.userId, messageType: "text" }, "Angel websocket text message received");
      return;
    }

    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const packet = parseAngelLtpPacket(buffer);
      const subscription = this.subscriptionsByToken.get(packet.token);
      if (!subscription) {
        logger.warn(
          { userId: this.options.userId, instrumentToken: packet.token },
          "Angel LTP packet received for unknown token",
        );
        return;
      }

      this.options.onTick({
        provider: "ANGEL_ONE",
        scope: "USER_SESSION",
        userId: this.options.userId,
        marketType: subscription.marketType,
        exchange: subscription.exchange,
        symbol: subscription.symbol,
        displayName: subscription.displayName,
        displaySymbol: subscription.displayName,
        providerSymbol: subscription.providerSymbol,
        instrumentToken: subscription.instrumentToken,
        price: packet.ltp,
        timestamp: packet.exchangeTimestamp,
        raw: {
          mode: packet.mode,
          exchangeType: packet.exchangeType,
          sequenceNumber: packet.sequenceNumber.toString(),
        },
      });
    } catch (error: unknown) {
      logger.warn({ userId: this.options.userId, error }, "Angel LTP packet parse failed");
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval((): void => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send("ping");
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
