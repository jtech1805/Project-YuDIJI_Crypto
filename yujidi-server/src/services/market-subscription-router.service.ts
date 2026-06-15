import { AppError } from "../errors/AppError.js";
import {
  sharedAngelUserMarketDataSessionService,
  type AngelUserMarketDataSessionService,
} from "./angel-user-market-data-session.service.js";
import type { ResolvedMarketSubscription } from "./market-subscription-resolver.service.js";

type MarketSubscriptionRouterDependencies = {
  angelSessionService: Pick<
    AngelUserMarketDataSessionService,
    "subscribeResolvedAngelSubscription" | "unsubscribeResolvedAngelSubscription"
  >;
  binanceSubscribe: (subscription: ResolvedMarketSubscription) => void;
  binanceUnsubscribe: (subscription: ResolvedMarketSubscription) => void;
};

export class MarketSubscriptionRouter {
  public constructor(
    private readonly dependencies: Partial<MarketSubscriptionRouterDependencies> = {},
  ) {}

  public async subscribe(
    userId: string,
    subscription: ResolvedMarketSubscription,
  ): Promise<void> {
    if (subscription.provider === "BINANCE") {
      this.dependencies.binanceSubscribe?.(subscription);
      return;
    }

    if (subscription.provider === "ANGEL_ONE") {
      if (subscription.exchange !== "MCX" || subscription.marketType !== "COMMODITY") {
        throw new AppError("PROVIDER_NOT_SUPPORTED", 400);
      }

      await this.getAngelSessionService().subscribeResolvedAngelSubscription({
        userId,
        subscriptionKey: subscription.subscriptionKey,
        marketType: "COMMODITY",
        exchange: "MCX",
        symbol: subscription.symbol,
        displayName: subscription.displayName,
        providerSymbol: subscription.providerSymbol,
        instrumentToken: subscription.instrumentToken,
      });
      return;
    }

    throw new AppError("PROVIDER_NOT_SUPPORTED", 400);
  }

  public async unsubscribe(
    userId: string,
    subscription: ResolvedMarketSubscription,
  ): Promise<void> {
    if (subscription.provider === "BINANCE") {
      this.dependencies.binanceUnsubscribe?.(subscription);
      return;
    }

    if (subscription.provider === "ANGEL_ONE") {
      if (subscription.exchange !== "MCX" || subscription.marketType !== "COMMODITY") {
        throw new AppError("PROVIDER_NOT_SUPPORTED", 400);
      }

      await this.getAngelSessionService().unsubscribeResolvedAngelSubscription({
        userId,
        subscriptionKey: subscription.subscriptionKey,
        marketType: "COMMODITY",
        exchange: "MCX",
        symbol: subscription.symbol,
        displayName: subscription.displayName,
        providerSymbol: subscription.providerSymbol,
        instrumentToken: subscription.instrumentToken,
      });
      return;
    }

    throw new AppError("PROVIDER_NOT_SUPPORTED", 400);
  }

  private getAngelSessionService(): Pick<
    AngelUserMarketDataSessionService,
    "subscribeResolvedAngelSubscription" | "unsubscribeResolvedAngelSubscription"
  > {
    return this.dependencies.angelSessionService ?? sharedAngelUserMarketDataSessionService;
  }
}
