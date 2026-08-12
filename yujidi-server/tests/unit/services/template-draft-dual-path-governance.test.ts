import assert from "node:assert/strict";
import test from "node:test";
import { AI_PROVIDER_CIRCUIT_POLICY } from "../../../src/registries/ai-runtime-execution-policy.registry.js";
import { AiGovernedExecutionContextService } from "../../../src/services/ai-runtime/ai-governed-execution-context.service.js";
import { AiRuntimeCircuitBreakerService } from "../../../src/services/ai-runtime/ai-runtime-circuit-breaker.service.js";
import {
  ApplicationRagRetrievalAuthorizationService,
  TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION as authority,
} from "../../../src/services/access/application-rag-retrieval-authorization.service.js";
import { TemplateDraftDualPathGovernedExecutionService } from "../../../src/services/copilot/template-draft-dual-path-governed-execution.service.js";
import { TemplateDraftRegistryOnlyBaselineService } from "../../../src/services/copilot/template-draft-registry-only-baseline.service.js";

const features = {
  aiTemplateGenerationEnabled: true,
  knowledgeRetrievalEnabled: true,
  ragTemplateDraftingEnabled: true,
  killSwitch: false,
};

const resolved = {
  valid: true as const,
  binding: {
    bindingId: authority.runtimeBindingId,
    bindingVersion: 1,
    indexPublicationId: authority.indexPublicationId,
    indexPublicationVersion: 1,
    embeddingSchemaId: authority.embeddingSchemaId,
    embeddingSchemaVersion: 1,
    indexId: authority.indexId,
    indexVersion: authority.indexVersion,
    rolloutMode: "SHADOW_ONLY" as const,
    corpus: "PLATFORM_KNOWLEDGE" as const,
  },
  indexPublication: {
    indexPublicationId: authority.indexPublicationId,
    indexPublicationVersion: 1,
    namespace: authority.namespace,
  },
  corpusPublication: {
    publicationId: authority.corpusPublicationId,
    publicationVersion: 1,
  },
};

test("shared governed context reserves one request, acquires one permit, and finalizes once", async () => {
  let reserves = 0;
  let acquires = 0;
  let releases = 0;
  const service = new AiGovernedExecutionContextService(
    { resolve: async () => resolved } as any,
    {
      reserve: async (input: any) => {
        reserves += 1;
        assert.equal(input.usage.requestCount, 1);
        return { allowed: true, reservationId: "R1" };
      },
    },
    {
      acquire: async () => {
        acquires += 1;
        return { acquired: true, permitId: "P1" };
      },
      release: async () => {
        releases += 1;
      },
    },
  );
  const admitted = await service.create({
    executionId: "E1",
    bindingId: authority.runtimeBindingId,
    bindingVersion: 1,
    userId: "U1",
    requestedAt: new Date("2026-08-11T00:00:00.000Z"),
    features,
  });
  assert.equal(admitted.admitted, true);
  if (!admitted.admitted) return;
  assert.equal(service.isIssued(admitted.context), true);
  assert.equal(Object.isFrozen(admitted.context), true);
  await service.finalize(admitted.context);
  await service.finalize(admitted.context);
  assert.deepEqual(
    { reserves, acquires, releases },
    { reserves: 1, acquires: 1, releases: 1 },
  );
});

test("governance denial reaches no provider and creates no permit", async () => {
  let reserves = 0;
  let acquires = 0;
  const service = new AiGovernedExecutionContextService(
    { resolve: async () => resolved } as any,
    {
      reserve: async () => (reserves++, { allowed: true, reservationId: "R" }),
    },
    {
      acquire: async () => (acquires++, { acquired: true, permitId: "P" }),
      release: async () => undefined,
    },
  );
  const result = await service.create({
    executionId: "E",
    bindingId: authority.runtimeBindingId,
    bindingVersion: 1,
    userId: "U",
    requestedAt: new Date(),
    features: { ...features, killSwitch: true },
  });
  assert.deepEqual(result, { admitted: false, code: "FEATURE_DISABLED" });
  assert.deepEqual({ reserves, acquires }, { reserves: 0, acquires: 0 });
});

test("application retrieval authority requires every exact lineage field and no environment guard", () => {
  const service = new ApplicationRagRetrievalAuthorizationService();
  const request = {
    authorizationId: authority.authorizationId,
    authorizationVersion: 1,
    runtimeBindingId: authority.runtimeBindingId,
    runtimeBindingVersion: 1,
    indexPublicationId: authority.indexPublicationId,
    indexPublicationVersion: 1,
    corpusPublicationId: authority.corpusPublicationId,
    corpusPublicationVersion: 1,
    embeddingSchemaId: authority.embeddingSchemaId,
    embeddingSchemaVersion: 1,
    indexId: authority.indexId,
    indexVersion: authority.indexVersion,
    namespace: authority.namespace,
    corpus: authority.corpus,
    rolloutMode: "SHADOW_ONLY" as const,
  };
  assert.equal(service.authorize(request).authorized, true);
  for (const changed of [
    { ...request, runtimeBindingVersion: 2 },
    { ...request, indexPublicationVersion: 2 },
    { ...request, corpusPublicationVersion: 2 },
    { ...request, namespace: "WRONG" },
    { ...request, rolloutMode: "LIMITED_PRODUCTION" as const },
  ])
    assert.equal(service.authorize(changed).authorized, false);
  assert.equal("getLatest" in service, false);
});

test("baseline uses generation circuit, provider observer, and shared signal", async () => {
  const circuits = new AiRuntimeCircuitBreakerService(
    AI_PROVIDER_CIRCUIT_POLICY,
  );
  const signal = new AbortController().signal;
  const context = {
    deadlineContext: {
      signal,
      throwIfExpired: () => undefined,
    },
  } as any;
  let observedSignal: AbortSignal | undefined;
  const outcome = {
    completed: true as const,
    success: { providerClass: "GENERATION_PROVIDER" as const },
    usage: { providerCalls: 1, generationCalls: 1 },
  };
  const baseline = new TemplateDraftRegistryOnlyBaselineService(
    {
      generate: async (_request: unknown, execution: any) => {
        observedSignal = execution.signal;
        execution.providerObserver.record("BASELINE_GENERATION", outcome);
        return { status: "COMPLETED" };
      },
    } as any,
    circuits,
  );
  const stages: string[] = [];
  const result = await baseline.execute(context, {} as any, {
    record: (stage) => stages.push(stage),
  });
  assert.equal(result.result.status, "COMPLETED");
  assert.equal(observedSignal, signal);
  assert.deepEqual(stages, ["BASELINE_GENERATION"]);
});

test("dual path preserves authoritative baseline when shadow fails without nested admission", async () => {
  let finalizes = 0;
  let ragCalls = 0;
  const deadline = {
    signal: new AbortController().signal,
    throwIfExpired: () => undefined,
    latencies: () => ({
      embeddingLatencyMs: null,
      retrievalLatencyMs: null,
      contextAssemblyLatencyMs: null,
      generationLatencyMs: null,
    }),
  };
  const context = {
    executionId: "E",
    runtimeBindingId: authority.runtimeBindingId,
    runtimeBindingVersion: 1,
    indexPublicationId: authority.indexPublicationId,
    indexPublicationVersion: 1,
    corpusPublicationId: authority.corpusPublicationId,
    corpusPublicationVersion: 1,
    embeddingSchemaId: authority.embeddingSchemaId,
    embeddingSchemaVersion: 1,
    namespace: authority.namespace,
    corpus: authority.corpus,
    rolloutMode: "SHADOW_ONLY",
    deadlineContext: deadline,
    budgetAdmission: { allowed: true, reservationId: "R" },
    concurrencyPermit: { acquired: true, permitId: "P" },
  } as any;
  const authoritative = Object.freeze({
    status: "PARTIAL",
    validatedCandidate: { supportedBindings: [], unresolvedConcepts: [] },
  });
  const service = new TemplateDraftDualPathGovernedExecutionService(
    {
      create: async () => ({ admitted: true, context }),
      finalize: async () => {
        finalizes += 1;
      },
    } as any,
    {
      execute: async () => ({ result: authoritative, generationLatencyMs: 4 }),
    } as any,
    {
      executeWithinGovernedContext: async () => {
        ragCalls += 1;
        return {
          status: "FAILED",
          reason: "PROVIDER_FAILURE",
          authoritativeResultUntouched: true,
          trace: {
            embeddingLatencyMs: null,
            retrievalLatencyMs: null,
            contextAssemblyLatencyMs: null,
            generationLatencyMs: null,
          },
        };
      },
    } as any,
    new AiRuntimeCircuitBreakerService(AI_PROVIDER_CIRCUIT_POLICY),
  );
  const result = await service.execute({
    executionId: "E",
    bindingId: authority.runtimeBindingId,
    bindingVersion: 1,
    caller: { userId: "U", isInternal: true },
    baselineRequest: {} as any,
    ragRequest: {} as any,
    features,
    requestedAt: new Date("2026-08-11T00:00:00.000Z"),
  });
  assert.equal(result.status, "AUTHORITATIVE_AVAILABLE_SHADOW_FAILED");
  assert.deepEqual(result.authoritativeBaseline, authoritative);
  assert.equal(result.comparison, undefined);
  assert.deepEqual({ ragCalls, finalizes }, { ragCalls: 1, finalizes: 1 });
});

test("one deadline starts before baseline and RAG receives only remaining time", async () => {
  let now = 1_000;
  const governance = new AiGovernedExecutionContextService(
    { resolve: async () => resolved } as any,
    { reserve: async () => ({ allowed: true, reservationId: "R" }) },
    {
      acquire: async () => ({ acquired: true, permitId: "P" }),
      release: async () => undefined,
    },
    60_000,
    () => now,
  );
  const admission = await governance.create({
    executionId: "E",
    bindingId: authority.runtimeBindingId,
    bindingVersion: 1,
    userId: "U",
    requestedAt: new Date("2026-08-11T00:00:00.000Z"),
    features,
  });
  assert.equal(admission.admitted, true);
  if (!admission.admitted) return;
  now += 35_000;
  assert.equal(admission.context.deadlineContext.remainingMs(), 25_000);
  await governance.finalize(admission.context);
});

test("baseline provider failure prevents RAG and preserves stage usage", async () => {
  let ragCalls = 0;
  let recorded: any;
  const context = governedContext();
  const service = new TemplateDraftDualPathGovernedExecutionService(
    {
      create: async () => ({ admitted: true, context }),
      finalize: async () => undefined,
    } as any,
    {
      execute: async (_context: unknown, _request: unknown, observer: any) => {
        observer.record("BASELINE_GENERATION", {
          completed: false,
          failure: {
            providerClass: "GENERATION_PROVIDER",
            failureCode: "NETWORK_FAILED",
            circuitEligible: true,
          },
          usage: { providerCalls: 2, generationCalls: 2 },
        });
        return {
          result: {
            status: "PROVIDER_FAILED",
            reasonCode: "NETWORK_FAILED",
          },
          generationLatencyMs: 3,
        };
      },
    } as any,
    {
      executeWithinGovernedContext: async () => {
        ragCalls += 1;
      },
    } as any,
    new AiRuntimeCircuitBreakerService(AI_PROVIDER_CIRCUIT_POLICY),
    {
      recordUsage: async (value: unknown) => {
        recorded = value;
      },
    },
  );
  const result = await service.execute(dualRequest());
  assert.equal(result.status, "BASELINE_UNAVAILABLE");
  assert.equal(result.authoritativeBaseline, undefined);
  assert.equal(result.telemetry.ragOutcome, "NOT_STARTED");
  assert.equal(ragCalls, 0);
  assert.equal(recorded.stages[0].stage, "BASELINE_GENERATION");
  assert.equal(recorded.stages[0].usage.providerCalls, 2);
});

test("usage accounting failure is separate and cannot rewrite provider success", async () => {
  const context = governedContext();
  const authoritative = {
    status: "COMPLETED",
    validatedCandidate: { supportedBindings: [], unresolvedConcepts: [] },
  };
  const service = new TemplateDraftDualPathGovernedExecutionService(
    {
      create: async () => ({ admitted: true, context }),
      finalize: async () => undefined,
    } as any,
    {
      execute: async () => ({ result: authoritative, generationLatencyMs: 1 }),
    } as any,
    {
      executeWithinGovernedContext: async () => ({
        status: "COMPLETED",
        authoritativeResultUntouched: true,
        comparison: {
          outcome: "MATCH",
          supportedConceptAgreement: 1,
          unresolvedConceptRetention: 1,
          inventedFactorCount: 0,
          silentSubstitutionCount: 0,
          registryOverruleCount: 0,
          aiWeightAcceptanceCount: 0,
          citationCoverage: 1,
          citationValidity: 1,
          promptInjectionAcceptanceCount: 0,
        },
        trace: {
          embeddingLatencyMs: 1,
          retrievalLatencyMs: 1,
          contextAssemblyLatencyMs: 1,
          generationLatencyMs: 1,
        },
      }),
    } as any,
    new AiRuntimeCircuitBreakerService(AI_PROVIDER_CIRCUIT_POLICY),
    { recordUsage: async () => Promise.reject(new Error("ACCOUNTING_DOWN")) },
  );
  const result = await service.execute(dualRequest());
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.comparison?.outcome, "MATCH");
  assert.equal(result.usageAccountingFailure, "USAGE_RECORDING_FAILED");
});

const governedContext = () => ({
  executionId: "E",
  runtimeBindingId: authority.runtimeBindingId,
  runtimeBindingVersion: 1,
  indexPublicationId: authority.indexPublicationId,
  indexPublicationVersion: 1,
  corpusPublicationId: authority.corpusPublicationId,
  corpusPublicationVersion: 1,
  embeddingSchemaId: authority.embeddingSchemaId,
  embeddingSchemaVersion: 1,
  namespace: authority.namespace,
  corpus: authority.corpus,
  rolloutMode: "SHADOW_ONLY",
  deadlineContext: {
    signal: new AbortController().signal,
    throwIfExpired: () => undefined,
    latencies: () => ({
      embeddingLatencyMs: null,
      retrievalLatencyMs: null,
      contextAssemblyLatencyMs: null,
      generationLatencyMs: null,
    }),
  },
  budgetAdmission: { allowed: true, reservationId: "R" },
  concurrencyPermit: { acquired: true, permitId: "P" },
});

const dualRequest = () => ({
  executionId: "E",
  bindingId: authority.runtimeBindingId,
  bindingVersion: 1,
  caller: { userId: "U", isInternal: true },
  baselineRequest: {} as any,
  ragRequest: {} as any,
  features,
  requestedAt: new Date("2026-08-11T00:00:00.000Z"),
});
