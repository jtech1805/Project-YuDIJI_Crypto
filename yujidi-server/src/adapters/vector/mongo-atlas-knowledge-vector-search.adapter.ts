import { freezeClone } from "../../services/knowledge-document-admission.service.js";
import type { KnowledgeVectorSearchPort } from "../../ports/knowledge-vector-search.port.js";
import type {
  KnowledgeVectorSearchRequest,
  KnowledgeVectorSearchResult,
  KnowledgeUntrustedVectorCandidate,
} from "../../types/knowledge-retrieval.types.js";
import type { KnowledgeVectorIndexDefinition } from "../../types/knowledge-vector-index-definition.types.js";
import type { MongoAtlasVectorAdapterConfig } from "../../config/mongo-atlas-vector.config.js";
import type {
  MongoAtlasAggregateCollection,
  MongoAtlasVectorDiagnostic,
  MongoAtlasVectorFailureCode,
  MongoAtlasVectorSearchMode,
} from "../../types/mongo-atlas-vector-adapter.types.js";

export class MongoAtlasKnowledgeVectorSearchAdapter
  implements KnowledgeVectorSearchPort
{
  private lastDiagnosticValue: MongoAtlasVectorDiagnostic | null = null;
  public constructor(
    private readonly collection: MongoAtlasAggregateCollection,
    private readonly config: MongoAtlasVectorAdapterConfig,
    private readonly definition: KnowledgeVectorIndexDefinition,
    private readonly mode: MongoAtlasVectorSearchMode = "ANN",
    private readonly numCandidates = config.maxNumCandidates,
  ) {}
  public diagnostic(): MongoAtlasVectorDiagnostic | null {
    return this.lastDiagnosticValue
      ? freezeClone(this.lastDiagnosticValue)
      : null;
  }
  public async search(
    request: KnowledgeVectorSearchRequest,
    execution?: Readonly<{ signal: AbortSignal }>,
  ): Promise<KnowledgeVectorSearchResult> {
    const start = Date.now();
    const failure = validateRequest(
      request,
      this.config,
      this.definition,
      this.numCandidates,
      this.mode,
    );
    if (failure) return this.failed(request, failure, start, 0, 0);
    const pipeline = buildMongoAtlasVectorSearchPipeline(
      request,
      this.config,
      this.mode,
      this.numCandidates,
      this.definition,
    );
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        const controller = new AbortController();
        const cancel = composeAbort(execution?.signal, controller);
        const timer = setTimeout(
          () => controller.abort("REQUEST_TIMEOUT"),
          this.config.totalDeadlineMs,
        );
        let rows: Record<string, unknown>[];
        try {
          rows = await this.collection
            .aggregate(pipeline, {
              maxTimeMS: this.config.requestTimeoutMs,
              signal: controller.signal,
            })
            .toArray();
        } finally {
          clearTimeout(timer);
          cancel();
        }
        const parsed = parseRows(rows, request);
        if ("failure" in parsed)
          return this.failed(request, parsed.failure, start, attempts, 0);
        this.lastDiagnosticValue = diagnostic(
          request,
          this.config,
          this.mode,
          this.numCandidates,
          start,
          attempts,
          parsed.candidates.length,
        );
        return freezeClone({
          status: parsed.candidates.length ? "COMPLETED" : "NO_CANDIDATES",
          candidates: parsed.candidates,
        });
      } catch (error) {
        const mapped = mapMongoAtlasError(error);
        if (mapped === "CALLER_ABORTED")
          return this.failed(request, mapped, start, attempts, 0);
        if (
          attempts < 2 &&
          [
            "NETWORK_FAILED",
            "REQUEST_TIMEOUT",
            "PROVIDER_UNAVAILABLE",
          ].includes(mapped)
        )
          continue;
        return this.failed(request, mapped, start, attempts, 0);
      }
    }
    return this.failed(request, "UNKNOWN_PROVIDER_FAILURE", start, attempts, 0);
  }
  private failed(
    request: KnowledgeVectorSearchRequest,
    code: MongoAtlasVectorFailureCode,
    start: number,
    attempts: number,
    count: number,
  ): KnowledgeVectorSearchResult {
    this.lastDiagnosticValue = diagnostic(
      request,
      this.config,
      this.mode,
      this.numCandidates,
      start,
      attempts,
      count,
      code,
    );
    return freezeClone({
      status: status(code),
      candidates: [],
      failureCode: code,
    });
  }
}
const composeAbort = (
  caller: AbortSignal | undefined,
  controller: AbortController,
): (() => void) => {
  const abort = () => controller.abort(caller?.reason ?? "CALLER_ABORTED");
  if (caller?.aborted) abort();
  else caller?.addEventListener("abort", abort, { once: true });
  return () => caller?.removeEventListener("abort", abort);
};

export const buildMongoAtlasVectorSearchPipeline = (
  request: KnowledgeVectorSearchRequest,
  config: MongoAtlasVectorAdapterConfig,
  mode: MongoAtlasVectorSearchMode,
  numCandidates: number,
  definition: KnowledgeVectorIndexDefinition,
): readonly Record<string, unknown>[] => {
  const stage: Record<string, unknown> = {
    index: config.vectorIndexName,
    path: config.vectorPath,
    queryVector: [...request.queryVector],
    limit: request.candidateLimit,
    filter: filter(request, definition),
  };
  if (mode === "ENN_VALIDATION") stage.exact = true;
  else stage.numCandidates = numCandidates;
  return freezeClone([
    { $vectorSearch: stage },
    {
      $project: {
        _id: 0,
        indexEntryId: 1,
        indexEntryVersion: 1,
        indexId: 1,
        indexVersion: 1,
        namespace: 1,
        embeddingIdentity: 1,
        documentIdentity: 1,
        chunkSetIdentity: 1,
        chunkIdentity: 1,
        chunkDigest: 1,
        vectorDigest: 1,
        searchableMetadata: 1,
        providerScore: { $meta: "vectorSearchScore" },
      },
    },
  ]);
};
const filter = (
  request: KnowledgeVectorSearchRequest,
  definition: KnowledgeVectorIndexDefinition,
) => {
  const clauses: any[] = [
    { indexId: { $eq: request.index.indexId } },
    { indexVersion: { $eq: request.index.indexVersion } },
    { namespace: { $eq: request.namespace } },
    {
      "embeddingSchema.embeddingSchemaId": {
        $eq: definition.embeddingSchema.embeddingSchemaId,
      },
    },
    {
      "embeddingSchema.embeddingSchemaVersion": {
        $eq: definition.embeddingSchema.embeddingSchemaVersion,
      },
    },
    { corpus: { $eq: request.corpus } },
    { trustLevel: { $in: [...request.trustLevels] } },
    {
      $or: request.eligibleDocuments.map((value) => ({
        $and: [
          { "documentIdentity.documentId": { $eq: value.documentId } },
          {
            "documentIdentity.documentVersion": { $eq: value.documentVersion },
          },
        ],
      })),
    },
    {
      $or: [
        { "searchableMetadata.effectiveFrom": { $exists: false } },
        {
          "searchableMetadata.effectiveFrom": {
            $lte: new Date(request.asOf.getTime()),
          },
        },
      ],
    },
    {
      $or: [
        { "searchableMetadata.effectiveUntil": { $exists: false } },
        {
          "searchableMetadata.effectiveUntil": {
            $gt: new Date(request.asOf.getTime()),
          },
        },
      ],
    },
  ];
  if (request.documentTypes)
    clauses.push({
      "searchableMetadata.documentType": { $in: [...request.documentTypes] },
    });
  const every = (path: string, values: readonly string[] | undefined) =>
    values?.forEach((value) => clauses.push({ [path]: { $eq: value } }));
  const f = request.filters;
  every("searchableMetadata.factors.factorKey", f?.factorKeys);
  every("searchableMetadata.relationshipTypes", f?.relationshipTypes);
  every("searchableMetadata.subjectTypes", f?.subjectTypes);
  every("searchableMetadata.topics", f?.topics);
  every("searchableMetadata.validationCodes", f?.validationCodes);
  if (f?.adrNumbers)
    clauses.push({
      "searchableMetadata.adr.number": { $in: f.adrNumbers.map(Number) },
    });
  if (f?.exampleClassifications)
    clauses.push({
      "searchableMetadata.exampleClassification": {
        $in: [...f.exampleClassifications],
      },
    });
  return { $and: clauses };
};
const validateRequest = (
  r: KnowledgeVectorSearchRequest,
  c: MongoAtlasVectorAdapterConfig,
  d: KnowledgeVectorIndexDefinition,
  n: number,
  m: MongoAtlasVectorSearchMode,
): MongoAtlasVectorFailureCode | null =>
  !r?.asOf || !Number.isFinite(r.asOf.getTime())
    ? "INVALID_FILTER"
    : !Array.isArray(r.queryVector) ||
        r.queryVector.length !== c.dimension ||
        r.vectorDimension !== c.dimension
      ? "DIMENSION_MISMATCH"
      : r.queryVector.some((value) => !Number.isFinite(value)) ||
          Math.abs(Math.hypot(...r.queryVector) - 1) > 1e-9
        ? "INVALID_VECTOR"
        : r.metric !== "COSINE" ||
            r.index.indexId !== d.indexId ||
            r.index.indexVersion !== d.indexVersion ||
            r.namespace !== d.namespace ||
            r.corpus !== "PLATFORM_KNOWLEDGE" ||
            r.indexSchema.indexSchemaId !== d.indexSchemaId ||
            r.indexSchema.indexSchemaVersion !== d.indexSchemaVersion
          ? "INVALID_FILTER"
          : !Number.isSafeInteger(r.candidateLimit) ||
              r.candidateLimit < 1 ||
              r.candidateLimit > c.maxSearchLimit
            ? "INVALID_LIMIT"
            : m === "ANN" &&
                (!Number.isSafeInteger(n) ||
                  n < r.candidateLimit ||
                  n > c.maxNumCandidates)
              ? "INVALID_NUM_CANDIDATES"
              : !Array.isArray(r.eligibleDocuments) ||
                  !r.eligibleDocuments.length ||
                  r.eligibleDocuments.length > 100 ||
                  r.eligibleDocuments.some(
                    (value) => !identity(value, "documentId"),
                  ) ||
                  !Array.isArray(r.trustLevels) ||
                  !r.trustLevels.length ||
                  r.trustLevels.some(
                    (value) => !d.allowedTrustLevels.includes(value),
                  ) ||
                  !validFilters(r.filters)
                ? "FILTER_TOO_LARGE"
                : null;
const parseRows = (
  rows: Record<string, any>[],
  request: KnowledgeVectorSearchRequest,
):
  | { candidates: readonly KnowledgeUntrustedVectorCandidate[] }
  | { failure: MongoAtlasVectorFailureCode } => {
  if (!Array.isArray(rows) || rows.length > request.candidateLimit)
    return { failure: "RESULT_BOUND_EXCEEDED" };
  const candidates: KnowledgeUntrustedVectorCandidate[] = [];
  const identities = new Set<string>();
  for (let ordinal = 0; ordinal < rows.length; ordinal++) {
    const row = rows[ordinal]!;
    const key = `${row.indexEntryId}:${row.indexEntryVersion}`;
    if (identities.has(key)) return { failure: "DUPLICATE_CANDIDATE" };
    identities.add(key);
    if (
      !identifier(row.indexEntryId) ||
      !positive(row.indexEntryVersion) ||
      row.indexId !== request.index.indexId ||
      row.indexVersion !== request.index.indexVersion ||
      row.namespace !== request.namespace ||
      !identity(row.embeddingIdentity, "embeddingId") ||
      !identity(row.documentIdentity, "documentId") ||
      !identity(row.chunkSetIdentity, "chunkSetId") ||
      !identity(row.chunkIdentity, "chunkId") ||
      !digest(row.chunkDigest) ||
      !digest(row.vectorDigest) ||
      (row.searchableMetadata !== undefined &&
        !validMetadata(row.searchableMetadata))
    )
      return { failure: "MALFORMED_RESULT" };
    if (!Number.isFinite(row.providerScore))
      return { failure: "INVALID_SCORE" };
    candidates.push({
      indexEntryId: row.indexEntryId,
      indexEntryVersion: row.indexEntryVersion,
      index: { indexId: row.indexId, indexVersion: row.indexVersion },
      namespace: row.namespace,
      embeddingIdentity: row.embeddingIdentity,
      documentIdentity: row.documentIdentity,
      chunkSetIdentity: row.chunkSetIdentity,
      chunkIdentity: row.chunkIdentity,
      chunkDigest: row.chunkDigest,
      vectorDigest: row.vectorDigest,
      providerScore: row.providerScore,
      providerOrdinal: ordinal,
      ...(row.searchableMetadata
        ? { searchableMetadata: row.searchableMetadata }
        : {}),
    });
  }
  return { candidates: freezeClone(candidates) };
};
export const mapMongoAtlasError = (
  error: unknown,
): MongoAtlasVectorFailureCode => {
  const value = error as any;
  const code = Number(value?.code);
  const name = String(value?.codeName ?? value?.name ?? "").toLowerCase();
  const message = String(value?.message ?? "").toLowerCase();
  if (name.includes("abort")) return "CALLER_ABORTED";
  if (code === 18 || message.includes("authentication"))
    return "AUTHENTICATION_FAILED";
  if (code === 13 || message.includes("not authorized"))
    return "PERMISSION_DENIED";
  if (code === 26)
    return message.includes("collection")
      ? "COLLECTION_NOT_FOUND"
      : "DATABASE_NOT_FOUND";
  if (code === 50 || name.includes("timeout")) return "REQUEST_TIMEOUT";
  if (name.includes("network") || name.includes("serverselection"))
    return "NETWORK_FAILED";
  if (message.includes("index") && message.includes("building"))
    return "INDEX_BUILDING";
  if (message.includes("index") && message.includes("failed"))
    return "INDEX_FAILED";
  if (message.includes("index") && message.includes("not found"))
    return "INDEX_NOT_FOUND";
  if (message.includes("vector search") && message.includes("unsupported"))
    return "VECTOR_SEARCH_UNSUPPORTED";
  if (message.includes("unavailable")) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN_PROVIDER_FAILURE";
};
const status = (
  code: MongoAtlasVectorFailureCode,
): KnowledgeVectorSearchResult["status"] =>
  code === "INDEX_NOT_FOUND"
    ? "INDEX_NOT_FOUND"
    : code === "DIMENSION_MISMATCH"
      ? "DIMENSION_MISMATCH"
      : code === "INVALID_FILTER"
        ? "VALIDATION_FAILED"
        : "SEARCH_FAILED";
const diagnostic = (
  r: KnowledgeVectorSearchRequest,
  c: MongoAtlasVectorAdapterConfig,
  m: MongoAtlasVectorSearchMode,
  n: number,
  start: number,
  attempt: number,
  count: number,
  failureCode?: MongoAtlasVectorFailureCode,
): MongoAtlasVectorDiagnostic =>
  freezeClone({
    indexId: r.index?.indexId ?? "INVALID",
    indexVersion: r.index?.indexVersion ?? 0,
    namespace: r.namespace ?? "INVALID",
    atlasIndexName: c.vectorIndexName,
    mode: m,
    limit: r.candidateLimit ?? 0,
    ...(m === "ANN" ? { numCandidates: n } : {}),
    filterFieldCount: 10 + (r.filters ? Object.keys(r.filters).length : 0),
    candidateCount: count,
    latencyMs: Math.max(0, Date.now() - start),
    attemptCount: attempt,
    ...(failureCode ? { failureCode } : {}),
  });
const identifier = (value: unknown) =>
  typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value);
const positive = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) > 0;
const digest = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const identity = (value: any, key: string) =>
  value &&
  identifier(value[key]) &&
  positive(value[key.replace("Id", "Version")]);
const validFilters = (value: any) =>
  value === undefined ||
  (value &&
    typeof value === "object" &&
    Object.keys(value).every((key) =>
      [
        "factorKeys",
        "relationshipTypes",
        "subjectTypes",
        "topics",
        "validationCodes",
        "adrNumbers",
        "exampleClassifications",
      ].includes(key),
    ) &&
    Object.values(value).every(
      (items) =>
        Array.isArray(items) &&
        items.length <= 100 &&
        items.every(
          (item) =>
            typeof item === "string" && item.length > 0 && item.length <= 160,
        ),
    ));
const validMetadata = (value: any) =>
  value &&
  typeof value === "object" &&
  Object.keys(value).every((key) =>
    [
      "documentType",
      "chunkType",
      "factors",
      "relationshipTypes",
      "subjectTypes",
      "topics",
      "validationCodes",
      "exampleClassification",
      "adr",
      "effectiveFrom",
      "effectiveUntil",
    ].includes(key),
  ) &&
  typeof value.documentType === "string" &&
  typeof value.chunkType === "string" &&
  Array.isArray(value.factors) &&
  value.factors.length <= 100 &&
  ["relationshipTypes", "subjectTypes", "topics", "validationCodes"].every(
    (key) =>
      Array.isArray(value[key]) &&
      value[key].length <= 100 &&
      value[key].every(
        (item: unknown) => typeof item === "string" && item.length <= 160,
      ),
  ) &&
  [value.effectiveFrom, value.effectiveUntil].every(
    (item) =>
      item === undefined ||
      (item instanceof Date && Number.isFinite(item.getTime())),
  );
