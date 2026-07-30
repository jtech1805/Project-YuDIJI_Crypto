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

export const DEFAULT_FACTOR_DEFINITIONS: readonly FactorDefinition[] =
  Object.freeze([Object.freeze(marketPrice)]);
