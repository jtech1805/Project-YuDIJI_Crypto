import { AppError } from "../../errors/AppError.js";
import type {
  ScoringSectionDefinition,
  ScoringTemplateDefinition,
  ScoringTemplateKey,
  SystemTemplateKey,
  SystemTemplateCapabilities,
  SystemTemplateRegistration,
} from "../../types/scoring.types.js";
import type { InstrumentType, MarketType } from "../../types/market-data.types.js";

export const DEFAULT_SCORING_PERMISSION_THRESHOLDS = {
  rejectBelow: 40,
  waitBelow: 60,
  takeSmallRiskBelow: 75,
  takeTradeAtOrAbove: 75,
} as const;

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
    aggregationMode: "WEIGHTED_SUM",
    sections: [
      section("MARKET_REGIME", "Market regime", 15, [
        "INDEX_VWAP_TREND_ALIGNMENT",
        "INDEX_MULTI_TIMEFRAME_STRUCTURE",
        "MARKET_CHOPPINESS_CONTEXT",
        "VIX_STABILITY_CONTEXT",
        "MARKET_BREADTH_CONTEXT",
      ], "PARTIAL"),
      section("SECTOR_STRENGTH", "Sector strength", 10, [
        "SECTOR_RELATIVE_STRENGTH",
        "SECTOR_VWAP_CONTEXT",
        "SECTOR_TREND_CONTEXT",
        "SECTOR_BREADTH_CONTEXT",
      ], "PARTIAL"),
      section("STOCK_RELATIVE_STRENGTH", "Stock relative strength", 15, [
        "STOCK_VS_SECTOR_RS",
        "STOCK_VS_INDEX_RS",
        "STOCK_INTRADAY_STRUCTURE",
        "STOCK_KEY_LEVEL_CONTEXT",
      ], "PARTIAL"),
      section("VOLUME_RVOL", "Volume and relative volume", 15, [
        "RVOL_CONTEXT",
        "VOLUME_EXPANSION_CONTEXT",
        "CANDLE_VOLUME_CONTEXT",
        "VOLUME_DRY_UP_CONTEXT",
      ], "PARTIAL"),
      section("VWAP_LIQUIDITY", "VWAP and liquidity", 15, [
        "PRICE_VS_VWAP_CONTEXT",
        "VWAP_DISTANCE_CONTEXT",
        "VWAP_RECLAIM_HOLD_CONTEXT",
        "LIQUIDITY_FRESHNESS_CONTEXT",
        "SPREAD_DEPTH_CONTEXT",
      ], "PARTIAL"),
      section("PRICE_ACTION", "Price action", 10, [
        "SETUP_TYPE_CONTEXT",
        "ENTRY_LEVEL_CONTEXT",
        "STOPLOSS_STRUCTURE_CONTEXT",
        "CANDLE_CONFIRMATION_CONTEXT",
        "NEARBY_LEVEL_BLOCK_CONTEXT",
      ], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 20, [
        "DIRECTION_GEOMETRY",
        "REWARD_RISK_RATIO",
        "TRADE_MANAGEMENT_LEVELS",
      ], "BLOCK"),
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
      section("MARKET_REGIME", "Market regime", 20, ["INDEX_VWAP_TREND_ALIGNMENT"], "PARTIAL"),
      section("SECTOR_STRENGTH", "Sector strength", 20, ["SECTOR_STRENGTH_CONTEXT"], "PARTIAL"),
      section("VOLUME_CONTEXT", "Volume context", 20, ["RVOL_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"], "PARTIAL"),
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
      section("SYMBOL_TREND_CONTEXT", "Symbol trend context", 20, ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT"], "PARTIAL"),
      section("VOLUME_ORDER_FLOW", "Volume and order flow", 20, ["RVOL_CONTEXT", "CVD_CONTEXT"], "PARTIAL"),
      section("LIQUIDITY_CONTEXT", "Liquidity context", 20, ["LIQUIDITY_FRESHNESS_CONTEXT", "ORDER_BOOK_CONTEXT"], "PARTIAL"),
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
      section("SYMBOL_TREND_CONTEXT", "Symbol trend context", 15, ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT"], "PARTIAL"),
      section("VOLUME_ORDER_FLOW", "Volume and order flow", 20, ["RVOL_CONTEXT", "CVD_CONTEXT"], "PARTIAL"),
      section("LIQUIDITY_CONTEXT", "Liquidity context", 15, ["LIQUIDITY_FRESHNESS_CONTEXT", "ORDER_BOOK_CONTEXT"], "PARTIAL"),
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
      section("MARKET_CONTEXT", "Market context", 20, ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT"], "PARTIAL"),
      section("VOLATILITY_LIQUIDITY_CONTEXT", "Volatility and liquidity", 20, ["RVOL_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
  {
    key: "INDIA_FNO_FUTURE_INTRADAY_V1",
    version: 1,
    marketType: "FNO",
    tradeStyle: "INTRADAY",
    instrumentType: "FUTURE",
    maxScore: 100,
    sections: [
      section("CONTRACT_SANITY", "Contract sanity", 20, ["SYMBOL_METADATA_SANITY"], "PARTIAL"),
      section("MARKET_CONTEXT", "Market context", 20, ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT"], "PARTIAL"),
      section("LIQUIDITY_CONTEXT", "Liquidity context", 20, ["RVOL_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
  {
    key: "INDIA_FNO_OPTION_INTRADAY_V1",
    version: 1,
    marketType: "FNO",
    tradeStyle: "INTRADAY",
    instrumentType: "OPTION",
    maxScore: 100,
    sections: [
      section("CONTRACT_SANITY", "Contract sanity", 20, ["SYMBOL_METADATA_SANITY"], "PARTIAL"),
      section("MARKET_CONTEXT", "Market context", 20, ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT"], "PARTIAL"),
      section("LIQUIDITY_CONTEXT", "Liquidity context", 20, ["RVOL_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"], "PARTIAL"),
      section("RISK_REWARD", "Risk and reward", 40, ["REWARD_RISK_RATIO"], "BLOCK"),
    ],
  },
  {
    key: "CRYPTO_BTC_ETF_FLOW_DAILY_V1",
    version: 1,
    marketType: "CRYPTO",
    tradeStyle: "DAILY",
    instrumentType: "SPOT",
    maxScore: 100,
    aggregationMode: "WEIGHTED_SUM",
    sections: [
      section("ETF_FLOW_CONTEXT", "BTC ETF-flow context", 100, [
        "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW",
      ], "BLOCK"),
    ],
  },
];

const publicCapabilities: SystemTemplateCapabilities = Object.freeze({
  listable: true,
  scoreCheckSelectable: true,
  duplicable: true,
  compileEligible: false,
});

const registrations: readonly SystemTemplateRegistration[] = Object.freeze(templates.map((template) => Object.freeze({
  template: structuredClone(template),
  capabilities: template.key === "CRYPTO_BTC_ETF_FLOW_DAILY_V1"
    ? Object.freeze({ listable: false, scoreCheckSelectable: false, duplicable: false, compileEligible: true })
    : publicCapabilities,
})));

export class ScoringTemplateRegistryService {
  private readonly templates = new Map(
    registrations.map((registration) => [`${registration.template.key}:${registration.template.version}`, registration]),
  );

  public get(key: ScoringTemplateKey, version = 1): ScoringTemplateDefinition & { key: ScoringTemplateKey } {
    return this.getForScoreCheck(key, version);
  }

  public list(): Array<ScoringTemplateDefinition & { key: ScoringTemplateKey }> {
    return [...this.templates.values()]
      .filter((registration) => registration.capabilities.listable)
      .map((registration) => structuredClone(registration.template) as ScoringTemplateDefinition & { key: ScoringTemplateKey });
  }

  public getExact(key: SystemTemplateKey, version = 1): SystemTemplateRegistration {
    const registration = this.templates.get(`${key}:${version}`);
    if (!registration) throw new AppError("UNSUPPORTED_TEMPLATE", 400);
    return deepFreeze(structuredClone(registration));
  }

  public getForScoreCheck(key: ScoringTemplateKey, version = 1): ScoringTemplateDefinition & { key: ScoringTemplateKey } {
    return this.getWithCapability(key, version, "scoreCheckSelectable") as ScoringTemplateDefinition & { key: ScoringTemplateKey };
  }

  public getForDuplication(key: ScoringTemplateKey, version = 1): ScoringTemplateDefinition & { key: ScoringTemplateKey } {
    return this.getWithCapability(key, version, "duplicable") as ScoringTemplateDefinition & { key: ScoringTemplateKey };
  }

  public getForCompilation(key: SystemTemplateKey, version = 1): ScoringTemplateDefinition {
    return this.getWithCapability(key, version, "compileEligible");
  }

  private getWithCapability(key: SystemTemplateKey, version: number, capability: keyof SystemTemplateCapabilities): ScoringTemplateDefinition {
    const registration = this.getExact(key, version);
    if (!registration.capabilities[capability]) throw new AppError("SCORING_TEMPLATE_NOT_ELIGIBLE", 400);
    return structuredClone(registration.template);
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

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};
