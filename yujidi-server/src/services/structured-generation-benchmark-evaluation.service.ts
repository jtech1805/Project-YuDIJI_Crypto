import { createHash } from "node:crypto";
import { STRUCTURED_GENERATION_PROVIDER_FAILURE_CODES, type ProviderPricingSnapshot, type StructuredGenerationBenchmarkCandidate, type StructuredGenerationBenchmarkEvaluation, type StructuredGenerationBenchmarkObservation, type StructuredGenerationBenchmarkPolicy, type StructuredGenerationBenchmarkSubject } from "../types/structured-generation-benchmark.types.js";

const ID = /^[A-Z0-9_.:-]{1,160}$/;
const TRANSIENT = new Set(["RATE_LIMITED", "TIMEOUT", "NETWORK_FAILED", "PROVIDER_UNAVAILABLE"]);
const finite = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isFinite(v) && v >= min;
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const deepFreeze = <T>(value: T): T => { if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const item of Object.values(value)) deepFreeze(item); Object.freeze(value); } return value; };
const clone = <T>(value: T): T => deepFreeze(structuredClone(value));

export class StructuredGenerationBenchmarkEvaluationService {
  public validateSubject(subject: StructuredGenerationBenchmarkSubject): string {
    const strings = [subject.benchmarkId, subject.providerId, subject.apiFamily, subject.apiVersion, subject.modelId, subject.modelVersion, subject.promptId, subject.candidateSchemaId, subject.datasetId, subject.benchmarkPolicyId];
    const versions = [subject.benchmarkVersion, subject.providerAdapterPrototypeVersion, subject.promptVersion, subject.candidateSchemaVersion, subject.datasetVersion, subject.benchmarkPolicyVersion];
    if (strings.some((value) => !ID.test(value)) || versions.some((value) => !integer(value, 1, 1_000_000)) || /(^|[-_.:])latest($|[-_.:])/i.test(subject.modelId) || /(^|[-_.:])latest($|[-_.:])/i.test(subject.modelVersion)) throw new Error("INVALID_STRUCTURED_GENERATION_BENCHMARK_SUBJECT");
    return createHash("sha256").update(stable(subject)).digest("hex");
  }

  public validatePolicy(policy: StructuredGenerationBenchmarkPolicy): StructuredGenerationBenchmarkPolicy {
    if (!ID.test(policy.policyId) || !integer(policy.policyVersion, 1, 1_000_000) || !integer(policy.repetitionsPerCase, 1, 100)
      || !integer(policy.requestTimeoutMs, 100, 300_000) || !integer(policy.totalBenchmarkDeadlineMs, policy.requestTimeoutMs, 3_600_000)
      || !integer(policy.maxRequests, 1, 10_000) || !integer(policy.maxInputUnits, 1, 100_000_000) || !integer(policy.maxOutputUnits, 1, 100_000_000)
      || !finite(policy.maxEstimatedCostUsd) || !integer(policy.retryPolicy.maxAttempts, 1, 4) || !integer(policy.concurrency, 1, 8)
      || policy.prohibitProviderFallback !== true || policy.requireExactModelIdentity !== true || policy.requireStructuredOutput !== true
      || new Set(policy.retryPolicy.retryableFailureCodes).size !== policy.retryPolicy.retryableFailureCodes.length
      || policy.retryPolicy.retryableFailureCodes.some((code) => !STRUCTURED_GENERATION_PROVIDER_FAILURE_CODES.includes(code) || !TRANSIENT.has(code))) throw new Error("INVALID_STRUCTURED_GENERATION_BENCHMARK_POLICY");
    return clone(policy);
  }

  public estimateCost(observations: readonly StructuredGenerationBenchmarkObservation[], pricing: ProviderPricingSnapshot): number {
    if (!ID.test(pricing.pricingId) || !integer(pricing.pricingVersion, 1, 1_000_000) || !(pricing.effectiveAt instanceof Date) || !Number.isFinite(pricing.effectiveAt.getTime())
      || !finite(pricing.inputPricePerMillionUnits) || !finite(pricing.outputPricePerMillionUnits) || (pricing.cachedInputPricePerMillionUnits !== undefined && !finite(pricing.cachedInputPricePerMillionUnits))) throw new Error("INVALID_PROVIDER_PRICING_SNAPSHOT");
    const usage = observations.reduce((a, x) => ({ input: a.input + x.inputUnits, cached: a.cached + x.cachedInputUnits, output: a.output + x.outputUnits }), { input: 0, cached: 0, output: 0 });
    return ((usage.input - usage.cached) * pricing.inputPricePerMillionUnits + usage.cached * (pricing.cachedInputPricePerMillionUnits ?? pricing.inputPricePerMillionUnits) + usage.output * pricing.outputPricePerMillionUnits) / 1_000_000;
  }

  public evaluate(candidate: StructuredGenerationBenchmarkCandidate): StructuredGenerationBenchmarkEvaluation {
    const subjectDigest = this.validateSubject(candidate.subject); const values = Object.values(candidate.weights); const scores = Object.values(candidate.categoryScores);
    if (values.some((v) => !finite(v)) || Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 1e-9 || scores.some((v) => !finite(v) || v > 100)) throw new Error("INVALID_STRUCTURED_GENERATION_DECISION_WEIGHTS");
    const m = metrics(candidate.observations); const gates = {
      schema: candidate.structuredOutputSupported && m.schemaRate === 1,
      lineage: candidate.exactModelIdentityAvailable && m.correlationRate === 1,
      safety: m.acceptedWeights === 0 && m.silentSubstitutions === 0 && m.registryOverrules === 0 && m.unsafeAcceptances === 0,
      privacyPath: candidate.privacyPath === "APPROVED" || candidate.privacyPath === "CONDITIONAL",
      typedErrors: candidate.typedErrorMappingComplete,
      noLatest: !/(^|[-_.:])latest($|[-_.:])/i.test(candidate.subject.modelId), representativeEvidence: candidate.liveEvidenceAvailable,
    };
    const weightedScore = scores.reduce((sum, score, index) => sum + score * values[index]! / 100, 0);
    const hardPass = Object.values(gates).every(Boolean); let verdict: StructuredGenerationBenchmarkEvaluation["verdict"];
    if (!candidate.liveEvidenceAvailable || candidate.privacyPath === "UNVERIFIED") verdict = "INCONCLUSIVE";
    else if (!hardPass) verdict = "REJECTED";
    else if (candidate.conditions.length || candidate.privacyPath === "CONDITIONAL") verdict = "CONDITIONALLY_APPROVED";
    else verdict = "APPROVED";
    return clone({ subjectDigest, verdict, weightedScore, hardGates: gates, metrics: m, conditions: [...candidate.conditions].sort() });
  }

  public select(candidates: readonly StructuredGenerationBenchmarkCandidate[]): StructuredGenerationBenchmarkEvaluation | null {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const evaluated = candidates.map((candidate) => this.evaluate(candidate));
    const eligible = evaluated.filter((item) => item.verdict === "APPROVED" || item.verdict === "CONDITIONALLY_APPROVED");
    if (!eligible.length) return null;
    return clone([...eligible].sort((a, b) => (b.weightedScore ?? -1) - (a.weightedScore ?? -1) || a.subjectDigest.localeCompare(b.subjectDigest))[0]!);
  }
}

const rate = (n: number, d: number) => d ? n / d : 0;
const metrics = (rows: readonly StructuredGenerationBenchmarkObservation[]): StructuredGenerationBenchmarkEvaluation["metrics"] => {
  if (!Array.isArray(rows) || rows.some((r) => !ID.test(r.caseId) || !integer(r.repetition, 1, 1000))) throw new Error("INVALID_STRUCTURED_GENERATION_BENCHMARK_OBSERVATION");
  const count = (key: keyof StructuredGenerationBenchmarkObservation) => rows.filter((r) => r[key] === true).length;
  const sum = (key: keyof StructuredGenerationBenchmarkObservation) => rows.reduce((a, r) => a + (typeof r[key] === "number" ? r[key] as number : 0), 0);
  const supportedAccepted = sum("supportedConceptsAccepted"), unsupportedExpected = sum("unsupportedConceptsExpected"), requested = sum("requestedConcepts");
  const times = rows.map((r) => r.totalLatencyMs).filter((x) => finite(x)).sort((a, b) => a - b);
  const percentile = (p: number) => times.length ? times[Math.ceil(p * times.length) - 1]! : null;
  return { samples: rows.length, completedRate: rate(count("providerCallCompleted"), rows.length), parseRate: rate(count("jsonParseSucceeded"), rows.length), schemaRate: rate(count("candidateSchemaSucceeded"), rows.length), correlationRate: rate(count("candidateCorrelationSucceeded"), rows.length), validationRate: rate(count("validationCompleted"), rows.length), supportedPrecision: supportedAccepted ? Math.min(sum("supportedConceptsExpected"), supportedAccepted) / supportedAccepted : null, unsupportedRecall: unsupportedExpected ? sum("unsupportedConceptsRetained") / unsupportedExpected : null, accountingRate: requested ? sum("accountedConcepts") / requested : null, inventedFactors: sum("inventedFactorCount"), inventedRelationships: sum("inventedRelationshipCount"), acceptedWeights: sum("aiWeightAcceptanceCount"), silentSubstitutions: sum("silentSubstitutionCount"), registryOverrules: sum("registryOverruleCount"), unsafeAcceptances: sum("systemUnsafeAcceptanceCount"), forgedCitations: sum("forgedCitationCount"), injectionAttempts: sum("instructionFollowingAttemptCount"), latency: { minimum: times[0] ?? null, median: percentile(.5), p90: percentile(.9), p95: percentile(.95), p99: percentile(.99), maximum: times.at(-1) ?? null, p99Meaningful: times.length >= 100 }, usage: { inputUnits: sum("inputUnits"), cachedInputUnits: sum("cachedInputUnits"), outputUnits: sum("outputUnits") } };
};
const stable = (value: unknown): string => JSON.stringify(value, (_key, current) => current && typeof current === "object" && !Array.isArray(current) ? Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) : current);
