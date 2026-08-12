import type { CompiledRulebookAggregationPolicyDefinition } from "../../types/compiled-rulebook-aggregation-policy.types.js";
import type { CompiledRulebookAggregationResult, CompiledRulebookBindingOutcome } from "../../types/compiled-rulebook-runtime.types.js";
import { CompiledBindingDispositionService } from "./compiled-binding-disposition.service.js";
import { CompiledRulebookPolicyConsistencyService } from "./compiled-rulebook-policy-consistency.service.js";
export class CompiledRulebookAggregationService {
  public constructor(private readonly dispositions = new CompiledBindingDispositionService(), private readonly consistency = new CompiledRulebookPolicyConsistencyService()) {}
  public aggregate(request: unknown): CompiledRulebookAggregationResult {
    if (!record(request) || !validPolicy(request.policy)) return failed("INVALID_COMPILED_AGGREGATION_POLICY");
    if (!Array.isArray(request.outcomes) || request.outcomes.length === 0 || !request.outcomes.every((_, index) => index in request.outcomes)) return failed("INVALID_COMPILED_BINDING_OUTCOME");
    const outcomes = request.outcomes as readonly unknown[];
    if (!outcomes.every(validOutcome)) return failed("INVALID_COMPILED_BINDING_OUTCOME");
    if (!outcomes.every((outcome, index) => outcome.binding.order === index)) return failed("INVALID_BINDING_ORDER");
    const consistency = this.consistency.validate(outcomes.map((outcome) => outcome.binding));
    if (!consistency.consistent) return failed(consistency.code === "INVALID_BINDING_COLLECTION" ? "INVALID_COMPILED_BINDING_OUTCOME" : consistency.code);
    if (consistency.lineage.aggregationPolicyId !== request.policy.policyId || consistency.lineage.aggregationPolicyVersion !== request.policy.policyVersion) return failed("INCONSISTENT_AGGREGATION_POLICY_LINEAGE");
    let numerator = 0; let includedWeight = 0; let partial = false; let blocked = false;
    for (const outcome of outcomes) {
      const weight = outcome.binding.weight;
      if (!Number.isFinite(weight) || weight <= 0 || weight > 100) return failed("INVALID_BINDING_WEIGHT");
      const derived = this.dispositions.derive(outcome.binding, outcome.inputState);
      if (!derived.derived) return failed(derived.code);
      if (derived.disposition === "BLOCKING") { blocked = true; continue; }
      if (derived.disposition === "OMITTED") continue;
      includedWeight += weight;
      if (!Number.isFinite(includedWeight)) return failed("INVALID_BINDING_WEIGHT");
      if (derived.disposition === "PARTIAL") { partial = true; continue; }
      if (!Number.isFinite(outcome.normalizedScore)) return failed("INVALID_BINDING_SCORE");
      numerator += (outcome.normalizedScore as number) * weight;
      if (!Number.isFinite(numerator)) return failed("INVALID_BINDING_SCORE");
    }
    if (blocked) return Object.freeze({ aggregated: false, status: "BLOCKED", numerator: null, includedWeight, aggregate: null, code: "MANDATORY_BINDING_BLOCKED" });
    if (includedWeight === 0) return Object.freeze({ aggregated: false, status: "INSUFFICIENT_INPUT", numerator, includedWeight, aggregate: null, code: "INSUFFICIENT_INCLUDED_WEIGHT" });
    return Object.freeze({ aggregated: true, status: partial ? "PARTIAL" : "COMPLETED", numerator, includedWeight, aggregate: numerator / includedWeight, partial });
  }
}
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const validPolicy = (value: unknown): value is CompiledRulebookAggregationPolicyDefinition => record(value) && value.strategy === "COMPILED_WEIGHTED_MEAN" && value.partialWeightBehavior === "RETAIN_IN_DENOMINATOR" && value.omittedWeightBehavior === "REMOVE_FROM_DENOMINATOR" && value.compileEligible === true;
const validOutcome = (value: unknown): value is CompiledRulebookBindingOutcome => record(value) && record(value.binding) && typeof value.binding.bindingId === "string" && Number.isSafeInteger(value.binding.order) && typeof value.inputState === "string" && (value.normalizedScore === null || typeof value.normalizedScore === "number");
const failed = (code: Extract<CompiledRulebookAggregationResult, { aggregated: false }>["code"]): CompiledRulebookAggregationResult => Object.freeze({ aggregated: false, status: "FAILED", numerator: null, includedWeight: 0, aggregate: null, code });
