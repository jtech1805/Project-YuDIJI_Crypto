import pino from "pino";
import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../errors/AppError.js";
import {
  AngelMarketDataProvider,
  type AngelMarketSubscription,
} from "../integrations/market-data/angel/angel-market-data.provider.js";
import { TripwireConfigModel, type TripwireConfig } from "../models/TripwireConfig.js";
import { buildMarketSubscriptionKey } from "../utils/market-subscription-key.js";
import {
  BrokerConnectionService,
  type ActiveAngelSession,
} from "./broker-connection.service.js";
import type { Exchange, MarketType, NormalizedMarketTick } from "../types/market-data.types.js";

const logger = pino({ name: "angel-user-market-data-session-service" });

export type AngelSubscriptionResponse = {
  provider: "ANGEL_ONE";
  subscriptionKey: string;
  exchange: Exchange;
  instrumentToken: string;
  mode: "LTP";
  streamStatus: "SUBSCRIBED" | "UNSUBSCRIBED";
};

export type AngelUserSessionStatus = {
  userId: string;
  connected: boolean;
  subscriptionCount: number;
  subscriptions: Array<{
    subscriptionKey: string;
    exchange: string;
    instrumentToken: string;
    symbol: string;
    displayName: string;
  }>;
};

type AngelProviderPort = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  subscribe: (subscription: AngelMarketSubscription) => Promise<void>;
  unsubscribe: (subscription: AngelMarketSubscription) => Promise<void>;
  isConnected: () => boolean;
};

type AngelUserSession = {
  provider: AngelProviderPort;
  subscriptions: Map<string, AngelMarketSubscription>;
};

type MonitorRepository = {
  findOne: typeof TripwireConfigModel.findOne;
};

type AngelUserMarketDataSessionServiceDependencies = {
  monitorRepository: MonitorRepository;
  brokerConnectionService: Pick<BrokerConnectionService, "getActiveAngelSessionForUser">;
  providerFactory: (input: {
    userId: string;
    session: ActiveAngelSession;
    onTick: (tick: NormalizedMarketTick) => void;
  }) => AngelProviderPort;
  onTick: (tick: NormalizedMarketTick) => void;
};

export class AngelUserMarketDataSessionService {
  private readonly sessionsByUserId = new Map<string, AngelUserSession>();

  public constructor(
    private readonly dependencies: Partial<AngelUserMarketDataSessionServiceDependencies> = {},
  ) {}

  public async subscribeUserToAngelMonitor(
    userId: string,
    monitorId: string,
  ): Promise<AngelSubscriptionResponse> {
    const monitor = await this.loadAngelMonitor(userId, monitorId);
    const subscription = this.monitorToSubscription(userId, monitor);
    const subscriptionKey = buildMarketSubscriptionKey({
      provider: "ANGEL_ONE",
      userId,
      exchange: subscription.exchange,
      instrumentToken: subscription.instrumentToken,
    });

    const session = await this.getOrCreateUserSession(userId);
    session.subscriptions.set(subscriptionKey, subscription);
    await session.provider.subscribe(subscription);

    logger.info(
      {
        event: "ANGEL_MONITOR_SUBSCRIBED",
        userId,
        subscriptionKey,
        exchange: subscription.exchange,
        instrumentToken: subscription.instrumentToken,
      },
      "Angel monitor subscribed",
    );

    return {
      provider: "ANGEL_ONE",
      subscriptionKey,
      exchange: subscription.exchange,
      instrumentToken: subscription.instrumentToken,
      mode: "LTP",
      streamStatus: "SUBSCRIBED",
    };
  }

  public async subscribeResolvedAngelSubscription(input: {
    userId: string;
    subscriptionKey: string;
    marketType: MarketType;
    exchange: Exchange;
    symbol: string;
    displayName: string;
    providerSymbol: string;
    instrumentToken: string;
  }): Promise<AngelSubscriptionResponse> {
    const subscription: AngelMarketSubscription = {
      userId: input.userId,
      marketType: input.marketType,
      exchange: input.exchange,
      symbol: input.symbol,
      displayName: input.displayName,
      providerSymbol: input.providerSymbol,
      instrumentToken: input.instrumentToken,
    };

    const session = await this.getOrCreateUserSession(input.userId);
    session.subscriptions.set(input.subscriptionKey, subscription);
    await session.provider.subscribe(subscription);

    logger.info(
      {
        event: "ANGEL_RESOLVED_SUBSCRIPTION_APPLIED",
        userId: input.userId,
        subscriptionKey: input.subscriptionKey,
        exchange: input.exchange,
        instrumentToken: input.instrumentToken,
      },
      "Angel resolved subscription applied",
    );

    return {
      provider: "ANGEL_ONE",
      subscriptionKey: input.subscriptionKey,
      exchange: input.exchange,
      instrumentToken: input.instrumentToken,
      mode: "LTP",
      streamStatus: "SUBSCRIBED",
    };
  }

  public async unsubscribeResolvedAngelSubscription(input: {
    userId: string;
    subscriptionKey: string;
    marketType: MarketType;
    exchange: Exchange;
    symbol: string;
    displayName: string;
    providerSymbol: string;
    instrumentToken: string;
  }): Promise<AngelSubscriptionResponse> {
    const subscription: AngelMarketSubscription = {
      userId: input.userId,
      marketType: input.marketType,
      exchange: input.exchange,
      symbol: input.symbol,
      displayName: input.displayName,
      providerSymbol: input.providerSymbol,
      instrumentToken: input.instrumentToken,
    };
    const session = this.sessionsByUserId.get(input.userId);

    if (session) {
      await session.provider.unsubscribe(subscription);
      session.subscriptions.delete(input.subscriptionKey);
      if (session.subscriptions.size === 0) {
        await session.provider.disconnect();
        this.sessionsByUserId.delete(input.userId);
      }
    }

    logger.info(
      {
        event: "ANGEL_RESOLVED_SUBSCRIPTION_REMOVED",
        userId: input.userId,
        subscriptionKey: input.subscriptionKey,
        exchange: input.exchange,
        instrumentToken: input.instrumentToken,
      },
      "Angel resolved subscription removed",
    );

    return {
      provider: "ANGEL_ONE",
      subscriptionKey: input.subscriptionKey,
      exchange: input.exchange,
      instrumentToken: input.instrumentToken,
      mode: "LTP",
      streamStatus: "UNSUBSCRIBED",
    };
  }

  public async unsubscribeUserFromAngelMonitor(
    userId: string,
    monitorId: string,
  ): Promise<AngelSubscriptionResponse> {
    const monitor = await this.loadAngelMonitor(userId, monitorId);
    const subscription = this.monitorToSubscription(userId, monitor);
    const subscriptionKey = buildMarketSubscriptionKey({
      provider: "ANGEL_ONE",
      userId,
      exchange: subscription.exchange,
      instrumentToken: subscription.instrumentToken,
    });
    const session = this.sessionsByUserId.get(userId);

    if (session) {
      await session.provider.unsubscribe(subscription);
      session.subscriptions.delete(subscriptionKey);
      if (session.subscriptions.size === 0) {
        await session.provider.disconnect();
        this.sessionsByUserId.delete(userId);
      }
    }

    logger.info(
      {
        event: "ANGEL_MONITOR_UNSUBSCRIBED",
        userId,
        subscriptionKey,
        exchange: subscription.exchange,
        instrumentToken: subscription.instrumentToken,
      },
      "Angel monitor unsubscribed",
    );

    return {
      provider: "ANGEL_ONE",
      subscriptionKey,
      exchange: subscription.exchange,
      instrumentToken: subscription.instrumentToken,
      mode: "LTP",
      streamStatus: "UNSUBSCRIBED",
    };
  }

  public getSessionStatus(userId: string): AngelUserSessionStatus {
    const session = this.sessionsByUserId.get(userId);
    return {
      userId,
      connected: Boolean(session?.provider.isConnected()),
      subscriptionCount: session?.subscriptions.size ?? 0,
      subscriptions: Array.from(session?.subscriptions.entries() ?? []).map(
        ([subscriptionKey, subscription]) => ({
          subscriptionKey,
          exchange: subscription.exchange,
          instrumentToken: subscription.instrumentToken,
          symbol: subscription.symbol,
          displayName: subscription.displayName,
        }),
      ),
    };
  }

  private async getOrCreateUserSession(userId: string): Promise<AngelUserSession> {
    const existingSession = this.sessionsByUserId.get(userId);
    if (existingSession) {
      if (!existingSession.provider.isConnected()) {
        await existingSession.provider.connect();
      }
      return existingSession;
    }

    const brokerSession = await this.getBrokerConnectionService().getActiveAngelSessionForUser(userId);
    if (!brokerSession.feedToken) {
      throw new AppError("ANGEL_FEED_TOKEN_MISSING", 400);
    }

    const provider = this.getProviderFactory()({
      userId,
      session: brokerSession,
      onTick: (tick): void => this.handleTick(tick),
    });
    await provider.connect();

    const newSession: AngelUserSession = {
      provider,
      subscriptions: new Map<string, AngelMarketSubscription>(),
    };
    this.sessionsByUserId.set(userId, newSession);
    return newSession;
  }

  private async loadAngelMonitor(userId: string, monitorId: string): Promise<TripwireConfig & { _id?: Types.ObjectId }> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }
    if (!isValidObjectId(monitorId)) {
      throw new AppError("Invalid monitor id", 400);
    }

    const monitor = await this.getMonitorRepository().findOne({
      _id: new Types.ObjectId(monitorId),
      user: new Types.ObjectId(userId),
      isActive: true,
    }).lean().exec() as (TripwireConfig & { _id?: Types.ObjectId }) | null;

    if (!monitor) {
      throw new AppError("MONITOR_NOT_FOUND", 404);
    }
    if (monitor.provider !== "ANGEL_ONE") {
      throw new AppError("MONITOR_PROVIDER_NOT_SUPPORTED", 400);
    }
    if (!monitor.instrumentToken) {
      throw new AppError("ANGEL_SUBSCRIPTION_FAILED: monitor is missing instrument token", 400);
    }
    if (!monitor.marketType || !monitor.exchange) {
      throw new AppError("ANGEL_SUBSCRIPTION_FAILED: monitor is missing market metadata", 400);
    }

    return monitor;
  }

  private monitorToSubscription(
    userId: string,
    monitor: TripwireConfig,
  ): AngelMarketSubscription {
    if (!monitor.instrumentToken) {
      throw new AppError("ANGEL_SUBSCRIPTION_FAILED: monitor is missing instrument token", 400);
    }

    return {
      userId,
      marketType: monitor.marketType as MarketType,
      exchange: monitor.exchange as Exchange,
      symbol: monitor.symbol,
      displayName: monitor.displayName ?? monitor.symbol,
      providerSymbol: monitor.providerSymbol ?? monitor.symbol,
      instrumentToken: monitor.instrumentToken,
    };
  }

  private handleTick(tick: NormalizedMarketTick): void {
    logger.info(
      {
        event: "ANGEL_LTP_TICK",
        provider: tick.provider,
        userId: tick.userId,
        exchange: tick.exchange,
        symbol: tick.symbol,
        instrumentToken: tick.instrumentToken,
        price: tick.price,
        timestamp: tick.timestamp,
      },
      "Angel LTP tick received",
    );
    this.dependencies.onTick?.(tick);
  }

  private getMonitorRepository(): MonitorRepository {
    return this.dependencies.monitorRepository ?? TripwireConfigModel;
  }

  private getBrokerConnectionService(): Pick<BrokerConnectionService, "getActiveAngelSessionForUser"> {
    return this.dependencies.brokerConnectionService ?? new BrokerConnectionService();
  }

  private getProviderFactory(): AngelUserMarketDataSessionServiceDependencies["providerFactory"] {
    return this.dependencies.providerFactory ?? (({ userId, session, onTick }) => {
      if (!session.feedToken) {
        throw new AppError("ANGEL_FEED_TOKEN_MISSING", 400);
      }

      return new AngelMarketDataProvider({
        userId,
        clientCode: session.clientCode,
        apiKey: session.apiKey,
        jwtToken: session.jwtToken,
        feedToken: session.feedToken,
        onTick,
      });
    });
  }
}

export const sharedAngelUserMarketDataSessionService = new AngelUserMarketDataSessionService();
