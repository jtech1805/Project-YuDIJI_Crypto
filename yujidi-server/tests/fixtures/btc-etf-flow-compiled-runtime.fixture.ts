import { BTC_ETF_FLOW_AUTHORITY_IDS, BTC_ETF_FLOW_TEMPLATE_SNAPSHOT, createBtcEtfFlowCompilationAuthorities } from "../../src/registries/btc-etf-flow-characterization.authorities.js";
import { BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER, BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY } from "../../src/registries/provider-authority.registry.js";
import { DEFAULT_FACTOR_DEFINITIONS } from "../../src/registries/default-factor-definitions.js";
import { StaticFactorRegistry } from "../../src/registries/factor.registry.js";
import { CompiledBindingExecutionService } from "../../src/services/compiled-rulebook/compiled-binding-execution.service.js";
import { CompiledObservationAttestationValidationService } from "../../src/services/compiled-rulebook/compiled-observation-attestation-validation.service.js";
import { CompiledRulebookCompatibilityValidationService } from "../../src/services/compiled-rulebook/compiled-rulebook-compatibility-validation.service.js";
import { CompiledRulebookExecutionService } from "../../src/services/compiled-rulebook/compiled-rulebook-execution.service.js";
import { CompiledShadowExecutionService } from "../../src/services/compiled-rulebook/compiled-shadow-execution.service.js";
import { CompiledShadowInputAssemblyService } from "../../src/services/compiled-rulebook/compiled-shadow-input-assembly.service.js";
import { CompiledShadowObservationAssemblyService } from "../../src/services/compiled-rulebook/compiled-shadow-observation-assembly.service.js";
import { DeterministicCompiledRulebookCompilerService } from "../../src/services/compiled-rulebook/deterministic-compiled-rulebook-compiler.service.js";
import { EvidenceFactorCompatibilityService } from "../../src/services/evidence/evidence-factor-compatibility.service.js";
import type { CompiledRulebookExecutionBinding } from "../../src/types/compiled-rulebook-execution-binding.types.js";
import type { CompiledShadowExecutionOutcome } from "../../src/types/compiled-shadow-execution.types.js";
import type { CompiledShadowObservationAssemblyResult } from "../../src/types/compiled-shadow-observation-assembly.types.js";
import type { EvidenceProviderResolutionAttestation } from "../../src/types/evidence-provider-resolution-attestation.types.js";
import type { EvidenceReadRecord } from "../../src/types/evidence-lifecycle.types.js";

export const ETF_RUNTIME_TIMES = Object.freeze({
  compiledAt: new Date("2026-01-01T00:00:00.000Z"),
  observedAt: new Date("2026-01-01T09:00:00.000Z"),
  publishedAt: new Date("2026-01-01T09:05:00.000Z"),
  evidenceCreatedAt: new Date("2026-01-01T09:06:00.000Z"),
  resolvedAt: new Date("2026-01-01T09:05:30.000Z"),
  attestationCreatedAt: new Date("2026-01-01T09:07:00.000Z"),
  asOf: new Date("2026-01-01T09:10:00.000Z"),
});

export const compileBtcEtfRulebook = () => {
  const authorities = createBtcEtfFlowCompilationAuthorities();
  const compatibility = new CompiledRulebookCompatibilityValidationService(authorities).validate(BTC_ETF_FLOW_TEMPLATE_SNAPSHOT);
  if (!compatibility.compatible) throw new Error(`B2 compatibility failed: ${compatibility.code}`);
  const compiled = new DeterministicCompiledRulebookCompilerService().compile({
    rulebookIdentity: { rulebookId: "CRYPTO_BTC_ETF_FLOW_DAILY_RULEBOOK", rulebookVersion: 1 },
    compilerLineage: { compilerId: "DETERMINISTIC_COMPILED_RULEBOOK_COMPILER", compilerVersion: 1, compiledAt: ETF_RUNTIME_TIMES.compiledAt },
    specification: compatibility.specification,
  });
  if (!compiled.compiled) throw new Error(`B2 compilation failed: ${compiled.code}`);
  return { authorities, rulebook: compiled.rulebook };
};

export const createEtfEvidence = (overrides: Record<string, unknown> = {}): EvidenceReadRecord => structuredClone({
  evidenceId: "EVIDENCE_BTC_ETF_FLOW_20260101",
  recordType: "OBSERVATION",
  factorKey: "CRYPTO.ETF_NET_FLOW",
  deduplicationKey: "BTC_ETF_FLOW_20260101",
  subject: { type: "ASSET", key: "BTC" },
  provenance: { sourceType: "INTERNAL_CALCULATION", provider: BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER.evidenceProvenanceProvider, sourcePublishedAt: ETF_RUNTIME_TIMES.publishedAt },
  value: { type: "NUMBER", numberValue: 200, unit: "USD" },
  observedAt: ETF_RUNTIME_TIMES.observedAt,
  confidence: 0.9,
  schemaVersion: "1.0",
  createdAt: ETF_RUNTIME_TIMES.evidenceCreatedAt,
  ...overrides,
} as EvidenceReadRecord);

export const createEtfAttestation = (evidenceId = "EVIDENCE_BTC_ETF_FLOW_20260101", overrides: Record<string, unknown> = {}): EvidenceProviderResolutionAttestation => structuredClone({
  attestationId: `ATTESTATION_${evidenceId}`,
  attestationVersion: 1,
  evidenceId,
  providerBinding: { providerBindingId: BTC_ETF_FLOW_AUTHORITY_IDS.providerBindingId, providerBindingVersion: 1 },
  resolutionPolicy: { policyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId, policyVersion: 1 },
  selectedProviderKey: BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY,
  selectedProviderType: "DIRECT",
  resolutionStatus: "RESOLVED",
  confidenceAdjustment: 0,
  warningCodes: [],
  resolvedAt: ETF_RUNTIME_TIMES.resolvedAt,
  createdAt: ETF_RUNTIME_TIMES.attestationCreatedAt,
  ...overrides,
} as EvidenceProviderResolutionAttestation);

export type EtfRuntimeOptions = Readonly<{
  evidence?: readonly EvidenceReadRecord[];
  attestations?: readonly EvidenceProviderResolutionAttestation[];
  providerAuthorityOverride?: unknown;
}>;

export const createBtcEtfRuntimeHarness = (options: EtfRuntimeOptions = {}) => {
  const { authorities, rulebook } = compileBtcEtfRulebook();
  const executionBinding: CompiledRulebookExecutionBinding = Object.freeze({
    bindingId: "BTC_ETF_FLOW_TEST_EXECUTION_BINDING",
    bindingVersion: 1,
    sourceTemplate: { templateId: BTC_ETF_FLOW_AUTHORITY_IDS.templateKey, templateVersion: 1, scope: "SYSTEM" as const },
    compiledRulebook: { ...rulebook.identity },
    createdAt: new Date("2026-01-01T00:01:00.000Z"),
  });
  const evidence = structuredClone(options.evidence ?? [createEtfEvidence()]);
  const attestations = structuredClone(options.attestations ?? evidence.map((item) => createEtfAttestation(item.evidenceId)));
  const calls = { binding: 0, rulebook: 0, evidence: 0, attestation: 0, assembly: 0, compiled: 0, parity: 0 };
  let assemblyResult: CompiledShadowObservationAssemblyResult | null = null;
  let compiledResult: unknown = null;
  const providerAuthorities = options.providerAuthorityOverride
    ? { getExact: (key: string) => key === BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY ? structuredClone(options.providerAuthorityOverride) : null }
    : authorities.providerAuthorities;
  const observationAssembler = new CompiledShadowObservationAssemblyService({
    compatibility: new EvidenceFactorCompatibilityService({ factorRegistry: new StaticFactorRegistry(DEFAULT_FACTOR_DEFINITIONS) }),
    factorDefinitions: authorities.factorDefinitions,
    providerBindings: authorities.providerBindings,
    resolutionPolicies: authorities.resolutionPolicies,
    providerAuthorities: providerAuthorities as never,
  });
  const attestationValidator = new CompiledObservationAttestationValidationService({ providerBindings: authorities.providerBindings, resolutionPolicies: authorities.resolutionPolicies });
  const preparation = new CompiledShadowInputAssemblyService({ factorDefinitions: authorities.factorDefinitions, attestation: attestationValidator });
  const bindingExecutor = new CompiledBindingExecutionService({ evaluatorDeclarations: authorities.evaluatorDeclarations, evaluatorConfigurations: authorities.evaluatorConfigurations, evaluatorImplementations: authorities.evaluatorImplementations });
  const executor = new CompiledRulebookExecutionService({ preparation, bindings: bindingExecutor, aggregationPolicies: authorities.compiledAggregationPolicies, normalizationPolicies: authorities.normalizationPolicies, decisionBandPolicies: authorities.decisionBandPolicies });
  const service = new CompiledShadowExecutionService({
    executionBindingReader: { getExactForSourceTemplate: async (identity: any) => { calls.binding += 1; return identity.templateId === executionBinding.sourceTemplate.templateId && identity.templateVersion === 1 && identity.scope === "SYSTEM" ? { found: true as const, binding: structuredClone(executionBinding) } : { found: false as const, code: "NOT_FOUND" as const }; } },
    compiledRulebookReader: { getExact: async (id: unknown, version: unknown) => { calls.rulebook += 1; return id === rulebook.identity.rulebookId && version === rulebook.identity.rulebookVersion ? { found: true as const, rulebook: structuredClone(rulebook) } : { found: false as const, code: "NOT_FOUND" as const }; } },
    evidenceReader: { read: async () => { calls.evidence += 1; return { history: structuredClone(evidence), complete: true } as any; } },
    attestationReader: { getExactByEvidenceId: async (evidenceId: unknown) => { calls.attestation += 1; const found = attestations.find((item) => item.evidenceId === evidenceId); return found ? { found: true as const, attestation: structuredClone(found) } : { found: false as const, code: "NOT_FOUND" as const }; } },
    observationAssembler: { assemble: (request: unknown) => { calls.assembly += 1; assemblyResult = observationAssembler.assemble(request); return assemblyResult; } },
    compiledRulebookExecutor: { execute: (compiledRulebook: unknown, request: unknown) => { calls.compiled += 1; compiledResult = executor.execute(compiledRulebook, request); return compiledResult as any; } },
    parityPolicyValidator: { validate: () => { calls.parity += 1; throw new Error("parity must not run"); } },
    parityComparisonService: { compare: () => { calls.parity += 1; throw new Error("parity must not run"); } },
  });
  const request = Object.freeze({
    sourceTemplate: { ...executionBinding.sourceTemplate },
    asOf: new Date(ETF_RUNTIME_TIMES.asOf),
    tradedInstrument: { type: "INSTRUMENT" as const, key: "BTC_USD" },
    underlyingAsset: { type: "ASSET" as const, key: "BTC" },
    shadowExecutionIdentity: { shadowExecutionId: "SHADOW_BTC_ETF_FLOW_20260101", requestedAt: new Date(ETF_RUNTIME_TIMES.asOf) },
  });
  return {
    authorities, rulebook, executionBinding, evidence, attestations, calls, service, request,
    get assemblyResult() { return assemblyResult; },
    get compiledResult() { return compiledResult; },
    execute: (): Promise<CompiledShadowExecutionOutcome> => service.execute(request),
  };
};
