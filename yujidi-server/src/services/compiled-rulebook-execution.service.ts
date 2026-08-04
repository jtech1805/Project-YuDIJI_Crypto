import type { VersionedCompiledRulebookAggregationPolicyRegistry } from "../types/compiled-rulebook-aggregation-policy.types.js";
import type { CompiledBindingExecutionResult, CompiledBindingExecutionServiceResult } from "../types/compiled-binding-execution.types.js";
import { MAX_COMPILED_EXECUTION_OBSERVATIONS, type CompiledExecutionRequest } from "../types/compiled-execution-request.types.js";
import type { CompiledExecutionFailureCode, CompiledExecutionResult } from "../types/compiled-rulebook-execution.types.js";
import type { CompiledRulebookDefinition } from "../types/compiled-rulebook.types.js";
import type { VersionedDecisionBandPolicyRegistry } from "../types/versioned-decision-band-policy.types.js";
import type { VersionedNormalizationPolicyRegistry } from "../types/versioned-normalization-policy.types.js";
import type { CompiledShadowInputAssemblyResult } from "../types/resolved-execution-input.types.js";
import { CompiledBindingDispositionService } from "./compiled-binding-disposition.service.js";
import type { CompiledBindingExecutionService } from "./compiled-binding-execution.service.js";
import { CompiledRulebookAggregationService } from "./compiled-rulebook-aggregation.service.js";
import { CompiledRulebookContractValidationService } from "./compiled-rulebook-contract-validation.service.js";
import { CompiledRulebookDecisionClassificationService } from "./compiled-rulebook-decision-classification.service.js";
import { compatible, CompiledRulebookNormalizationService } from "./compiled-rulebook-normalization.service.js";
import { CompiledRulebookPolicyConsistencyService } from "./compiled-rulebook-policy-consistency.service.js";
import type { CompiledShadowInputAssemblyService } from "./compiled-shadow-input-assembly.service.js";

export type CompiledRulebookExecutionDependencies = Readonly<{
  preparation: Pick<CompiledShadowInputAssemblyService, "assemble">; bindings: Pick<CompiledBindingExecutionService, "fromPreparation">;
  aggregationPolicies: Pick<VersionedCompiledRulebookAggregationPolicyRegistry, "getExact">; normalizationPolicies: Pick<VersionedNormalizationPolicyRegistry, "getExact">; decisionBandPolicies: Pick<VersionedDecisionBandPolicyRegistry, "getExact">;
  validator?: CompiledRulebookContractValidationService; consistency?: CompiledRulebookPolicyConsistencyService; aggregation?: CompiledRulebookAggregationService; normalization?: CompiledRulebookNormalizationService; classification?: CompiledRulebookDecisionClassificationService; dispositions?: CompiledBindingDispositionService;
}>;

export class CompiledRulebookExecutionService {
  private readonly validator; private readonly consistency; private readonly aggregation; private readonly normalization; private readonly classification; private readonly dispositions;
  public constructor(private readonly d: CompiledRulebookExecutionDependencies) {
    this.validator = d.validator ?? new CompiledRulebookContractValidationService(); this.consistency = d.consistency ?? new CompiledRulebookPolicyConsistencyService();
    this.aggregation = d.aggregation ?? new CompiledRulebookAggregationService(); this.normalization = d.normalization ?? new CompiledRulebookNormalizationService();
    this.classification = d.classification ?? new CompiledRulebookDecisionClassificationService(); this.dispositions = d.dispositions ?? new CompiledBindingDispositionService();
  }
  public execute(rulebookInput: unknown, requestInput: unknown): CompiledExecutionResult {
    const checked = this.validator.validate({ rulebook: rulebookInput });
    if (!checked.valid) return result(null, null, [], "FAILED", "INVALID_COMPILED_RULEBOOK");
    const rulebook = checked.rulebook;
    if (!validRequest(requestInput)) return result(rulebook, null, [], "FAILED", "INVALID_EXECUTION_REQUEST");
    const request = requestInput;
    if (!same(request.rulebook, rulebook.identity)) return result(rulebook, request, [], "FAILED", "RULEBOOK_IDENTITY_MISMATCH");
    const structural = validateBindings(rulebook);
    if (structural) return result(rulebook, request, [], "FAILED", structural);
    const policies = this.consistency.validate(rulebook.factorBindings);
    if (!policies.consistent) return result(rulebook, request, [], "FAILED", policies.code);
    const lineage = policies.lineage; const factor = rulebook.factorBindings[0]!.factor;
    if (!rulebook.factorBindings.every((b) => same(b.factor, factor))) return result(rulebook, request, [], "FAILED", "MIXED_FACTOR_RULEBOOK_NOT_SUPPORTED", null, lineage);
    let aggregationPolicy; try { aggregationPolicy = this.d.aggregationPolicies.getExact(lineage.aggregationPolicyId, lineage.aggregationPolicyVersion); } catch { aggregationPolicy = null; }
    if (!aggregationPolicy) return result(rulebook, request, [], "FAILED", "COMPILED_AGGREGATION_POLICY_NOT_FOUND", null, lineage);
    if (!aggregationPolicy.compileEligible) return result(rulebook, request, [], "FAILED", "COMPILED_AGGREGATION_POLICY_NOT_COMPILE_ELIGIBLE", null, lineage);
    if (aggregationPolicy.policyId !== lineage.aggregationPolicyId || aggregationPolicy.policyVersion !== lineage.aggregationPolicyVersion || aggregationPolicy.strategy !== "COMPILED_WEIGHTED_MEAN" || aggregationPolicy.partialWeightBehavior !== "RETAIN_IN_DENOMINATOR" || aggregationPolicy.omittedWeightBehavior !== "REMOVE_FROM_DENOMINATOR") return result(rulebook, request, [], "FAILED", "INVALID_COMPILED_AGGREGATION_POLICY", null, lineage);
    let normalizationPolicy; try { normalizationPolicy = this.d.normalizationPolicies.getExact(lineage.normalizationPolicyId, lineage.normalizationPolicyVersion); } catch { normalizationPolicy = null; }
    if (!normalizationPolicy) return result(rulebook, request, [], "FAILED", "NORMALIZATION_POLICY_NOT_FOUND", null, lineage);
    if (!normalizationPolicy.compileEligible) return result(rulebook, request, [], "FAILED", "NORMALIZATION_POLICY_NOT_COMPILE_ELIGIBLE", null, lineage);
    const np = normalizationPolicy.definition;
    if (np.normalizationPolicyId !== lineage.normalizationPolicyId || np.normalizationPolicyVersion !== lineage.normalizationPolicyVersion) return result(rulebook, request, [], "FAILED", "NORMALIZATION_POLICY_LINEAGE_MISMATCH", null, lineage);
    if (np.factorKey !== factor.factorKey) return result(rulebook, request, [], "FAILED", "NORMALIZATION_POLICY_FACTOR_MISMATCH", null, lineage);
    if (np.targetRange.minimumScore !== 0 || np.targetRange.neutralScore !== 50 || np.targetRange.maximumScore !== 100) return result(rulebook, request, [], "FAILED", "NORMALIZATION_POLICY_TARGET_RANGE_MISMATCH", null, lineage);
    if (!compatible(normalizationPolicy, lineage, factor.factorKey)) return result(rulebook, request, [], "FAILED", "NORMALIZATION_POLICY_RUNTIME_INCOMPATIBLE", null, lineage);
    let decisionPolicy; try { decisionPolicy = this.d.decisionBandPolicies.getExact(lineage.decisionBandPolicyId, lineage.decisionBandPolicyVersion); } catch { decisionPolicy = null; }
    if (!decisionPolicy) return result(rulebook, request, [], "FAILED", "DECISION_BAND_POLICY_NOT_FOUND", null, lineage);
    if (!decisionPolicy.compileEligible) return result(rulebook, request, [], "FAILED", "DECISION_BAND_POLICY_NOT_COMPILE_ELIGIBLE", null, lineage);
    const dp = decisionPolicy.definition;
    if (dp.decisionBandPolicyId !== lineage.decisionBandPolicyId || dp.decisionBandPolicyVersion !== lineage.decisionBandPolicyVersion || dp.normalizationPolicyId !== lineage.normalizationPolicyId || dp.normalizationPolicyVersion !== lineage.normalizationPolicyVersion) return result(rulebook, request, [], "FAILED", "DECISION_BAND_POLICY_LINEAGE_MISMATCH", null, lineage);
    if (dp.factorKey !== factor.factorKey) return result(rulebook, request, [], "FAILED", "DECISION_BAND_POLICY_FACTOR_MISMATCH", null, lineage);
    if (dp.normalizedRange.minimumScore !== 0 || dp.normalizedRange.maximumScore !== 100) return result(rulebook, request, [], "FAILED", "DECISION_BAND_POLICY_RANGE_MISMATCH", null, lineage);
    const traces: CompiledBindingExecutionResult[] = [];
    for (const binding of rulebook.factorBindings) {
      let prep: CompiledShadowInputAssemblyResult; try { prep = this.d.preparation.assemble({ execution: request, binding }); } catch { return result(rulebook, request, traces, "FAILED", "BINDING_PREPARATION_INVARIANT_FAILED", null, lineage, binding.order); }
      if (!prep || typeof prep !== "object" || typeof prep.resolved !== "boolean") return result(rulebook, request, traces, "FAILED", "BINDING_PREPARATION_INVARIANT_FAILED", null, lineage, binding.order);
      let executed: CompiledBindingExecutionServiceResult; try { executed = this.d.bindings.fromPreparation({ rulebook: rulebook.identity, binding, preparation: prep }); } catch { return result(rulebook, request, traces, "FAILED", "BINDING_EXECUTION_INVARIANT_FAILED", null, lineage, binding.order); }
      if (!executed.produced) return result(rulebook, request, traces, "FAILED", "BINDING_EXECUTION_INVARIANT_FAILED", executed.code, lineage, binding.order);
      const invariant = validateTrace(executed.result, rulebook, binding, this.dispositions);
      if (invariant) return result(rulebook, request, traces, "FAILED", invariant, null, lineage, binding.order);
      traces.push(executed.result);
    }
    let aggregation; try { aggregation = this.aggregation.aggregate({ policy: aggregationPolicy, outcomes: traces.map((t) => ({ binding: t.binding, inputState: t.inputState, normalizedScore: t.disposition === "INCLUDED" ? t.bindingScore : null })) }); } catch { return result(rulebook, request, traces, "FAILED", "COMPILED_AGGREGATION_FAILED", null, lineage); }
    if (!aggregation.aggregated) {
      if (aggregation.status === "BLOCKED") return result(rulebook, request, traces, "BLOCKED", null, aggregation.code, lineage, null, aggregation);
      if (aggregation.status === "INSUFFICIENT_INPUT") return result(rulebook, request, traces, "INSUFFICIENT_INPUT", null, aggregation.code, lineage, null, aggregation);
      return result(rulebook, request, traces, "FAILED", "COMPILED_AGGREGATION_FAILED", aggregation.code, lineage, null, aggregation);
    }
    const normalized = this.normalization.project({ aggregate: aggregation.aggregate, lineage, factor, policy: normalizationPolicy });
    if (!normalized) return result(rulebook, request, traces, "FAILED", aggregation.aggregate < 0 || aggregation.aggregate > 100 ? "COMPILED_NORMALIZATION_OUT_OF_RANGE" : "COMPILED_NORMALIZATION_FAILED", null, lineage, null, aggregation);
    const decision = this.classification.classify(normalized, decisionPolicy);
    if (!decision.classified) return result(rulebook, request, traces, "FAILED", decision.code, null, lineage, null, aggregation, normalized);
    return result(rulebook, request, traces, aggregation.status, null, null, lineage, null, aggregation, normalized, decision.result);
  }
}

const validateTrace = (t: CompiledBindingExecutionResult, r: CompiledRulebookDefinition, b: CompiledRulebookDefinition["factorBindings"][number], d: CompiledBindingDispositionService): CompiledExecutionFailureCode | null => {
  if (!same(t.rulebook, r.identity)) return "BINDING_RESULT_RULEBOOK_MISMATCH"; if (t.bindingId !== b.bindingId || !same(t.binding, b)) return "BINDING_RESULT_IDENTITY_MISMATCH"; if (t.bindingOrder !== b.order) return "BINDING_RESULT_ORDER_MISMATCH";
  if (!same(t.lineage, { factor: b.factor, evaluator: b.evaluator, provider: b.provider, executionPolicies: b.executionPolicies })) return "BINDING_RESULT_LINEAGE_MISMATCH";
  const disposition = d.derive(b, t.inputState); if (!disposition.derived || disposition.disposition !== t.disposition) return "BINDING_RESULT_DISPOSITION_MISMATCH";
  if (t.disposition === "INCLUDED" ? t.executionStatus !== "EXECUTED" || !Number.isFinite(t.bindingScore) || t.bindingScore! < 0 || t.bindingScore! > 100 : t.executionStatus !== "NOT_EXECUTED" || t.bindingScore !== null) return "BINDING_RESULT_SCORE_MISMATCH";
  return null;
};
const validateBindings = (r: CompiledRulebookDefinition): CompiledExecutionFailureCode | null => { if (!Array.isArray(r.factorBindings) || !dense(r.factorBindings) || r.factorBindings.length === 0) return "INVALID_BINDING_COLLECTION"; const ids = new Set<string>(); for (let i=0;i<r.factorBindings.length;i+=1) { const b=r.factorBindings[i]!; if (b.order !== i) return "INVALID_BINDING_ORDER"; if (ids.has(b.bindingId)) return "DUPLICATE_BINDING_ID"; ids.add(b.bindingId); } return null; };
const validRequest = (v: unknown): v is CompiledExecutionRequest => record(v) && record(v.rulebook) && identifier(v.rulebook.rulebookId) && positive(v.rulebook.rulebookVersion) && v.asOf instanceof Date && Number.isFinite(v.asOf.getTime()) && record(v.subjectContext) && "tradedInstrument" in v.subjectContext && "underlyingAsset" in v.subjectContext && Array.isArray(v.observations) && dense(v.observations) && v.observations.length > 0 && v.observations.length <= MAX_COMPILED_EXECUTION_OBSERVATIONS;
const result = (rb: CompiledRulebookDefinition | null, rq: CompiledExecutionRequest | null, traces: readonly CompiledBindingExecutionResult[], status: CompiledExecutionResult["status"], failureCode: CompiledExecutionFailureCode | null, stageFailureCode: string | null = null, lineage: any = null, failedBindingOrder: number | null = null, aggregation: any = null, normalization: any = null, decision: any = null): CompiledExecutionResult => freeze({ status, rulebook: rb ? { identity: { ...rb.identity }, source: { ...rb.source }, compilation: { ...rb.compilation, compiledAt: new Date(rb.compilation.compiledAt.getTime()) } } : null, requestRulebook: rq ? { ...rq.rulebook } : null, evaluatedAt: rq ? new Date(rq.asOf.getTime()) : null, bindingTraces: structuredClone(traces), counts: counts(traces, rb?.factorBindings.length ?? 0), policyLineage: lineage ? { ...lineage } : null, aggregation: aggregation ? structuredClone(aggregation) : null, aggregateScore: aggregation?.aggregated ? aggregation.aggregate : null, normalization: normalization ? structuredClone(normalization) : null, normalizedScore: normalization?.normalizedScore ?? null, decision: decision ? structuredClone(decision) : null, decisionBand: decision ? structuredClone(decision.band) : null, includedWeight: aggregation?.includedWeight ?? 0, failedBindingOrder, failureCode, stageFailureCode });
const counts = (t: readonly CompiledBindingExecutionResult[], total: number) => ({ totalBindings: total, executedBindings: t.filter(x=>x.executionStatus==="EXECUTED").length, includedBindings:t.filter(x=>x.disposition==="INCLUDED").length, partialBindings:t.filter(x=>x.disposition==="PARTIAL").length, omittedBindings:t.filter(x=>x.disposition==="OMITTED").length, blockingBindings:t.filter(x=>x.disposition==="BLOCKING").length, missingBindings:t.filter(x=>x.inputState==="MISSING").length, invalidBindings:t.filter(x=>x.inputState==="INVALID").length });
const freeze = <T>(v:T):T => { if(typeof v!=="object"||v===null||Object.isFrozen(v)) return v; for(const x of Object.values(v)) freeze(x); return Object.freeze(v); }; const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b); const record=(v:unknown):v is Record<string,any>=>typeof v==="object"&&v!==null&&!Array.isArray(v); const identifier=(v:unknown):v is string=>typeof v==="string"&&/^[A-Z0-9_]{1,120}$/.test(v); const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0; const dense=(a:readonly unknown[])=>a.every((_,i)=>i in a);
