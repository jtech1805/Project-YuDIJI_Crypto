import { isDeepStrictEqual } from "node:util";
import { KnowledgeEmbeddingModel } from "../models/knowledge-embedding.model.js";
import { freezeClone } from "../services/knowledge/knowledge-document-admission.service.js";
import type {
  KnowledgeEmbeddingCommand,
  KnowledgeEmbeddingIdentity,
  KnowledgeEmbeddingInsertResult,
  KnowledgeEmbeddingListResult,
  KnowledgeEmbeddingReadResult,
  KnowledgeEmbeddingSchemaIdentity,
  PersistedKnowledgeEmbedding,
} from "../types/knowledge-embedding.types.js";
import type { KnowledgeChunkIdentity } from "../types/knowledge-chunk.types.js";

type Query<T> = { lean(): { exec(): Promise<T> } };
export type KnowledgeEmbeddingModelPort = Readonly<{
  create(value: unknown): Promise<unknown>;
  find(filter: Record<string, unknown>): {
    sort(value: Record<string, 1 | -1>): Query<Record<string, unknown>[]>;
    limit(count: number): Query<Record<string, unknown>[]>;
  };
}>;

export class KnowledgeEmbeddingRepository {
  public constructor(
    private readonly model: KnowledgeEmbeddingModelPort = KnowledgeEmbeddingModel as unknown as KnowledgeEmbeddingModelPort,
  ) {}

  public async insert(candidate: KnowledgeEmbeddingCommand): Promise<KnowledgeEmbeddingInsertResult> {
    try {
      const conflict = await this.findConflict(candidate);
      if (conflict) return classify(candidate, conflict);
      await this.model.create(toPersistence(candidate));
      const reread = await this.findExact(candidate.identity);
      return reread.found
        ? Object.freeze({ inserted: true, embedding: reread.embedding })
        : Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" });
    } catch (error) {
      if (!duplicateKey(error)) return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" });
      try {
        const conflict = await this.findConflict(candidate);
        return conflict ? classify(candidate, conflict) : Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" });
      } catch {
        return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" });
      }
    }
  }

  public async findExact(identity: KnowledgeEmbeddingIdentity): Promise<KnowledgeEmbeddingReadResult> {
    try {
      const rows = await this.rows({ embeddingId: identity.embeddingId, embeddingVersion: identity.embeddingVersion }, 2);
      if (rows.length === 0) return Object.freeze({ found: false, code: "NOT_FOUND" });
      if (rows.length !== 1) return Object.freeze({ found: false, code: "INVARIANT_VIOLATION" });
      const embedding = fromPersistence(rows[0]);
      return embedding
        ? Object.freeze({ found: true, embedding })
        : Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }

  public async findExactForChunkAndSchema(
    chunk: KnowledgeChunkIdentity,
    schema: KnowledgeEmbeddingSchemaIdentity,
  ): Promise<KnowledgeEmbeddingListResult> {
    try {
      const rows = await this.model.find(lineageFilter(chunk, schema))
        .sort({ embeddingId: 1, embeddingVersion: 1 }).lean().exec();
      if (rows.length === 0) return Object.freeze({ found: false, code: "NOT_FOUND" });
      const embeddings = rows.map(fromPersistence);
      return embeddings.every(Boolean)
        ? Object.freeze({ found: true, embeddings: freezeClone(embeddings as PersistedKnowledgeEmbedding[]) })
        : Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }

  private async findConflict(candidate: KnowledgeEmbeddingCommand): Promise<PersistedKnowledgeEmbedding | "CORRUPTED" | null> {
    const identityRows = await this.rows({
      embeddingId: candidate.identity.embeddingId,
      embeddingVersion: candidate.identity.embeddingVersion,
    }, 2);
    const lineageRows = await this.rows(lineageFilter(candidate.chunkIdentity, candidate.embeddingSchema), 2);
    if (identityRows.length > 1 || lineageRows.length > 1) return "CORRUPTED";
    const parsed = [...identityRows, ...lineageRows].map(fromPersistence);
    if (parsed.some((value) => value === null)) return "CORRUPTED";
    const distinct = (parsed as PersistedKnowledgeEmbedding[]).filter(
      (value, index, values) => values.findIndex((other) => isDeepStrictEqual(other, value)) === index,
    );
    return distinct.length === 0 ? null : distinct.length === 1 ? distinct[0]! : "CORRUPTED";
  }

  private rows(filter: Record<string, unknown>, limit: number): Promise<Record<string, unknown>[]> {
    return this.model.find(filter).limit(limit).lean().exec();
  }
}

const classify = (
  candidate: KnowledgeEmbeddingCommand,
  existing: PersistedKnowledgeEmbedding | "CORRUPTED",
): KnowledgeEmbeddingInsertResult => {
  if (existing === "CORRUPTED") return Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" });
  const material = withoutCreatedAt(existing);
  if (isDeepStrictEqual(candidate, material)) {
    return Object.freeze({ inserted: false, code: "ALREADY_EXISTS", embedding: freezeClone(existing) });
  }
  const sameIdentity = candidate.identity.embeddingId === existing.identity.embeddingId
    && candidate.identity.embeddingVersion === existing.identity.embeddingVersion;
  const sameLineage = isDeepStrictEqual(lineage(candidate), lineage(existing));
  return Object.freeze({
    inserted: false,
    code: sameIdentity && sameLineage ? "CONTENT_CONFLICT" : sameIdentity ? "IDENTITY_CONFLICT" : "LINEAGE_CONFLICT",
  });
};

const lineage = (value: KnowledgeEmbeddingCommand | PersistedKnowledgeEmbedding) => ({
  chunkIdentity: value.chunkIdentity,
  embeddingSchema: value.embeddingSchema,
  embeddingTextProjector: value.embeddingTextProjector,
  purpose: value.purpose,
  normalizationStrategy: value.normalizationStrategy,
});
const lineageFilter = (chunk: KnowledgeChunkIdentity, schema: KnowledgeEmbeddingSchemaIdentity) => ({
  "chunkIdentity.chunkId": chunk.chunkId,
  "chunkIdentity.chunkVersion": chunk.chunkVersion,
  "embeddingSchema.embeddingSchemaId": schema.embeddingSchemaId,
  "embeddingSchema.embeddingSchemaVersion": schema.embeddingSchemaVersion,
});
const toPersistence = (value: KnowledgeEmbeddingCommand) => ({
  embeddingId: value.identity.embeddingId,
  embeddingVersion: value.identity.embeddingVersion,
  chunkSetIdentity: value.chunkSetIdentity,
  documentIdentity: value.documentIdentity,
  chunkIdentity: value.chunkIdentity,
  chunkContentDigest: value.chunkContentDigest,
  embeddingTextProjector: value.embeddingTextProjector,
  embeddingTextDigest: value.embeddingTextDigest,
  provider: value.provider,
  model: value.model,
  embeddingSchema: value.embeddingSchema,
  normalizationStrategy: value.normalizationStrategy,
  purpose: value.purpose,
  vectorDimension: value.vectorDimension,
  vector: [...value.vector],
  vectorDigest: value.vectorDigest,
  corpus: value.corpus,
  trustLevel: value.trustLevel,
});
const fromPersistence = (row: Record<string, any> | undefined): PersistedKnowledgeEmbedding | null =>
  row && row.createdAt instanceof Date && Array.isArray(row.vector)
    ? freezeClone({
        identity: { embeddingId: row.embeddingId, embeddingVersion: row.embeddingVersion },
        chunkSetIdentity: row.chunkSetIdentity,
        documentIdentity: row.documentIdentity,
        chunkIdentity: row.chunkIdentity,
        chunkContentDigest: row.chunkContentDigest,
        embeddingTextProjector: row.embeddingTextProjector,
        embeddingTextDigest: row.embeddingTextDigest,
        provider: row.provider,
        model: row.model,
        embeddingSchema: row.embeddingSchema,
        normalizationStrategy: row.normalizationStrategy,
        purpose: row.purpose,
        vectorDimension: row.vectorDimension,
        vector: row.vector,
        vectorDigest: row.vectorDigest,
        corpus: row.corpus,
        trustLevel: row.trustLevel,
        createdAt: row.createdAt,
      })
    : null;
const withoutCreatedAt = ({ createdAt: _, ...embedding }: PersistedKnowledgeEmbedding): KnowledgeEmbeddingCommand => embedding;
const duplicateKey = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
