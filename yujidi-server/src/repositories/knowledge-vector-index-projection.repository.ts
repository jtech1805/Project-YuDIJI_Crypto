import { isDeepStrictEqual } from "node:util";
import { KnowledgeVectorIndexProjectionModel } from "../models/knowledge-vector-index-projection.model.js";
import { freezeClone } from "../services/knowledge/knowledge-document-admission.service.js";
import type {
  KnowledgeVectorIndexProjectionCommand,
  KnowledgeVectorIndexProjectionInsertResult,
  KnowledgeVectorIndexProjectionReadResult,
  PersistedKnowledgeVectorIndexProjection,
} from "../types/knowledge-vector-index-projection.types.js";

type Query = { lean(): { exec(): Promise<Record<string, unknown>[]> } };
export type KnowledgeVectorIndexProjectionModelPort = Readonly<{
  create(value: unknown): Promise<unknown>;
  find(filter: Record<string, unknown>): { limit(count: number): Query };
}>;

export class KnowledgeVectorIndexProjectionRepository {
  public constructor(private readonly model: KnowledgeVectorIndexProjectionModelPort = KnowledgeVectorIndexProjectionModel as unknown as KnowledgeVectorIndexProjectionModelPort) {}

  public async insertExact(candidate: KnowledgeVectorIndexProjectionCommand): Promise<KnowledgeVectorIndexProjectionInsertResult> {
    try {
      const conflict = await this.findConflict(candidate);
      if (conflict) return classify(candidate, conflict);
      await this.model.create(toPersistence(candidate));
      const reread = await this.findExactByEntryIdentity(candidate.identity.indexEntryId, candidate.identity.indexEntryVersion);
      return reread.found
        ? Object.freeze({ status: "CREATED", projection: reread.projection })
        : Object.freeze({ status: reread.code === "NOT_FOUND" ? "INVARIANT_VIOLATION" : reread.code });
    } catch (error) {
      if (!duplicateKey(error)) return Object.freeze({ status: "PERSISTENCE_FAILED" });
      try {
        const conflict = await this.findConflict(candidate);
        return conflict ? classify(candidate, conflict) : Object.freeze({ status: "INVARIANT_VIOLATION" });
      } catch {
        return Object.freeze({ status: "PERSISTENCE_FAILED" });
      }
    }
  }

  public async findExactByEntryIdentity(indexEntryId: string, indexEntryVersion: number): Promise<KnowledgeVectorIndexProjectionReadResult> {
    return this.read({ indexEntryId, indexEntryVersion });
  }

  public async findExactByPublicationTarget(target: Readonly<{ indexId: string; indexVersion: number; namespace: string; embeddingId: string; embeddingVersion: number }>): Promise<KnowledgeVectorIndexProjectionReadResult> {
    return this.read(targetFilter(target));
  }

  private async findConflict(candidate: KnowledgeVectorIndexProjectionCommand): Promise<PersistedKnowledgeVectorIndexProjection | "CORRUPTED" | null> {
    const identityRows = await this.rows({ indexEntryId: candidate.identity.indexEntryId, indexEntryVersion: candidate.identity.indexEntryVersion });
    const targetRows = await this.rows(targetFilter({
      ...candidate.indexDefinitionIdentity,
      namespace: candidate.namespace,
      ...candidate.embeddingIdentity,
    }));
    if (identityRows.length > 1 || targetRows.length > 1) return "CORRUPTED";
    const values = [...identityRows, ...targetRows].map(fromPersistence);
    if (values.some((value) => value === null)) return "CORRUPTED";
    const distinct = (values as PersistedKnowledgeVectorIndexProjection[]).filter((value, index, all) => all.findIndex((other) => isDeepStrictEqual(other, value)) === index);
    return distinct.length === 0 ? null : distinct.length === 1 ? distinct[0]! : "CORRUPTED";
  }

  private async read(filter: Record<string, unknown>): Promise<KnowledgeVectorIndexProjectionReadResult> {
    try {
      const rows = await this.rows(filter);
      if (!rows.length) return Object.freeze({ found: false, code: "NOT_FOUND" });
      if (rows.length !== 1) return Object.freeze({ found: false, code: "INVARIANT_VIOLATION" });
      const projection = fromPersistence(rows[0]);
      return projection ? Object.freeze({ found: true, projection }) : Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }

  private rows(filter: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.model.find(filter).limit(2).lean().exec();
  }
}

const classify = (candidate: KnowledgeVectorIndexProjectionCommand, existing: PersistedKnowledgeVectorIndexProjection | "CORRUPTED"): KnowledgeVectorIndexProjectionInsertResult => {
  if (existing === "CORRUPTED") return Object.freeze({ status: "INVARIANT_VIOLATION" });
  return isDeepStrictEqual(candidate, withoutCreatedAt(existing))
    ? Object.freeze({ status: "ALREADY_EXISTS", projection: freezeClone(existing) })
    : Object.freeze({ status: "CONFLICT" });
};
const targetFilter = (target: Readonly<{ indexId: string; indexVersion: number; namespace: string; embeddingId: string; embeddingVersion: number }>) => ({ indexId: target.indexId, indexVersion: target.indexVersion, namespace: target.namespace, "embeddingIdentity.embeddingId": target.embeddingId, "embeddingIdentity.embeddingVersion": target.embeddingVersion });
const toPersistence = (value: KnowledgeVectorIndexProjectionCommand) => ({ indexEntryId: value.identity.indexEntryId, indexEntryVersion: value.identity.indexEntryVersion, indexId: value.indexDefinitionIdentity.indexId, indexVersion: value.indexDefinitionIdentity.indexVersion, namespace: value.namespace, metadataSchema: value.metadataSchema, embeddingIdentity: value.embeddingIdentity, embeddingSchema: value.embeddingSchema, purpose: value.purpose, normalizationStrategy: value.normalizationStrategy, vectorDimension: value.vectorDimension, similarityMetric: value.similarityMetric, vectorDigest: value.vectorDigest, vector: [...value.vector], documentIdentity: value.documentIdentity, chunkSetIdentity: value.chunkSetIdentity, chunkIdentity: value.chunkIdentity, chunkDigest: value.chunkDigest, corpus: value.corpus, trustLevel: value.trustLevel, searchableMetadata: value.searchableMetadata, projectionDigest: value.projectionDigest });
const fromPersistence = (row: Record<string, any> | undefined): PersistedKnowledgeVectorIndexProjection | null => row && row.createdAt instanceof Date && Array.isArray(row.vector) ? freezeClone({ identity: { indexEntryId: row.indexEntryId, indexEntryVersion: row.indexEntryVersion }, indexDefinitionIdentity: { indexId: row.indexId, indexVersion: row.indexVersion }, namespace: row.namespace, metadataSchema: row.metadataSchema, embeddingIdentity: row.embeddingIdentity, embeddingSchema: row.embeddingSchema, purpose: row.purpose, normalizationStrategy: row.normalizationStrategy, vectorDimension: row.vectorDimension, similarityMetric: row.similarityMetric, vectorDigest: row.vectorDigest, vector: row.vector, documentIdentity: row.documentIdentity, chunkSetIdentity: row.chunkSetIdentity, chunkIdentity: row.chunkIdentity, chunkDigest: row.chunkDigest, corpus: row.corpus, trustLevel: row.trustLevel, searchableMetadata: row.searchableMetadata, projectionDigest: row.projectionDigest, createdAt: row.createdAt }) : null;
const withoutCreatedAt = ({ createdAt: _, ...value }: PersistedKnowledgeVectorIndexProjection): KnowledgeVectorIndexProjectionCommand => value;
const duplicateKey = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
