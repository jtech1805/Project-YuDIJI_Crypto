import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_PROVIDER_CIRCUIT_POLICY,
  TEMPLATE_DRAFT_RAG_EXECUTION_POLICY,
} from "../../../src/registries/ai-runtime-execution-policy.registry.js";
import { AiProviderCircuitAttributionService } from "../../../src/services/ai-runtime/ai-provider-circuit-attribution.service.js";
import { AiProviderUsageAggregationService } from "../../../src/services/ai-runtime/ai-provider-usage-aggregation.service.js";
import { InMemoryAiRuntimeBudgetService } from "../../../src/services/ai-runtime/ai-runtime-budget.service.js";
import { AiRuntimeCircuitBreakerService } from "../../../src/services/ai-runtime/ai-runtime-circuit-breaker.service.js";
import { projectAiProviderFailure } from "../../../src/services/ai-runtime/ai-provider-outcome-projection.service.js";

test("provider failure projection is closed, metadata-only, and detached", () => {
  const failure = projectAiProviderFailure(
    "GENERATION_PROVIDER",
    "MODEL_IDENTITY_MISMATCH",
    { provider: "GOOGLE_GEMINI", model: "gemini-model" },
  );
  assert.deepEqual(failure, {
    providerClass: "GENERATION_PROVIDER",
    failureCode: "IDENTITY_MISMATCH",
    provider: "GOOGLE_GEMINI",
    model: "gemini-model",
  });
  assert(Object.isFrozen(failure));
  assert.equal(JSON.stringify(failure).includes("prompt"), false);
});

test("circuit attribution is policy-owned and provider-class isolated", () => {
  let now = 1;
  const circuits = new AiRuntimeCircuitBreakerService(
    AI_PROVIDER_CIRCUIT_POLICY,
  );
  const attribution = new AiProviderCircuitAttributionService(
    circuits,
    AI_PROVIDER_CIRCUIT_POLICY,
    () => now,
  );
  const networkFailure = {
    completed: false as const,
    failure: projectAiProviderFailure("GENERATION_PROVIDER", "NETWORK_FAILED"),
  };
  for (let count = 0; count < 3; count++) {
    attribution.record("BASELINE_GENERATION", networkFailure);
    now++;
  }
  assert.equal(circuits.state("GENERATION_PROVIDER", now), "OPEN");
  assert.equal(circuits.state("EMBEDDING_PROVIDER", now), "CLOSED");
  assert.equal(circuits.state("VECTOR_INDEX_PROVIDER", now), "CLOSED");

  attribution.record("BASELINE_GENERATION", {
    completed: false,
    failure: projectAiProviderFailure("EMBEDDING_PROVIDER", "CALLER_ABORTED"),
  });
  assert.equal(circuits.state("EMBEDDING_PROVIDER", now), "CLOSED");
});

test("provider success closes half-open before downstream validation", () => {
  const circuits = new AiRuntimeCircuitBreakerService(
    AI_PROVIDER_CIRCUIT_POLICY,
  );
  for (let count = 0; count < 3; count++) {
    circuits.failure("VECTOR_INDEX_PROVIDER", "PROVIDER_UNAVAILABLE", 1);
  }
  assert.equal(circuits.state("VECTOR_INDEX_PROVIDER", 30_001), "HALF_OPEN");
  new AiProviderCircuitAttributionService(
    circuits,
    AI_PROVIDER_CIRCUIT_POLICY,
    () => 30_001,
  ).record("VECTOR_RETRIEVAL", {
    completed: true,
    success: { providerClass: "VECTOR_INDEX_PROVIDER" },
    usage: { providerCalls: 1 },
  });
  assert.equal(circuits.state("VECTOR_INDEX_PROVIDER", 30_001), "CLOSED");
});

test("usage aggregation preserves stage lineage and unknown versus measured zero", () => {
  const result = new AiProviderUsageAggregationService().aggregate([
    {
      stage: "BASELINE_GENERATION",
      providerClass: "GENERATION_PROVIDER",
      usage: { generationCalls: 1, promptTokens: 10 },
    },
    {
      stage: "QUERY_EMBEDDING",
      providerClass: "EMBEDDING_PROVIDER",
      usage: { embeddingInputs: 1 },
    },
    {
      stage: "VECTOR_RETRIEVAL",
      providerClass: "VECTOR_INDEX_PROVIDER",
      usage: { providerCalls: 1 },
    },
    {
      stage: "RAG_GENERATION",
      providerClass: "GENERATION_PROVIDER",
      usage: { generationCalls: 1, promptTokens: 0 },
    },
  ]);
  assert.equal(result.totals.generationCalls, 2);
  assert.equal(result.totals.promptTokens, 10);
  assert.equal(result.totals.embeddingInputs, 1);
  assert.equal(result.totals.completionTokens, undefined);
  assert.equal(result.stages.length, 4);
  assert(Object.isFrozen(result) && Object.isFrozen(result.stages));
});

test("usage recording is separate from request reservation", async () => {
  const budget = new InMemoryAiRuntimeBudgetService(
    TEMPLATE_DRAFT_RAG_EXECUTION_POLICY,
  );
  const admission = await budget.reserve({
    userId: "U",
    day: "2026-08-11",
    month: "2026-08",
    usage: {
      requestCount: 1,
      generationInputTokens: 0,
      generationOutputTokens: 0,
      embeddingInputs: 0,
      estimatedCostUsd: 0,
    },
  });
  assert.equal(admission.allowed, true);
  await budget.recordUsage({
    executionId: "EXECUTION_1",
    userId: "U",
    stages: [
      {
        stage: "BASELINE_GENERATION",
        providerClass: "GENERATION_PROVIDER",
        usage: { generationCalls: 1, totalTokens: 12 },
      },
    ],
  });
  assert.equal(budget.usageRecords().length, 1);
  assert(Object.isFrozen(budget.usageRecords()[0]?.stages));
});
