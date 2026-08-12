import mongoose from "mongoose";
import { GeminiKnowledgeEmbeddingAdapter } from "../adapters/ai/gemini-knowledge-embedding.adapter.js";
import { GeminiTemplateDraftGenerationAdapter } from "../adapters/ai/gemini-template-draft-generation.adapter.js";
import { MongoAtlasKnowledgeVectorSearchAdapter } from "../adapters/vector/mongo-atlas-knowledge-vector-search.adapter.js";
import { createFeatureFlagService } from "../config/feature-flags.js";
import { createGeminiEmbeddingAdapterConfig } from "../config/gemini-embedding.config.js";
import { createGeminiGenerationAdapterConfig } from "../config/gemini-generation.config.js";
import { createMongoAtlasVectorAdapterConfig } from "../config/mongo-atlas-vector.config.js";
import { APPLICATION_TEMPLATE_DRAFT_RAG_RETRIEVAL_POLICY } from "../registries/application-template-draft-rag-retrieval.policy.js";
import {
  AI_PROVIDER_CIRCUIT_POLICY,
  TEMPLATE_DRAFT_RAG_EXECUTION_POLICY,
} from "../registries/ai-runtime-execution-policy.registry.js";
import { KnowledgeEmbeddingSchemaRegistry } from "../registries/knowledge-embedding-schema.registry.js";
import { KnowledgeRetrievalPolicyRegistry } from "../registries/knowledge-retrieval-policy.registry.js";
import {
  KnowledgeVectorIndexDefinitionRegistry,
  MONGO_ATLAS_PLATFORM_KNOWLEDGE_VECTOR_INDEX_DEFINITION,
} from "../registries/knowledge-vector-index-definition.registry.js";
import { AiGovernedExecutionContextService } from "../services/ai-runtime/ai-governed-execution-context.service.js";
import { AiRuntimeCircuitBreakerService } from "../services/ai-runtime/ai-runtime-circuit-breaker.service.js";
import { InMemoryAiRuntimeBudgetService } from "../services/ai-runtime/ai-runtime-budget.service.js";
import { ProcessLocalAiRuntimeConcurrencyService } from "../services/ai-runtime/ai-runtime-concurrency.service.js";
import { InternalTemplateDraftRagApplicationService } from "../services/copilot/internal-template-draft-rag-application.service.js";
import { InternalTemplateDraftRagRequestAssemblyService } from "../services/copilot/internal-template-draft-rag-request-assembly.service.js";
import { KnowledgeRetrievalService } from "../services/knowledge/knowledge-retrieval.service.js";
import { TemplateDraftCandidateValidatorService } from "../services/copilot/template-draft-candidate-validator.service.js";
import { TemplateDraftDualPathGovernedExecutionService } from "../services/copilot/template-draft-dual-path-governed-execution.service.js";
import { TemplateDraftGenerationService } from "../services/copilot/template-draft-generation.service.js";
import { TemplateDraftPromptContextService } from "../services/copilot/template-draft-prompt-context.service.js";
import { TemplateDraftRagGenerationService } from "../services/copilot/template-draft-rag-generation.service.js";
import { TemplateDraftRagRuntimeBindingService } from "../services/copilot/template-draft-rag-runtime-binding.service.js";
import { TemplateDraftRagRuntimeService } from "../services/copilot/template-draft-rag-runtime.service.js";
import { TemplateDraftRegistryOnlyBaselineService } from "../services/copilot/template-draft-registry-only-baseline.service.js";
import { TemplateDraftReviewReportService } from "../services/copilot/template-draft-review-report.service.js";
import { GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA } from "../types/gemini-embedding-adapter.types.js";
import { knowledgeVectorIndexPublicationSchema } from "../models/knowledge-vector-index-publication.model.js";
import { knowledgeCorpusPublicationSchema } from "../models/knowledge-corpus-publication.model.js";
import { knowledgeDocumentSchema } from "../models/knowledge-document.model.js";
import { knowledgeChunkSchema } from "../models/knowledge-chunk.model.js";
import { knowledgeEmbeddingSchema } from "../models/knowledge-embedding.model.js";
import { knowledgeChunkSetManifestSchema } from "../models/knowledge-chunk-set-manifest.model.js";
import { knowledgeVectorIndexProjectionSchema } from "../models/knowledge-vector-index-projection.model.js";
import { KnowledgeVectorIndexPublicationRepository } from "../repositories/knowledge-vector-index-publication.repository.js";
import { KnowledgeCorpusPublicationRepository } from "../repositories/knowledge-corpus-publication.repository.js";
import { KnowledgeDocumentRepository } from "../repositories/knowledge-document.repository.js";
import { KnowledgeChunkRepository } from "../repositories/knowledge-chunk.repository.js";
import { KnowledgeEmbeddingRepository } from "../repositories/knowledge-embedding.repository.js";
import { KnowledgeChunkSetManifestRepository } from "../repositories/knowledge-chunk-set-manifest.repository.js";
import { KnowledgeVectorIndexProjectionRepository } from "../repositories/knowledge-vector-index-projection.repository.js";
import { KnowledgeChunkSetVerificationService } from "../services/knowledge/knowledge-chunk-set-verification.service.js";
import { KnowledgeRetrievalCandidateValidationService } from "../services/knowledge/knowledge-retrieval-candidate-validation.service.js";
import { KnowledgeQueryTextService } from "../services/knowledge/knowledge-query-text.service.js";
import { KnowledgeRetrievalRerankingService } from "../services/knowledge/knowledge-retrieval-reranking.service.js";
import { KnowledgeContextAssemblyService } from "../services/knowledge/knowledge-context-assembly.service.js";
import { KnowledgeEmbeddingNormalizationService } from "../services/knowledge/knowledge-embedding-normalization.service.js";
import { PinoInternalRagLifecycleLogger } from "../services/ai-runtime/internal-rag-lifecycle-logger.service.js";
import { GeminiTemplateDraftIntentAdapter } from "../adapters/ai/gemini-template-draft-intent.adapter.js";
import { TemplateDraftIntentExtractionService } from "../services/copilot/template-draft-intent-extraction.service.js";
import { TemplateDraftPromptApplicationService } from "../services/copilot/template-draft-prompt-application.service.js";
import { CopilotTemplateDraftApplicationService } from "../services/copilot/copilot-template-draft-application.service.js";
import { CopilotDraftReviewRepository } from "../repositories/copilot-draft-review.repository.js";
import { CopilotDraftReviewService } from "../services/copilot/copilot-draft-review.service.js";
import { CopilotDraftAcceptanceService } from "../services/copilot/copilot-draft-acceptance.service.js";
import { TemplateDraftAcceptanceValidatorService } from "../services/copilot/template-draft-acceptance-validator.service.js";
import { TemplateDraftProjectionService } from "../services/copilot/template-draft-projection.service.js";
import { TemplateDraftingWorkflowService } from "../services/copilot/template-drafting-workflow.service.js";
import { ScoringTemplateCrudService } from "../services/scoring/scoring-template-crud.service.js";
import { TemplateDraftRegistryProjectionService } from "../services/copilot/template-draft-registry-projection.service.js";
import { createDefaultTemplateDraftAuthorities } from "../services/copilot/internal-template-draft-rag-request-assembly.service.js";

export const createInternalTemplateDraftRagApplicationService = (
  environment: NodeJS.ProcessEnv = process.env,
): InternalTemplateDraftRagApplicationService => {
  const flags = createFeatureFlagService(environment);
  const atlasConfig = createMongoAtlasVectorAdapterConfig({
    ...environment,
    YUDIJI_ATLAS_VECTOR_DATABASE:
      environment.YUDIJI_ATLAS_VECTOR_DATABASE ??
      environment.YUDIJI_KNOWLEDGE_DATABASE ??
      environment.YUDIJI_DEV_KNOWLEDGE_DATABASE,
  });
  const knowledgeDb = mongoose.connection.useDb(atlasConfig.databaseName, {
    useCache: true,
  });
  const model = (name: string, schema: mongoose.Schema) =>
    knowledgeDb.models[name] ?? knowledgeDb.model(name, schema);
  const indexPublications = new KnowledgeVectorIndexPublicationRepository(
    model(
      "KnowledgeVectorIndexPublication",
      knowledgeVectorIndexPublicationSchema,
    ) as never,
  );
  const corpusPublications = new KnowledgeCorpusPublicationRepository(
    model(
      "KnowledgeCorpusPublication",
      knowledgeCorpusPublicationSchema,
    ) as never,
  );
  const documents = new KnowledgeDocumentRepository(
    model("KnowledgeDocument", knowledgeDocumentSchema) as never,
  );
  const chunks = new KnowledgeChunkRepository(
    model("KnowledgeChunk", knowledgeChunkSchema) as never,
  );
  const embeddings = new KnowledgeEmbeddingRepository(
    model("KnowledgeEmbedding", knowledgeEmbeddingSchema) as never,
  );
  const manifests = new KnowledgeChunkSetManifestRepository(
    model(
      "KnowledgeChunkSetManifest",
      knowledgeChunkSetManifestSchema,
    ) as never,
  );
  const projections = new KnowledgeVectorIndexProjectionRepository(
    model(
      "KnowledgeVectorIndexProjection",
      knowledgeVectorIndexProjectionSchema,
    ) as never,
  );
  const binding = new TemplateDraftRagRuntimeBindingService(
    undefined,
    indexPublications,
    corpusPublications,
  );
  const budget = new InMemoryAiRuntimeBudgetService(
    TEMPLATE_DRAFT_RAG_EXECUTION_POLICY,
  );
  const concurrency = new ProcessLocalAiRuntimeConcurrencyService(
    TEMPLATE_DRAFT_RAG_EXECUTION_POLICY.maxConcurrentExecutions,
  );
  const circuits = new AiRuntimeCircuitBreakerService(
    AI_PROVIDER_CIRCUIT_POLICY,
  );
  const generationPort = {
    generate: (
      request: Parameters<GeminiTemplateDraftGenerationAdapter["generate"]>[0],
      execution?: Parameters<
        GeminiTemplateDraftGenerationAdapter["generate"]
      >[1],
    ) =>
      new GeminiTemplateDraftGenerationAdapter(
        createGeminiGenerationAdapterConfig(environment),
      ).generate(request, execution),
  };
  const validator = new TemplateDraftCandidateValidatorService();
  const reviews = new TemplateDraftReviewReportService();
  const baselineGeneration = new TemplateDraftGenerationService({
    flags,
    port: generationPort,
    prompts: new TemplateDraftPromptContextService(),
    validator,
    reviews,
    traces: { record: async () => undefined },
  });
  const schemaRegistry = new KnowledgeEmbeddingSchemaRegistry([
    GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA,
  ]);
  const index = MONGO_ATLAS_PLATFORM_KNOWLEDGE_VECTOR_INDEX_DEFINITION;
  const retrieval = new KnowledgeRetrievalService(
    new KnowledgeRetrievalPolicyRegistry([
      APPLICATION_TEMPLATE_DRAFT_RAG_RETRIEVAL_POLICY,
    ]),
    schemaRegistry,
    new KnowledgeVectorIndexDefinitionRegistry([index], schemaRegistry),
    {
      embed: (request, execution) =>
        new GeminiKnowledgeEmbeddingAdapter(
          createGeminiEmbeddingAdapterConfig(environment),
        ).embed(request, execution),
    },
    {
      search: (request, execution) => {
        const collection = knowledgeDb.collection(atlasConfig.collectionName);
        return new MongoAtlasKnowledgeVectorSearchAdapter(
          collection as never,
          atlasConfig,
          index,
          "ANN",
          25,
        ).search(request, execution);
      },
    },
    { search: async () => ({ status: "NO_CANDIDATES", candidates: [] }) },
    new KnowledgeQueryTextService(),
    new KnowledgeRetrievalCandidateValidationService(
      documents,
      chunks,
      embeddings,
      new KnowledgeChunkSetVerificationService(chunks, manifests),
      projections,
      manifests,
    ),
    new KnowledgeRetrievalRerankingService(),
    new KnowledgeContextAssemblyService(),
    documents,
    new KnowledgeEmbeddingNormalizationService(),
  );
  const ragGeneration = new TemplateDraftRagGenerationService({
    flags,
    registryGeneration: baselineGeneration,
    retrieval,
    port: generationPort,
    validator,
    baseReviews: reviews,
  });
  const runtime = new TemplateDraftRagRuntimeService(
    binding,
    budget,
    concurrency,
    circuits,
    ragGeneration,
    TEMPLATE_DRAFT_RAG_EXECUTION_POLICY.requestDeadlineMs,
  );
  const governance = new AiGovernedExecutionContextService(
    binding,
    budget,
    concurrency,
    TEMPLATE_DRAFT_RAG_EXECUTION_POLICY.requestDeadlineMs,
  );
  const dual = new TemplateDraftDualPathGovernedExecutionService(
    governance,
    new TemplateDraftRegistryOnlyBaselineService(baselineGeneration, circuits),
    runtime,
    circuits,
    budget,
  );
  return new InternalTemplateDraftRagApplicationService(
    new InternalTemplateDraftRagRequestAssemblyService(
      binding,
      documents,
      undefined,
      undefined,
      () => ({
        aiTemplateGenerationEnabled: flags.isEnabled(
          "AI_TEMPLATE_GENERATION_ENABLED",
        ),
        knowledgeRetrievalEnabled: flags.isEnabled(
          "KNOWLEDGE_RETRIEVAL_ENABLED",
        ),
        ragTemplateDraftingEnabled: flags.isEnabled(
          "RAG_TEMPLATE_DRAFTING_ENABLED",
        ),
        killSwitch: environment.YUDIJI_RAG_KILL_SWITCH === "true",
      }),
    ),
    dual,
    new PinoInternalRagLifecycleLogger(),
  );
};

export const createTemplateDraftPromptApplicationService = (
  environment: NodeJS.ProcessEnv = process.env,
): TemplateDraftPromptApplicationService => {
  const lifecycle = new PinoInternalRagLifecycleLogger();
  return new TemplateDraftPromptApplicationService(
    new TemplateDraftIntentExtractionService(
      new GeminiTemplateDraftIntentAdapter(
        createGeminiGenerationAdapterConfig(environment),
      ),
    ),
    createInternalTemplateDraftRagApplicationService(environment),
    lifecycle,
  );
};

export const createCopilotTemplateDraftApplicationService = (
  environment: NodeJS.ProcessEnv = process.env,
): CopilotTemplateDraftApplicationService => {
  const reviewRepository = new CopilotDraftReviewRepository();
  return new CopilotTemplateDraftApplicationService(
    createFeatureFlagService(environment),
    createTemplateDraftPromptApplicationService(environment),
    undefined,
    new PinoInternalRagLifecycleLogger(),
    undefined,
    undefined,
    new CopilotDraftReviewService(reviewRepository),
  );
};

export const createCopilotDraftAcceptanceService = (): CopilotDraftAcceptanceService => {
  const reviews = new CopilotDraftReviewRepository();
  const templates = new ScoringTemplateCrudService();
  const workflow = new TemplateDraftingWorkflowService({
    generation: { generate: async () => { throw new Error("GENERATION_NOT_AVAILABLE_IN_ACCEPTANCE"); } },
    acceptance: new TemplateDraftAcceptanceValidatorService(),
    projection: new TemplateDraftProjectionService(),
    registryProjection: new TemplateDraftRegistryProjectionService(),
    validator: new TemplateDraftCandidateValidatorService(),
    templates,
  });
  return new CopilotDraftAcceptanceService(
    reviews,
    workflow,
    templates,
    createDefaultTemplateDraftAuthorities,
  );
};
