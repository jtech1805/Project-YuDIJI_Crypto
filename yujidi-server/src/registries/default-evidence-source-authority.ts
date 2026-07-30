import type { EvidenceSourceAuthorityRule } from "../types/evidence-source-resolution.types.js";

export const DEFAULT_EVIDENCE_SOURCE_AUTHORITY_RULES:
readonly EvidenceSourceAuthorityRule[] = Object.freeze([
  Object.freeze({
    factorKey: "MARKET.PRICE",
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    priority: 100,
  }),
]);
