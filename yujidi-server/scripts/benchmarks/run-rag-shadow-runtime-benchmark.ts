import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { GeminiKnowledgeEmbeddingAdapter } from "../../src/adapters/ai/gemini-knowledge-embedding.adapter.js";
import { GeminiTemplateDraftGenerationAdapter } from "../../src/adapters/ai/gemini-template-draft-generation.adapter.js";
import { MongoAtlasKnowledgeVectorSearchAdapter } from "../../src/adapters/vector/mongo-atlas-knowledge-vector-search.adapter.js";
import { createGeminiEmbeddingAdapterConfig } from "../../src/config/gemini-embedding.config.js";
import { createGeminiGenerationAdapterConfig } from "../../src/config/gemini-generation.config.js";
import { createMongoAtlasVectorAdapterConfig } from "../../src/config/mongo-atlas-vector.config.js";
import {
  AI_PROVIDER_CIRCUIT_POLICY,
  TEMPLATE_DRAFT_RAG_EXECUTION_POLICY,
} from "../../src/registries/ai-runtime-execution-policy.registry.js";
import { KnowledgeEmbeddingSchemaRegistry } from "../../src/registries/knowledge-embedding-schema.registry.js";
import { KnowledgeRetrievalPolicyRegistry } from "../../src/registries/knowledge-retrieval-policy.registry.js";
import {
  KnowledgeVectorIndexDefinitionRegistry,
  MONGO_ATLAS_PLATFORM_KNOWLEDGE_VECTOR_INDEX_DEFINITION as index,
} from "../../src/registries/knowledge-vector-index-definition.registry.js";
import { AiRuntimeCircuitBreakerService } from "../../src/services/ai-runtime-circuit-breaker.service.js";
import { InMemoryAiRuntimeBudgetService } from "../../src/services/ai-runtime-budget.service.js";
import { ProcessLocalAiRuntimeConcurrencyService } from "../../src/services/ai-runtime-concurrency.service.js";
import { KnowledgeRetrievalService } from "../../src/services/knowledge-retrieval.service.js";
import { TemplateDraftCandidateValidatorService } from "../../src/services/template-draft-candidate-validator.service.js";
import { TemplateDraftRagGenerationService } from "../../src/services/template-draft-rag-generation.service.js";
import { TemplateDraftRagRuntimeBindingService } from "../../src/services/template-draft-rag-runtime-binding.service.js";
import { TemplateDraftRagRuntimeService } from "../../src/services/template-draft-rag-runtime.service.js";
import { TemplateDraftReviewReportService } from "../../src/services/template-draft-review-report.service.js";
import { GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA as schema } from "../../src/types/gemini-embedding-adapter.types.js";
import {
  cases,
  input,
  policy,
  validateGeminiAtlasRagGuard,
} from "./run-gemini-atlas-rag-benchmark.js";

export const validateShadowRuntimeGuard = (environment: NodeJS.ProcessEnv) => {
  if (environment.NODE_ENV !== "development")
    throw new Error("SHADOW_DEVELOPMENT_ONLY");
  if (environment.YUDIJI_RAG_SHADOW_RUNTIME_CONFIRMED !== "true")
    throw new Error("SHADOW_RUNTIME_NOT_CONFIRMED");
  return validateGeminiAtlasRagGuard({
    ...environment,
    YUDIJI_ATLAS_VECTOR_DATABASE:
      environment.YUDIJI_ATLAS_VECTOR_DATABASE ??
      environment.YUDIJI_DEV_KNOWLEDGE_DATABASE,
  });
};

export const run = async (environment: NodeJS.ProcessEnv = process.env) => {
  const guard = validateShadowRuntimeGuard(environment);
  await mongoose.connect(environment.MONGO_URI!, {
    dbName: guard.config.databaseName,
  });
  try {
    const collection = mongoose.connection.db!.collection(
      guard.config.collectionName,
    );
    const schemas = new KnowledgeEmbeddingSchemaRegistry([schema]);
    const retrieval = new KnowledgeRetrievalService(
      new KnowledgeRetrievalPolicyRegistry([policy]),
      schemas,
      new KnowledgeVectorIndexDefinitionRegistry([index], schemas),
      new GeminiKnowledgeEmbeddingAdapter(
        createGeminiEmbeddingAdapterConfig(environment),
      ),
      new MongoAtlasKnowledgeVectorSearchAdapter(
        collection as never,
        guard.config,
        index,
        "ANN",
        25,
      ),
      {
        search: async () => ({ status: "NO_CANDIDATES", candidates: [] }),
      } as never,
    );
    const rag = new TemplateDraftRagGenerationService({
      flags: { isEnabled: () => true },
      registryGeneration: {
        generate: async () => {
          throw new Error("FALLBACK_FORBIDDEN");
        },
      } as never,
      retrieval,
      port: new GeminiTemplateDraftGenerationAdapter(
        createGeminiGenerationAdapterConfig(environment),
      ),
      validator: new TemplateDraftCandidateValidatorService(),
      baseReviews: new TemplateDraftReviewReportService(),
    });
    const runtime = new TemplateDraftRagRuntimeService(
      new TemplateDraftRagRuntimeBindingService(),
      new InMemoryAiRuntimeBudgetService(TEMPLATE_DRAFT_RAG_EXECUTION_POLICY),
      new ProcessLocalAiRuntimeConcurrencyService(
        TEMPLATE_DRAFT_RAG_EXECUTION_POLICY.maxConcurrentExecutions,
      ),
      new AiRuntimeCircuitBreakerService(AI_PROVIDER_CIRCUIT_POLICY),
      {
        generate: (request, _authorization, deadline, providerObserver) =>
          rag.generate(
            request,
            guard.authorization,
            deadline,
            providerObserver,
          ),
      } as TemplateDraftRagGenerationService,
    );
    const outcomes = [];
    for (const scenario of [
      ...cases,
      { ...cases[0]!, id: "NO_RETRIEVAL_NEEDED" as const },
    ]) {
      const request = input(scenario as (typeof cases)[number]);
      const unresolved =
        scenario.id === "TATA" ? ["LONG", "SHORT", "RESULTS", "RESEARCH"] : [];
      const authoritativeResult = Object.freeze({
        status: unresolved.length ? "UNSUPPORTED_REQUEST" : "PARTIAL",
        validatedCandidate: {
          supportedBindings: unresolved.length
            ? []
            : [
                {
                  requestedConceptIds: ["ETF"],
                  factorKey: "CRYPTO.ETF_NET_FLOW",
                },
              ],
          unresolvedConcepts: unresolved.map((conceptId) => ({ conceptId })),
        },
      });
      const before = JSON.stringify(authoritativeResult);
      const result = await runtime.execute({
        bindingId: "YUDIJI_TEMPLATE_DRAFT_RAG_RUNTIME",
        bindingVersion: 1,
        caller: { userId: "SHADOW_BENCHMARK", isInternal: true },
        request: request as never,
        authoritativeResult,
        features: {
          aiTemplateGenerationEnabled: true,
          knowledgeRetrievalEnabled: true,
          ragTemplateDraftingEnabled: true,
          killSwitch: false,
        },
        requestedAt: new Date(),
      });
      if (
        result.status !== "COMPLETED" ||
        result.comparison?.outcome === "RAG_SAFETY_REGRESSION" ||
        before !== JSON.stringify(authoritativeResult)
      )
        throw new Error(`SHADOW_CASE_FAILED:${scenario.id}`);
      outcomes.push({
        caseId: scenario.id,
        status: result.status,
        comparison: result.comparison,
        trace: result.trace,
        authoritativeEqual: true,
      });
    }
    process.stdout.write(
      `${JSON.stringify({ status: "LIVE_RAG_SHADOW_RUNTIME_VALIDATION_PASSED", requestsExecuted: outcomes.length, outcomes, sideEffects: { templatesPersisted: 0, scoringCalls: 0, compilerCalls: 0 }, productionActivation: false }, null, 2)}\n`,
    );
  } finally {
    await mongoose.disconnect();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  run().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "LIVE_RAG_SHADOW_RUNTIME_VALIDATION_FAILED"}\n`,
    );
    process.exitCode = 1;
  });
