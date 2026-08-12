import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../../errors/AppError.js";
import { SymbolModel } from "../../models/Symbol.js";
import {
  type Exchange,
  type MarketProvider,
  type MarketType,
  type SupportedBroker,
} from "../../types/market-data.types.js";
import { buildMarketSubscriptionKey } from "../../utils/market-subscription-key.js";
import {
  BrokerConnectionService,
  type SupportedBrokerConnection,
} from "./broker-connection.service.js";

const ACTIVE_SYMBOL_STATUSES = ["ACTIVE", "TRADING"];

export type ResolvedMarketSubscription = {
  symbolId: string;
  symbol: string;
  displayName: string;
  provider: MarketProvider;
  marketType: MarketType;
  exchange: Exchange;
  instrumentToken: string;
  providerSymbol: string;
  requiresBrokerLogin: boolean;
  supportedBroker: SupportedBroker;
  subscriptionKey: string;
};

type SymbolRepository = {
  findOne: typeof SymbolModel.findOne;
};

type MarketSubscriptionResolverDependencies = {
  symbolRepository: SymbolRepository;
  brokerConnectionService: Pick<BrokerConnectionService, "hasActiveBrokerConnection">;
};

export class MarketSubscriptionResolver {
  public constructor(
    private readonly dependencies: Partial<MarketSubscriptionResolverDependencies> = {},
  ) {}

  public async resolveSubscription(
    userId: string,
    incomingSymbol: string,
  ): Promise<ResolvedMarketSubscription> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }

    const normalizedSymbol = incomingSymbol.trim().toUpperCase();
    const symbol = await this.getSymbolRepository().findOne({
      symbol: normalizedSymbol,
      status: { $in: ACTIVE_SYMBOL_STATUSES },
    }).lean().exec() as (Record<string, unknown> & { _id?: Types.ObjectId }) | null;

    if (!symbol) {
      throw new AppError("SYMBOL_NOT_FOUND", 404);
    }

    const provider = symbol.provider as MarketProvider | undefined;
    const marketType = symbol.marketType as MarketType | undefined;
    const exchange = symbol.exchange as Exchange | undefined;
    const instrumentToken = typeof symbol.instrumentToken === "string"
      ? symbol.instrumentToken
      : normalizedSymbol;
    const providerSymbol = typeof symbol.providerSymbol === "string"
      ? symbol.providerSymbol
      : normalizedSymbol;
    const supportedBroker = (symbol.supportedBroker as SupportedBroker | undefined) ?? "NONE";
    const requiresBrokerLogin = symbol.requiresBrokerLogin === true;

    if (!provider || !marketType || !exchange || !instrumentToken) {
      throw new AppError("INVALID_SYMBOL_SELECTION", 400);
    }

    if (provider === "KITE") {
      throw new AppError("PROVIDER_NOT_SUPPORTED", 400);
    }

    if (requiresBrokerLogin) {
      if (supportedBroker !== "ANGEL_ONE" && supportedBroker !== "KITE") {
        throw new AppError("PROVIDER_NOT_SUPPORTED", 400);
      }

      const hasBrokerConnection = await this.getBrokerConnectionService().hasActiveBrokerConnection(
        userId,
        supportedBroker as SupportedBrokerConnection,
      );
      if (!hasBrokerConnection) {
        throw new AppError("BROKER_LOGIN_REQUIRED", 400);
      }
    }

    const subscriptionKey = buildMarketSubscriptionKey({
      provider,
      ...(provider === "ANGEL_ONE" ? { userId } : {}),
      exchange,
      instrumentToken,
    });

    return {
      symbolId: symbol._id?.toString() ?? "",
      symbol: normalizedSymbol,
      displayName: typeof symbol.displayName === "string" ? symbol.displayName : normalizedSymbol,
      provider,
      marketType,
      exchange,
      instrumentToken,
      providerSymbol,
      requiresBrokerLogin,
      supportedBroker,
      subscriptionKey,
    };
  }

  private getSymbolRepository(): SymbolRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }

  private getBrokerConnectionService(): Pick<BrokerConnectionService, "hasActiveBrokerConnection"> {
    return this.dependencies.brokerConnectionService ?? new BrokerConnectionService();
  }
}
