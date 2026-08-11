import { isDeepStrictEqual } from "node:util";
import { KnowledgeChunkModel } from "../models/knowledge-chunk.model.js";
import type { KnowledgeChunkCandidate, KnowledgeChunkInsertResult, KnowledgeChunkReadResult, StoredKnowledgeChunkSetReadResult, PersistedKnowledgeChunk } from "../types/knowledge-chunk.types.js";
import type { KnowledgeChunkSetStrategyIdentity } from "../types/knowledge-chunk-set-manifest.types.js";
import type { KnowledgeDocumentIdentity } from "../types/knowledge-document.types.js";
import { freezeClone } from "../services/knowledge-document-admission.service.js";

type Query<T> = { lean(): { exec(): Promise<T> } }; type Find<T> = { sort(v: Record<string, 1 | -1>): Query<T[]>; limit(n: number): Query<T[]> };
export type KnowledgeChunkModelPort = { insertMany(values: readonly unknown[], options: { ordered: true }): Promise<unknown>; find(filter: Record<string, unknown>): Find<Record<string, unknown>> };
export class KnowledgeChunkRepository {
  public constructor(private readonly model: KnowledgeChunkModelPort = KnowledgeChunkModel as unknown as KnowledgeChunkModelPort) {}
  public async insertSet(candidates: readonly KnowledgeChunkCandidate[]): Promise<KnowledgeChunkInsertResult> {
    const first = candidates[0]!; try { const existing = await this.loadSet(first); if (existing.length) return classify(candidates, existing); await this.model.insertMany(candidates.map(toRow), { ordered: true }); const inserted = await this.loadSet(first); return inserted.length === candidates.length ? Object.freeze({ inserted: true, chunks: freezeClone(inserted) }) : Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" }); }
    catch (e) { if (!duplicate(e)) return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" }); try { return classify(candidates, await this.loadSet(first)); } catch { return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" }); } }
  }
  public async findExact(chunkId: string, chunkVersion: number): Promise<KnowledgeChunkReadResult> { try { const rows = await this.model.find({ chunkId, chunkVersion }).limit(2).lean().exec(); if (rows.length > 1) return Object.freeze({ found: false, code: "INVARIANT_VIOLATION" }); const parsed = parse(rows[0]); return parsed ? Object.freeze({ found: true, chunk: parsed }) : rows.length ? Object.freeze({ found: false, code: "PERSISTENCE_FAILED" }) : Object.freeze({ found: false, code: "NOT_FOUND" }); } catch { return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" }); } }
  public async findStoredSetForVerification(
    document: KnowledgeDocumentIdentity,
    strategy: KnowledgeChunkSetStrategyIdentity,
  ): Promise<StoredKnowledgeChunkSetReadResult> {
    try {
      const rows = await this.model.find(filter(
        document.documentId,
        document.documentVersion,
        strategy.strategyId,
        strategy.strategyVersion,
      )).sort({ ordinal: 1, chunkId: 1 }).lean().exec();
      if (!rows.length) return Object.freeze({ found: false, code: "NOT_FOUND" });
      const values = rows.map(parse);
      return values.every(Boolean)
        ? Object.freeze({ found: true, chunks: freezeClone(values as PersistedKnowledgeChunk[]) })
        : Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }
  private async loadSet(c: KnowledgeChunkCandidate): Promise<PersistedKnowledgeChunk[]> { const rows = await this.model.find(filter(c.documentIdentity.documentId, c.documentIdentity.documentVersion, c.strategy.strategyId, c.strategy.strategyVersion)).sort({ ordinal: 1, chunkId: 1 }).lean().exec(); return rows.map(parse).filter((v): v is PersistedKnowledgeChunk => !!v); }
}
const filter = (documentId: string, documentVersion: number, strategyId: string, strategyVersion: number) => ({ "documentIdentity.documentId": documentId, "documentIdentity.documentVersion": documentVersion, "strategy.strategyId": strategyId, "strategy.strategyVersion": strategyVersion });
const classify = (incoming: readonly KnowledgeChunkCandidate[], existing: readonly PersistedKnowledgeChunk[]): KnowledgeChunkInsertResult => existing.length === incoming.length && existing.every((e, i) => isDeepStrictEqual(incoming[i], withoutCreated(e))) ? Object.freeze({ inserted: false, code: "ALREADY_EXISTS", chunks: freezeClone(existing) }) : Object.freeze({ inserted: false, code: existing.length ? "CONTENT_CONFLICT" : "INVARIANT_VIOLATION" });
const toRow = (c: KnowledgeChunkCandidate) => ({ chunkId: c.identity.chunkId, chunkVersion: c.identity.chunkVersion, documentIdentity: c.documentIdentity, strategy: c.strategy, chunkType: c.chunkType, ordinal: c.ordinal, content: c.content, sourceSpan: c.sourceSpan, parent: c.parent, metadata: c.metadata, contentDigest: c.contentDigest });
const parse = (r: Record<string, any> | undefined): PersistedKnowledgeChunk | null => r && r.createdAt instanceof Date ? freezeClone({ identity: { chunkId: r.chunkId, chunkVersion: r.chunkVersion }, documentIdentity: r.documentIdentity, strategy: r.strategy, chunkType: r.chunkType, ordinal: r.ordinal, content: r.content, sourceSpan: canonicalSourceSpan(r.sourceSpan), ...(r.parent ? { parent: r.parent } : {}), metadata: r.metadata, contentDigest: r.contentDigest, createdAt: r.createdAt }) : null;
const canonicalSourceSpan = (span: Record<string, any>) => {
  const { rowIds, ...value } = span;
  return Array.isArray(rowIds) && rowIds.length === 0 && span.tableId === undefined ? value : span;
};
const withoutCreated = ({ createdAt: _, ...c }: PersistedKnowledgeChunk): KnowledgeChunkCandidate => c; const duplicate = (e: unknown) => typeof e === "object" && e !== null && (e as any).code === 11000;
