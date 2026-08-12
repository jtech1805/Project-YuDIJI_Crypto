import assert from "node:assert/strict";
import test from "node:test";
import { GenericRelationshipFactorEvaluator } from "../../../src/services/scoring/generic-relationship-factor-evaluator.js";
import { calculateGenericRelationship } from "../../../src/services/scoring/generic-relationship-calculation-core.js";
import type { AssembledFactorInput } from "../../../src/types/factor-input-assembly.types.js";

const configuration = (relationshipType: "DIRECT" | "INVERSE") => ({ relationshipType, expectedUnit: "USD", thresholds: { strongNegativeMax: -300, negativeMax: -100, positiveMin: 100, strongPositiveMin: 300 }, contributions: { strongNegative: -2, negative: -1, neutral: 0, positive: 1, strongPositive: 2 }, minimumPoints: -2, maximumPoints: 2 });
const input = (value: number): AssembledFactorInput => ({ factorKey: "CRYPTO.ETF_NET_FLOW", factorDefinitionVersion: 1, subject: { type: "ASSET", key: "BTC" }, evidenceId: "E1", value: { type: "NUMBER", value, unit: "USD" }, source: { sourceType: "TEST", provider: "TEST", sourceId: "TEST", priority: null }, observedAt: new Date("2026-01-01T00:00:00Z"), evaluatedAt: new Date("2026-01-01T01:00:00Z"), confidence: 1, freshness: { status: "FRESH", ageMs: 3600000, maxAgeMs: 86400000 } });

test("shared core is byte-for-byte identical to legacy evaluator domain behavior", () => {
  for (const relationship of ["DIRECT", "INVERSE"] as const) for (const value of [-400, -200, 0, 200, 400]) {
    const legacy = new GenericRelationshipFactorEvaluator(configuration(relationship)).evaluate(input(value));
    const core = calculateGenericRelationship({ configuration: configuration(relationship), factorKey: "CRYPTO.ETF_NET_FLOW", valueType: "NUMBER", value, unit: "USD" });
    assert(legacy.evaluated && core.calculated);
    assert.deepEqual({ outcome: legacy.result.outcome, contribution: legacy.result.contribution, reasonCode: legacy.result.reasonCode, diagnostics: legacy.result.diagnostics },
      { outcome: core.outcome, contribution: core.contribution, reasonCode: core.reasonCode, diagnostics: core.diagnostics });
  }
});

