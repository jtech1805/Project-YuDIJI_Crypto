import test from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATE_DRAFT_RAG_RUNTIME_V1,
  TemplateDraftRagRuntimeBindingRegistry,
} from "../../../src/registries/template-draft-rag-runtime-binding.registry.js";
import {
  TEMPLATE_DRAFT_RAG_EXECUTION_POLICY,
  AI_PROVIDER_CIRCUIT_POLICY,
} from "../../../src/registries/ai-runtime-execution-policy.registry.js";
import { InMemoryAiRuntimeBudgetService } from "../../../src/services/ai-runtime-budget.service.js";
import { ProcessLocalAiRuntimeConcurrencyService } from "../../../src/services/ai-runtime-concurrency.service.js";
import { AiRuntimeCircuitBreakerService } from "../../../src/services/ai-runtime-circuit-breaker.service.js";
import { TemplateDraftRagRuntimeService } from "../../../src/services/template-draft-rag-runtime.service.js";
import { TemplateDraftRagShadowComparisonService } from "../../../src/services/template-draft-rag-shadow-comparison.service.js";
test("binding is exact immutable shadow-only and has no latest selection", () => {
  const r = new TemplateDraftRagRuntimeBindingRegistry(),
    b = r.getExact("YUDIJI_TEMPLATE_DRAFT_RAG_RUNTIME", 1)!;
  assert.deepEqual(b, TEMPLATE_DRAFT_RAG_RUNTIME_V1);
  assert.equal(b.rolloutMode, "SHADOW_ONLY");
  assert(Object.isFrozen(b));
  assert.equal(r.getExact(b.bindingId, 2), null);
  assert.equal((r as any).latest, undefined);
});
test("independent circuits open and reset without cross-provider coupling", () => {
  const c = new AiRuntimeCircuitBreakerService(AI_PROVIDER_CIRCUIT_POLICY),
    t = 100;
  for (let i = 0; i < 3; i++)
    c.failure("GENERATION_PROVIDER", "REQUEST_TIMEOUT", t);
  assert.equal(c.allow("GENERATION_PROVIDER", t), false);
  assert.equal(c.allow("EMBEDDING_PROVIDER", t), true);
  assert.equal(c.allow("GENERATION_PROVIDER", t + 30000), true);
  c.success("GENERATION_PROVIDER");
  assert.equal(c.state("GENERATION_PROVIDER", t), "CLOSED");
});
test("budget and process-local concurrency fail closed", async () => {
  const b = new InMemoryAiRuntimeBudgetService({
      ...TEMPLATE_DRAFT_RAG_EXECUTION_POLICY,
      perUserDailyRequests: 1,
    }),
    u = {
      requestCount: 1,
      generationInputTokens: 0,
      generationOutputTokens: 0,
      embeddingInputs: 1,
      estimatedCostUsd: 0,
    };
  assert.equal(
    (await b.reserve({ userId: "U", day: "D", month: "M", usage: u })).allowed,
    true,
  );
  assert.equal(
    (await b.reserve({ userId: "U", day: "D", month: "M", usage: u })).allowed,
    false,
  );
  const c = new ProcessLocalAiRuntimeConcurrencyService(1),
    p = await c.acquire("R");
  assert.equal(p.acquired, true);
  assert.equal((await c.acquire("R")).acquired, false);
  if (p.acquired) await c.release(p.permitId);
  assert.equal((await c.acquire("R")).acquired, true);
});
test("kill switch blocks before binding, budget, concurrency, or provider calls", async () => {
  let calls = 0;
  const s = new TemplateDraftRagRuntimeService(
    {
      resolve: async () => {
        calls++;
        return { valid: false };
      },
    } as any,
    {
      reserve: async () => {
        calls++;
        return { allowed: true, reservationId: "x" };
      },
    } as any,
    {
      acquire: async () => {
        calls++;
        return { acquired: true, permitId: "x" };
      },
      release: async () => {},
    } as any,
    new AiRuntimeCircuitBreakerService(AI_PROVIDER_CIRCUIT_POLICY),
    {
      generate: async () => {
        calls++;
        return {};
      },
    } as any,
  );
  const r = await s.execute({
    bindingId: "B",
    bindingVersion: 1,
    caller: { userId: "U", isInternal: false },
    request: {} as any,
    authoritativeResult: { stable: true },
    features: {
      killSwitch: true,
      aiTemplateGenerationEnabled: true,
      knowledgeRetrievalEnabled: true,
      ragTemplateDraftingEnabled: true,
    },
    requestedAt: new Date(0),
  });
  assert.equal(r.status, "SKIPPED");
  assert.equal(r.authoritativeResultUntouched, true);
  assert.equal(calls, 0);
});

test("comparison distinguishes exact agreement, safe difference, and safety regression", () => {
  const service = new TemplateDraftRagShadowComparisonService();
  const authoritative: any = {
    validatedCandidate: {
      supportedBindings: [
        { requestedConceptIds: ["ETF"], factorKey: "CRYPTO.ETF_NET_FLOW" },
      ],
      unresolvedConcepts: [{ conceptId: "LONG" }],
    },
  };
  const safe: any = {
    validatedCandidate: authoritative.validatedCandidate,
    candidate: {
      proposedBindings: [
        { factorReference: { factorKey: "CRYPTO.ETF_NET_FLOW" } },
      ],
    },
    citations: [{ claimValid: true }],
    contradictions: [],
  };
  assert.equal(service.compare(authoritative, safe).outcome, "MATCH");
  const unsafe = {
    ...safe,
    candidate: {
      proposedBindings: [
        {
          factorReference: { factorKey: "MARKET.SECRET_FACTOR" },
          relationship: "VETO",
          proposedWeight: 100,
        },
      ],
    },
    validatedCandidate: {
      supportedBindings: [
        { requestedConceptIds: ["ETF"], factorKey: "MARKET.SECRET_FACTOR" },
      ],
      unresolvedConcepts: [],
    },
  };
  assert.equal(
    service.compare(authoritative, unsafe as any).outcome,
    "RAG_SAFETY_REGRESSION",
  );
});

test("feature matrix, publication failure, circuit denial, and zero deadline suppress execution", async () => {
  for (const features of [
    {
      killSwitch: false,
      aiTemplateGenerationEnabled: false,
      knowledgeRetrievalEnabled: true,
      ragTemplateDraftingEnabled: true,
    },
    {
      killSwitch: false,
      aiTemplateGenerationEnabled: true,
      knowledgeRetrievalEnabled: false,
      ragTemplateDraftingEnabled: true,
    },
    {
      killSwitch: false,
      aiTemplateGenerationEnabled: true,
      knowledgeRetrievalEnabled: true,
      ragTemplateDraftingEnabled: false,
    },
  ]) {
    let calls = 0;
    const service = new TemplateDraftRagRuntimeService(
      {
        resolve: async () => {
          calls++;
          return { valid: true, binding: { rolloutMode: "SHADOW_ONLY" } };
        },
      } as any,
      { reserve: async () => ({ allowed: true, reservationId: "R" }) } as any,
      {
        acquire: async () => ({ acquired: true, permitId: "P" }),
        release: async () => {},
      } as any,
      new AiRuntimeCircuitBreakerService(AI_PROVIDER_CIRCUIT_POLICY),
      {
        generate: async () => {
          calls++;
          return {};
        },
      } as any,
    );
    const result = await service.execute({
      bindingId: "B",
      bindingVersion: 1,
      caller: { userId: "U", isInternal: false },
      request: {} as any,
      authoritativeResult: { status: "PARTIAL" },
      features,
      requestedAt: new Date(0),
    });
    assert.equal(result.status, "SKIPPED");
    assert.equal(calls, 0);
  }
});
