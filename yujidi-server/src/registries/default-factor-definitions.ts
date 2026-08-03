import type { FactorDefinition } from "../types/factor-registry.types.js";

const marketPrice: FactorDefinition = {
  factorKey: "MARKET.PRICE",
  version: 1,
  displayName: "Market Price",
  description: "Latest observed tradable market price for an instrument.",
  status: "ACTIVE",
  valueTypes: Object.freeze(["NUMBER"]),
  subjectTypes: Object.freeze(["INSTRUMENT"]),
  unit: Object.freeze({ policy: "REQUIRED" }),
  freshness: Object.freeze({
    kind: "MAX_AGE",
    maxAgeMs: 10_000,
  }),
  scoringEligibility: "ELIGIBLE",
};

const cryptoEtfNetFlow: FactorDefinition = {
  factorKey: "CRYPTO.ETF_NET_FLOW",
  version: 1,
  displayName: "Crypto ETF Net Flow",
  description: "Net daily flow into exchange-traded funds for a crypto asset.",
  status: "ACTIVE",
  valueTypes: Object.freeze(["NUMBER"]),
  subjectTypes: Object.freeze(["ASSET"]),
  unit: Object.freeze({ policy: "ALLOW_LIST", allowedUnits: Object.freeze(["USD"]) }),
  freshness: Object.freeze({ kind: "MAX_AGE", maxAgeMs: 86_400_000 }),
  scoringEligibility: "ELIGIBLE",
};

export const DEFAULT_FACTOR_DEFINITIONS: readonly FactorDefinition[] =
  Object.freeze([Object.freeze(marketPrice), Object.freeze(cryptoEtfNetFlow)]);
