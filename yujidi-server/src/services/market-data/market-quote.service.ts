import pino from "pino";
import { isValidObjectId, type Types } from "mongoose";

import { AppError } from "../../errors/AppError.js";
import {
  AngelQuoteService,
  type AngelQuoteResponse,
} from "../../integrations/market-data/angel/angel-quote.service.js";
import { mapAngelQuoteToMarketSnapshot } from "../../integrations/market-data/angel/angel-quote.mapper.js";
import { SymbolModel, type SymbolDocument } from "../../models/Symbol.js";
import type { MarketQuoteMode, NormalizedMarketSnapshot } from "../../types/market-data.types.js";
import {
  BrokerConnectionService,
  type ActiveAngelSession,
} from "./broker-connection.service.js";

const logger = pino({ name: "market-quote-service" });

type SymbolRepository = {
  findById: typeof SymbolModel.findById;
};

type MarketQuoteServiceDependencies = {
  symbolRepository: SymbolRepository;
  brokerConnectionService: Pick<BrokerConnectionService, "getActiveAngelSessionForUser">;
  angelQuoteService: Pick<AngelQuoteService, "fetchAngelQuote">;
};

type SymbolWithId = SymbolDocument & {
  _id?: Types.ObjectId | string | undefined;
};

const ACTIVE_SYMBOL_STATUSES = new Set(["ACTIVE", "TRADING"]);

export class MarketQuoteService {
  public constructor(
    private readonly dependencies: Partial<MarketQuoteServiceDependencies> = {},
  ) {}

  public async getQuoteForSymbol(
    userId: string,
    symbolId: string,
    mode: MarketQuoteMode = "LTP",
  ): Promise<NormalizedMarketSnapshot> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }
    if (!isValidObjectId(symbolId)) {
      throw new AppError("Invalid symbol id", 400);
    }

    const symbol = await this.getSymbolRepository().findById(symbolId).exec() as SymbolWithId | null;
    if (!symbol) {
      throw new AppError("SYMBOL_NOT_FOUND", 404);
    }

    this.assertAngelQuoteSupported(symbol);

    const session = await this.getBrokerConnectionService().getActiveAngelSessionForUser(userId);
    const quoteResponse = await this.fetchAngelQuote(symbol, session, mode);
    const fetchedQuote = quoteResponse.fetched.find((item) => {
      return item.exchange === symbol.exchange && item.symbolToken === symbol.instrumentToken;
    }) ?? quoteResponse.fetched[0];

    if (!fetchedQuote) {
      const unfetched = quoteResponse.unfetched.find((item) => {
        return item.exchange === symbol.exchange || item.symbolToken === symbol.instrumentToken;
      }) ?? quoteResponse.unfetched[0];

      if (unfetched) {
        const angelErrorCode = unfetched.errorCode ? ` (${unfetched.errorCode})` : "";
        throw new AppError(
          `ANGEL_QUOTE_UNFETCHED: Angel could not fetch quote for this symbol token.${angelErrorCode}`,
          502,
        );
      }

      throw new AppError("ANGEL_QUOTE_EMPTY_RESPONSE", 502);
    }

    logger.info(
      {
        userId,
        symbolId,
        provider: symbol.provider,
        exchange: symbol.exchange,
        mode,
      },
      "Angel quote fetched",
    );

    return mapAngelQuoteToMarketSnapshot({
      symbol,
      angelQuote: fetchedQuote,
      mode,
    });
  }

  private assertAngelQuoteSupported(symbol: SymbolWithId): void {
    if (!ACTIVE_SYMBOL_STATUSES.has(symbol.status)) {
      throw new AppError("SYMBOL_NOT_ACTIVE", 400);
    }

    if (symbol.provider !== "ANGEL_ONE") {
      throw new AppError("PROVIDER_NOT_SUPPORTED_BY_QUOTE_API_YET", 400);
    }

    if (symbol.requiresBrokerLogin !== true) {
      throw new AppError("SYMBOL_DOES_NOT_REQUIRE_BROKER_QUOTE_ACCESS", 400);
    }

    if (!symbol.exchange || !symbol.instrumentToken) {
      throw new AppError("SYMBOL_MISSING_PROVIDER_QUOTE_IDENTITY", 400);
    }
  }

  private async fetchAngelQuote(
    symbol: SymbolWithId,
    session: ActiveAngelSession,
    mode: MarketQuoteMode,
  ): Promise<AngelQuoteResponse> {
    const exchange = symbol.exchange;
    const instrumentToken = symbol.instrumentToken;
    if (!exchange || !instrumentToken) {
      throw new AppError("SYMBOL_MISSING_PROVIDER_QUOTE_IDENTITY", 400);
    }

    // TODO: Move Angel quote requests behind provider-level rate limiter before batch quote/option chain.
    return this.getAngelQuoteService().fetchAngelQuote({
      apiKey: session.apiKey,
      jwtToken: session.jwtToken,
      mode,
      exchangeTokens: {
        [exchange]: [instrumentToken],
      },
    });
  }

  private getSymbolRepository(): SymbolRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }

  private getBrokerConnectionService(): Pick<BrokerConnectionService, "getActiveAngelSessionForUser"> {
    return this.dependencies.brokerConnectionService ?? new BrokerConnectionService();
  }

  private getAngelQuoteService(): Pick<AngelQuoteService, "fetchAngelQuote"> {
    return this.dependencies.angelQuoteService ?? new AngelQuoteService();
  }
}
