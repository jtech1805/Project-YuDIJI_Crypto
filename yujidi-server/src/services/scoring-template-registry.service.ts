import { AppError } from "../errors/AppError.js";
import type {
  ScoringSectionDefinition,
  ScoringTemplateDefinition,
  ScoringTemplateKey,
} from "../types/scoring.types.js";
import type { InstrumentType, MarketType } from "../types/market-data.types.js";

const section = (
  key: string,
  label: string,
  weight: number,
  evaluators: string[],
  missingDataPolicy: ScoringSectionDefinition["missingDataPolicy"],
): ScoringSectionDefinition => ({ key, label, weight, evaluators, missingDataPolicy });

const templates: ScoringTemplateDefinition[] = [
  {
    key: "INDIA_EQUITY_INTRADAY_V1",
    version: 1,
    marketType: "EQUITY",
    tradeStyle: "INTRADAY",
    instrumentType: "CASH",
    maxScore: 100,
    sections: [
      section("MARKET_REGIME", "Market regime", 15, ["MARKET_REGIME_CONTEXT"], "PARTIAL"),
      section("SECTOR_STRENGTH", "Sector strength", 15, ["SECTOR_STRENGTH_CONTEXT"], "PARTIAL"),
      section("VWAP_LIQUIDITY", "VWAP and liquidity", 15, ["VWAP_CONTEXT"], "PARTIAL"),
      section("VOLUME_CONTEXT", "Volume context", 15, ["VOLUME_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
  {
    key: "INDIA_EQUITY_SWING_V1",
    version: 1,
    marketType: "EQUITY",
    tradeStyle: "SWING",
    instrumentType: "CASH",
    maxScore: 100,
    sections: [
      section("MARKET_REGIME", "Market regime", 20, ["MARKET_REGIME_CONTEXT"], "PARTIAL"),
      section("SECTOR_STRENGTH", "Sector strength", 20, ["SECTOR_STRENGTH_CONTEXT"], "PARTIAL"),
      section("VOLUME_CONTEXT", "Volume context", 20, ["VOLUME_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
  {
    key: "CRYPTO_SPOT_INTRADAY_V1",
    version: 1,
    marketType: "CRYPTO",
    tradeStyle: "INTRADAY",
    instrumentType: "SPOT",
    maxScore: 100,
    sections: [
      section("SYMBOL_TREND_CONTEXT", "Symbol trend context", 20, ["PRICE_BUFFER_CONTEXT"], "PARTIAL"),
      section("VOLUME_ORDER_FLOW", "Volume and order flow", 20, ["VOLUME_CONTEXT", "CVD_CONTEXT"], "PARTIAL"),
      section("LIQUIDITY_CONTEXT", "Liquidity context", 20, ["ORDER_BOOK_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
  {
    key: "CRYPTO_PERPETUAL_INTRADAY_V1",
    version: 1,
    marketType: "CRYPTO",
    tradeStyle: "INTRADAY",
    instrumentType: "FUTURE",
    maxScore: 100,
    sections: [
      section("SYMBOL_TREND_CONTEXT", "Symbol trend context", 15, ["PRICE_BUFFER_CONTEXT"], "PARTIAL"),
      section("VOLUME_ORDER_FLOW", "Volume and order flow", 20, ["VOLUME_CONTEXT", "CVD_CONTEXT"], "PARTIAL"),
      section("LIQUIDITY_CONTEXT", "Liquidity context", 15, ["ORDER_BOOK_CONTEXT"], "PARTIAL"),
      section("DERIVATIVES_CONTEXT", "Derivatives context", 10, ["FUNDING_OPEN_INTEREST_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
  {
    key: "COMMODITY_MCX_INTRADAY_V1",
    version: 1,
    marketType: "COMMODITY",
    tradeStyle: "INTRADAY",
    instrumentType: "FUTURE",
    maxScore: 100,
    sections: [
      section("CONTRACT_SANITY", "Contract sanity", 20, ["COMMODITY_CONTRACT_SANITY"], "PARTIAL"),
      section("MARKET_CONTEXT", "Market context", 20, ["MARKET_REGIME_CONTEXT"], "PARTIAL"),
      section("VOLATILITY_LIQUIDITY_CONTEXT", "Volatility and liquidity", 20, ["VOLUME_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
];

export class ScoringTemplateRegistryService {
  private readonly templates = new Map(
    templates.map((template) => [`${template.key}:${template.version}`, template]),
  );

  public get(key: ScoringTemplateKey, version = 1): ScoringTemplateDefinition {
    const template = this.templates.get(`${key}:${version}`);
    if (!template) throw new AppError("UNSUPPORTED_TEMPLATE", 400);
    return structuredClone(template);
  }

  public validateCompatibility(input: {
    template: ScoringTemplateDefinition;
    marketType: MarketType;
    tradeStyle: string;
    instrumentType: InstrumentType;
  }): void {
    if (
      input.template.marketType !== input.marketType
      || input.template.tradeStyle !== input.tradeStyle.trim().toUpperCase()
      || input.template.instrumentType !== input.instrumentType
    ) {
      throw new AppError("SCORING_TEMPLATE_SCOPE_MISMATCH", 400);
    }
  }
}
