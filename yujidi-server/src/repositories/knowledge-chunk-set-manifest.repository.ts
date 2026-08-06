import { isDeepStrictEqual } from "node:util";
import { KnowledgeChunkSetManifestModel } from "../models/knowledge-chunk-set-manifest.model.js";
import { freezeClone } from "../services/knowledge-document-admission.service.js";
import type {
  KnowledgeChunkSetManifestCommand,
  KnowledgeChunkSetManifestInsertResult,
  KnowledgeChunkSetManifestReadResult,
  KnowledgeChunkSetStrategyIdentity,
  PersistedKnowledgeChunkSetManifest,
} from "../types/knowledge-chunk-set-manifest.types.js";
import type { KnowledgeDocumentIdentity } from "../types/knowledge-document.types.js";

type Query<T> = { lean(): { exec(): Promise<T> } };
export type KnowledgeChunkSetManifestModelPort = Readonly<{
  create(value: unknown): Promise<unknown>;
  find(filter: Record<string, unknown>): { limit(count: number): Query<Record<string, unknown>[]> };
}>;

export class KnowledgeChunkSetManifestRepository {
  public constructor(
    private readonly model: KnowledgeChunkSetManifestModelPort = KnowledgeChunkSetManifestModel as unknown as KnowledgeChunkSetManifestModelPort,
  ) {}

  public async insert(candidate: KnowledgeChunkSetManifestCommand): Promise<KnowledgeChunkSetManifestInsertResult> {
    try {
      const conflict = await this.findConflict(candidate);
      if (conflict) return classify(candidate, conflict);
      await this.model.create(toPersistence(candidate));
      const reread = await this.findBySet(candidate.documentIdentity, candidate.strategy);
      return reread.found
        ? Object.freeze({ inserted: true, manifest: reread.manifest })
        : Object.freeze({ inserted: false, code: reread.code === "NOT_FOUND" ? "INVARIANT_VIOLATION" : reread.code });
    } catch (error) {
      if (!duplicateKey(error)) return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" });
      try {
        const conflict = await this.findConflict(candidate);
        return conflict
          ? classify(candidate, conflict)
          : Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" });
      } catch {
        return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" });
      }
    }
  }

  public async findExact(chunkSetId: string, chunkSetVersion: number): Promise<KnowledgeChunkSetManifestReadResult> {
    return this.read({ chunkSetId, chunkSetVersion });
  }

  public async findBySet(
    document: KnowledgeDocumentIdentity,
    strategy: KnowledgeChunkSetStrategyIdentity,
  ): Promise<KnowledgeChunkSetManifestReadResult> {
    return this.read(setFilter(document, strategy));
  }

  private async findConflict(
    candidate: KnowledgeChunkSetManifestCommand,
  ): Promise<PersistedKnowledgeChunkSetManifest | "CORRUPTED" | null> {
    const byIdentity = await this.rows({
      chunkSetId: candidate.identity.chunkSetId,
      chunkSetVersion: candidate.identity.chunkSetVersion,
    });
    const bySet = await this.rows(setFilter(candidate.documentIdentity, candidate.strategy));
    if (byIdentity.length > 1 || bySet.length > 1) return "CORRUPTED";
    const parsed = [...byIdentity, ...bySet].map(fromPersistence);
    if (parsed.some((value) => value === null)) return "CORRUPTED";
    const distinct = (parsed as PersistedKnowledgeChunkSetManifest[]).filter(
      (value, index, values) => values.findIndex((other) => isDeepStrictEqual(other, value)) === index,
    );
    return distinct.length === 0 ? null : distinct.length === 1 ? distinct[0]! : "CORRUPTED";
  }

  private async read(filter: Record<string, unknown>): Promise<KnowledgeChunkSetManifestReadResult> {
    try {
      const rows = await this.rows(filter);
      if (rows.length === 0) return Object.freeze({ found: false, code: "NOT_FOUND" });
      if (rows.length !== 1) return Object.freeze({ found: false, code: "INVARIANT_VIOLATION" });
      const manifest = fromPersistence(rows[0]);
      return manifest
        ? Object.freeze({ found: true, manifest })
        : Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }

  private rows(filter: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.model.find(filter).limit(2).lean().exec();
  }
}

const classify = (
  candidate: KnowledgeChunkSetManifestCommand,
  existing: PersistedKnowledgeChunkSetManifest | "CORRUPTED",
): KnowledgeChunkSetManifestInsertResult => {
  if (existing === "CORRUPTED") return Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" });
  if (isDeepStrictEqual(candidate, withoutCreatedAt(existing))) {
    return Object.freeze({ inserted: false, code: "ALREADY_EXISTS", manifest: freezeClone(existing) });
  }
  const sameIdentity = candidate.identity.chunkSetId === existing.identity.chunkSetId
    && candidate.identity.chunkSetVersion === existing.identity.chunkSetVersion;
  const sameSet = candidate.documentIdentity.documentId === existing.documentIdentity.documentId
    && candidate.documentIdentity.documentVersion === existing.documentIdentity.documentVersion
    && candidate.strategy.strategyId === existing.strategy.strategyId
    && candidate.strategy.strategyVersion === existing.strategy.strategyVersion;
  return Object.freeze({
    inserted: false,
    code: sameIdentity ? "CONTENT_CONFLICT" : sameSet ? "SET_IDENTITY_CONFLICT" : "IDENTITY_CONFLICT",
  });
};

const setFilter = (document: KnowledgeDocumentIdentity, strategy: KnowledgeChunkSetStrategyIdentity) => ({
  "documentIdentity.documentId": document.documentId,
  "documentIdentity.documentVersion": document.documentVersion,
  "strategy.strategyId": strategy.strategyId,
  "strategy.strategyVersion": strategy.strategyVersion,
});
const toPersistence = (value: KnowledgeChunkSetManifestCommand) => ({
  chunkSetId: value.identity.chunkSetId,
  chunkSetVersion: value.identity.chunkSetVersion,
  documentIdentity: value.documentIdentity,
  strategy: value.strategy,
  expectedChunkCount: value.expectedChunkCount,
  orderedChunks: value.orderedChunks,
  chunkSetDigest: value.chunkSetDigest,
  publicationPolicy: value.publicationPolicy,
});
const fromPersistence = (row: Record<string, any> | undefined): PersistedKnowledgeChunkSetManifest | null =>
  row && row.createdAt instanceof Date
    ? freezeClone({
        identity: { chunkSetId: row.chunkSetId, chunkSetVersion: row.chunkSetVersion },
        documentIdentity: row.documentIdentity,
        strategy: row.strategy,
        expectedChunkCount: row.expectedChunkCount,
        orderedChunks: row.orderedChunks,
        chunkSetDigest: row.chunkSetDigest,
        publicationPolicy: row.publicationPolicy,
        createdAt: row.createdAt,
      })
    : null;
const withoutCreatedAt = ({ createdAt: _, ...manifest }: PersistedKnowledgeChunkSetManifest) => manifest;
const duplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;

