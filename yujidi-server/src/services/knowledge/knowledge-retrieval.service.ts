import type { KnowledgeEmbeddingPort } from "../../ports/knowledge-embedding.port.js";
import type { KnowledgeLexicalSearchPort } from "../../ports/knowledge-lexical-search.port.js";
import type { KnowledgeVectorSearchPort } from "../../ports/knowledge-vector-search.port.js";
import { KnowledgeEmbeddingSchemaRegistry } from "../../registries/knowledge-embedding-schema.registry.js";
import { KnowledgeRetrievalPolicyRegistry } from "../../registries/knowledge-retrieval-policy.registry.js";
import { KnowledgeVectorIndexDefinitionRegistry } from "../../registries/knowledge-vector-index-definition.registry.js";
import { KnowledgeDocumentRepository } from "../../repositories/knowledge-document.repository.js";
import type { KnowledgeEmbeddingProviderResult } from "../../types/knowledge-embedding.types.js";
import type {
  KnowledgeCandidateSource,
  KnowledgeRetrievalCandidate,
  KnowledgeRetrievalRequest,
  KnowledgeRetrievalResult,
} from "../../types/knowledge-retrieval.types.js";
import { KnowledgeContextAssemblyService } from "./knowledge-context-assembly.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import { KnowledgeQueryTextService } from "./knowledge-query-text.service.js";
import { KnowledgeEmbeddingNormalizationService } from "./knowledge-embedding-normalization.service.js";
import { KnowledgeRetrievalCandidateValidationService } from "./knowledge-retrieval-candidate-validation.service.js";
import { KnowledgeRetrievalRerankingService } from "./knowledge-retrieval-reranking.service.js";
import type { KnowledgeRetrievalExecutionAuthorization } from "../../types/knowledge-retrieval-execution-authorization.types.js";
import type { ApplicationRagRetrievalAuthorization } from "../../types/application-rag-retrieval-authorization.types.js";
import { authorizesRetrieval } from "./knowledge-retrieval-execution-authorization.service.js";
import type { AiRuntimeDeadlineContext } from "../../types/ai-runtime-deadline.types.js";
import type { AiProviderExecutionObserver } from "../../types/ai-provider-execution.types.js";

export type KnowledgeRetrievalExecution = Readonly<{
  enabled: boolean;
  contextId: string;
  contextVersion: number;
  authorization?:
    | KnowledgeRetrievalExecutionAuthorization
    | ApplicationRagRetrievalAuthorization;
  deadline?: AiRuntimeDeadlineContext;
  providerObserver?: AiProviderExecutionObserver;
}>;
export class KnowledgeRetrievalService {
  public constructor(
    private readonly policies: KnowledgeRetrievalPolicyRegistry,
    private readonly schemas: KnowledgeEmbeddingSchemaRegistry,
    private readonly indexes: KnowledgeVectorIndexDefinitionRegistry,
    private readonly embedding: KnowledgeEmbeddingPort,
    private readonly vector: KnowledgeVectorSearchPort,
    private readonly lexical: KnowledgeLexicalSearchPort,
    private readonly query = new KnowledgeQueryTextService(),
    private readonly validation = new KnowledgeRetrievalCandidateValidationService(),
    private readonly reranking = new KnowledgeRetrievalRerankingService(),
    private readonly context = new KnowledgeContextAssemblyService(),
    private readonly documents = new KnowledgeDocumentRepository(),
    private readonly normalization = new KnowledgeEmbeddingNormalizationService(),
  ) {}
  public async retrieve(
    request: KnowledgeRetrievalRequest,
    execution: KnowledgeRetrievalExecution,
  ): Promise<KnowledgeRetrievalResult> {
    const empty = (
      status: KnowledgeRetrievalResult["status"],
      failureCode?: string,
    ): KnowledgeRetrievalResult =>
      freezeClone({
        status,
        context: null,
        ...(failureCode ? { failureCode } : {}),
        summary: {
          eligibleDocumentCount: Array.isArray(request?.eligibleDocuments)
            ? request.eligibleDocuments.length
            : 0,
          vectorCandidateCount: 0,
          lexicalCandidateCount: 0,
          validatedCandidateCount: 0,
          selectedPassageCount: 0,
          excludedCount: 0,
        },
      });
    if (!execution.enabled)
      return empty("FEATURE_DISABLED", "RETRIEVAL_DISABLED");
    const policy = this.policies.getExact(
      request.retrievalPolicy.policyId,
      request.retrievalPolicy.policyVersion,
    );
    if (!policy || !validRequest(request, policy))
      return empty("VALIDATION_FAILED", "INVALID_REQUEST_OR_POLICY");
    const schema = this.schemas.getExact(
      request.embeddingSchema.embeddingSchemaId,
      request.embeddingSchema.embeddingSchemaVersion,
    );
    if (!schema) return empty("EMBEDDING_SCHEMA_NOT_FOUND");
    if (!schema.allowedPurposes.includes("RETRIEVAL_QUERY"))
      return empty("QUERY_EMBEDDING_FAILED", "PURPOSE_NOT_ALLOWED");
    const index = this.indexes.getExact(
      request.vectorIndex.indexId,
      request.vectorIndex.indexVersion,
    );
    if (!index) return empty("INDEX_DEFINITION_NOT_FOUND");
    if (
      !index.retrievalEligible &&
      !authorizesRetrieval(execution.authorization, index)
    )
      return empty("INDEX_INELIGIBLE");
    if (
      index.embeddingSchema.embeddingSchemaId !== schema.embeddingSchemaId ||
      index.embeddingSchema.embeddingSchemaVersion !==
        schema.embeddingSchemaVersion ||
      index.vectorDimension !== schema.vectorDimension ||
      index.similarityMetric !== schema.similarityMetric
    )
      return empty("VALIDATION_FAILED", "INDEX_SCHEMA_MISMATCH");
    const eligible = await validateEligibleDocuments(
      request,
      policy,
      this.documents,
    );
    if (eligible) return empty("VALIDATION_FAILED", eligible);
    const projected = this.query.project(request, schema);
    if (!projected || projected.characterCount > policy.maxQueryCharacters * 3)
      return empty("VALIDATION_FAILED", "QUERY_PROJECTION_FAILED");
    let provider: KnowledgeEmbeddingProviderResult;
    try {
      execution.deadline?.enter("EMBEDDING");
      provider = await this.embedding.embed(
        {
          purpose: "RETRIEVAL_QUERY",
          requestId: request.requestId,
          requestVersion: request.requestVersion,
          schemaIdentity: request.embeddingSchema,
          providerIdentity: {
            providerId: schema.providerId,
            providerVersion: schema.providerVersion,
          },
          modelIdentity: {
            modelId: schema.modelId,
            modelVersion: schema.modelVersion,
          },
          inputs: [
            {
              inputId: "RETRIEVAL_QUERY",
              chunkId: "TRANSIENT_QUERY",
              chunkVersion: 1,
              text: projected.text,
              textDigest: projected.textDigest,
            },
          ],
        },
        execution.deadline ? { signal: execution.deadline.signal } : undefined,
      );
      if (provider.providerOutcome) {
        execution.providerObserver?.record(
          "QUERY_EMBEDDING",
          provider.providerOutcome,
        );
      }
      execution.deadline?.complete("EMBEDDING");
      execution.deadline?.throwIfExpired("RETRIEVAL");
    } catch (error) {
      execution.deadline?.complete("EMBEDDING");
      throw error;
    }
    const rawQueryVector = validateQueryVector(provider, schema);
    if (!rawQueryVector)
      return empty("QUERY_EMBEDDING_FAILED", "QUERY_PROVIDER_OUTPUT_INVALID");
    const normalized = this.normalization.normalize(
      {
        normalizationStrategyId: schema.normalizationStrategyId,
        normalizationStrategyVersion: schema.normalizationStrategyVersion,
      },
      rawQueryVector,
    );
    if (normalized.status === "FAILED")
      return empty("QUERY_EMBEDDING_FAILED", normalized.failureCode);
    const queryVector = normalized.vector;
    let partial = false;
    let vectors: any = { status: "NO_CANDIDATES", candidates: [] };
    if (policy.includeVectorSearch) {
      execution.deadline?.enter("RETRIEVAL");
      try {
        vectors = await this.vector.search(
          freezeClone({
            index: request.vectorIndex,
            namespace: index.namespace,
            indexSchema: {
              indexSchemaId: index.indexSchemaId,
              indexSchemaVersion: index.indexSchemaVersion,
            },
            asOf: new Date(request.asOf.getTime()),
            queryVector,
            vectorDimension: index.vectorDimension,
            metric: index.similarityMetric,
            candidateLimit: policy.vectorCandidateLimit,
            corpus: "PLATFORM_KNOWLEDGE",
            trustLevels: request.scope.trustLevels,
            ...(request.scope.documentTypes
              ? { documentTypes: request.scope.documentTypes }
              : {}),
            ...(request.filters ? { filters: request.filters } : {}),
            eligibleDocuments: request.eligibleDocuments,
          }),
          execution.deadline
            ? { signal: execution.deadline.signal }
            : undefined,
        );
        if (vectors.providerOutcome) {
          execution.providerObserver?.record(
            "VECTOR_RETRIEVAL",
            vectors.providerOutcome,
          );
        }
        execution.deadline?.complete("RETRIEVAL");
        execution.deadline?.throwIfExpired("CONTEXT_ASSEMBLY");
      } catch (error) {
        execution.deadline?.complete("RETRIEVAL");
        throw error;
      }
      if (!["COMPLETED", "NO_CANDIDATES"].includes(vectors.status)) {
        if (policy.vectorFailureFallback !== "LEXICAL_ONLY")
          return empty(
            "VECTOR_SEARCH_FAILED",
            vectors.failureCode ?? vectors.status,
          );
        partial = true;
      }
    }
    let lexicals: any = { status: "NO_CANDIDATES", candidates: [] };
    if (policy.includeLexicalSearch) {
      try {
        lexicals = await this.lexical.search({
          queryText: projected.text,
          concepts: request.query.concepts,
          candidateLimit: policy.lexicalCandidateLimit,
          ...(request.filters ? { filters: request.filters } : {}),
          eligibleDocuments: request.eligibleDocuments,
        });
      } catch {
        lexicals = { status: "SEARCH_FAILED", candidates: [] };
      }
      if (!["COMPLETED", "NO_CANDIDATES"].includes(lexicals.status)) {
        if (policy.lexicalFailureFallback !== "VECTOR_ONLY")
          return empty(
            "LEXICAL_SEARCH_FAILED",
            lexicals.failureCode ?? lexicals.status,
          );
        partial = true;
      }
    }
    execution.deadline?.enter("CONTEXT_ASSEMBLY");
    const candidates = merge(
      vectors.candidates ?? [],
      lexicals.candidates ?? [],
    );
    const checked = await this.validation.validate(candidates, request, policy);
    const ranked = this.reranking.rank(checked.valid, policy);
    const assembled = this.context.assemble({
      contextId: execution.contextId,
      contextVersion: execution.contextVersion,
      request,
      policy,
      query: projected,
      candidates: ranked,
      excluded: checked.excluded,
      partial,
    });
    execution.deadline?.complete("CONTEXT_ASSEMBLY");
    if (!assembled) return empty("CITATION_ASSEMBLY_FAILED");
    const status = assembled.passages.length
      ? partial
        ? "PARTIAL"
        : "COMPLETED"
      : "NO_CONTEXT";
    return freezeClone({
      status,
      context: assembled,
      summary: {
        eligibleDocumentCount: request.eligibleDocuments.length,
        vectorCandidateCount: vectors.candidates?.length ?? 0,
        lexicalCandidateCount: lexicals.candidates?.length ?? 0,
        validatedCandidateCount: checked.valid.length,
        selectedPassageCount: assembled.passages.length,
        excludedCount: assembled.excludedCandidates.length,
      },
    });
  }
}
const validRequest = (r: KnowledgeRetrievalRequest, p: any) =>
  /^[A-Z0-9_.:-]{1,160}$/.test(r.requestId) &&
  Number.isSafeInteger(r.requestVersion) &&
  r.requestVersion > 0 &&
  r.query.text.trim().length > 0 &&
  r.query.text.length <= p.maxQueryCharacters &&
  r.query.concepts.length <= p.maxQueryConcepts &&
  r.scope.corpus === "PLATFORM_KNOWLEDGE" &&
  r.scope.trustLevels.length > 0 &&
  r.scope.trustLevels.every((x: string) => p.allowedTrustLevels.includes(x)) &&
  r.eligibleDocuments.length > 0 &&
  r.eligibleDocuments.length <= p.maxEligibleDocuments &&
  new Set(
    r.eligibleDocuments.map((x) => `${x.documentId}:${x.documentVersion}`),
  ).size === r.eligibleDocuments.length &&
  r.asOf instanceof Date &&
  Number.isFinite(r.asOf.getTime()) &&
  Object.values(r.filters ?? {}).every(
    (v) => Array.isArray(v) && new Set(v).size === v.length,
  );
const validateQueryVector = (
  r: KnowledgeEmbeddingProviderResult,
  s: any,
): readonly number[] | null =>
  r.status === "COMPLETED" &&
  r.providerId === s.providerId &&
  r.providerVersion === s.providerVersion &&
  r.modelId === s.modelId &&
  r.modelVersion === s.modelVersion &&
  r.vectors.length === 1 &&
  r.vectors[0]?.inputId === "RETRIEVAL_QUERY" &&
  r.vectors[0].values.length === s.vectorDimension &&
  r.vectors[0].values.every(Number.isFinite)
    ? r.vectors[0].values
    : null;
const validateEligibleDocuments = async (
  r: KnowledgeRetrievalRequest,
  p: any,
  repo: KnowledgeDocumentRepository,
): Promise<string | null> => {
  const docs = [];
  for (const id of r.eligibleDocuments) {
    const read = await repo.findExact(id.documentId, id.documentVersion);
    if (!read.found)
      return read.code === "NOT_FOUND"
        ? "ELIGIBLE_DOCUMENT_NOT_FOUND"
        : "ELIGIBLE_DOCUMENT_READ_FAILED";
    const d = read.document;
    if (
      d.corpus !== "PLATFORM_KNOWLEDGE" ||
      !p.allowedCorpora.includes(d.corpus)
    )
      return "ELIGIBLE_DOCUMENT_CORPUS_MISMATCH";
    if (
      !r.scope.trustLevels.includes(d.trustLevel) ||
      !p.allowedTrustLevels.includes(d.trustLevel)
    )
      return "ELIGIBLE_DOCUMENT_TRUST_MISMATCH";
    if (
      r.scope.documentTypes &&
      !r.scope.documentTypes.includes(d.documentType)
    )
      return "ELIGIBLE_DOCUMENT_TYPE_MISMATCH";
    if (
      (d.effectiveFrom && d.effectiveFrom.getTime() > r.asOf.getTime()) ||
      (d.effectiveUntil && r.asOf.getTime() >= d.effectiveUntil.getTime())
    )
      return "ELIGIBLE_DOCUMENT_OUTSIDE_EFFECTIVE_TIME";
    docs.push(d);
  }
  for (const d of docs) {
    if (!d.supersedes) continue;
    if (
      d.supersedes.documentId === d.identity.documentId &&
      d.supersedes.documentVersion === d.identity.documentVersion
    )
      return "MALFORMED_SUPERSESSION";
  }
  return null;
};
const merge = (
  vectors: any[],
  lexicals: any[],
): readonly KnowledgeRetrievalCandidate[] => {
  const map = new Map<string, any>();
  const add = (
    d: any,
    c: any,
    source: KnowledgeCandidateSource,
    matched: string[] = [],
  ) => {
    const key = `${d.documentId}:${d.documentVersion}:${c.chunkId}:${c.chunkVersion}`,
      prior = map.get(key) ?? {
        documentIdentity: d,
        chunkIdentity: c,
        sources: [],
        matchedFilters: [],
      };
    if (!prior.sources.some((x: any) => x.type === source.type))
      prior.sources.push(source);
    prior.matchedFilters = [
      ...new Set([...prior.matchedFilters, ...matched]),
    ].sort();
    map.set(key, prior);
  };
  for (const x of vectors)
    add(x.documentIdentity, x.chunkIdentity, {
      type: "VECTOR",
      rawScore: x.providerScore,
      providerOrdinal: x.providerOrdinal,
      indexEntryId: x.indexEntryId,
      indexEntryVersion: x.indexEntryVersion,
      index: x.index,
      namespace: x.namespace,
      embeddingIdentity: x.embeddingIdentity,
      chunkSetIdentity: x.chunkSetIdentity,
      indexedChunkDigest: x.chunkDigest,
      indexedVectorDigest: x.vectorDigest,
      ...(x.searchableMetadata
        ? { searchableMetadata: x.searchableMetadata }
        : {}),
    });
  for (const x of lexicals)
    add(
      x.documentIdentity,
      x.chunkIdentity,
      { type: "LEXICAL", rawScore: x.score },
      x.matchedFilters,
    );
  return freezeClone(
    [...map.values()].sort(
      (a, b) =>
        a.documentIdentity.documentId.localeCompare(
          b.documentIdentity.documentId,
        ) ||
        a.documentIdentity.documentVersion -
          b.documentIdentity.documentVersion ||
        a.chunkIdentity.chunkId.localeCompare(b.chunkIdentity.chunkId) ||
        a.chunkIdentity.chunkVersion - b.chunkIdentity.chunkVersion,
    ),
  );
};
