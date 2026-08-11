import { isDeepStrictEqual } from "node:util";
import { KnowledgeDocumentModel } from "../models/knowledge-document.model.js";
import type { AdmittedKnowledgeDocument, KnowledgeDocumentInsertResult, KnowledgeDocumentReadResult, PersistedKnowledgeDocument } from "../types/knowledge-document.types.js";
import { freezeClone } from "../services/knowledge-document-admission.service.js";

type Query<T> = { lean(): { exec(): Promise<T> } };
export type KnowledgeDocumentModelPort = { create(value: unknown): Promise<unknown>; find(filter: Record<string, unknown>): { limit(n: number): Query<Record<string, unknown>[]> } };
export class KnowledgeDocumentRepository {
  public constructor(private readonly model: KnowledgeDocumentModelPort = KnowledgeDocumentModel as unknown as KnowledgeDocumentModelPort) {}
  public async insert(candidate: AdmittedKnowledgeDocument): Promise<KnowledgeDocumentInsertResult> {
    try {
      const rows = await this.matches(candidate.identity.documentId, candidate.identity.documentVersion);
      if (rows.length > 1) return Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" });
      if (rows[0]) return classify(candidate, parse(rows[0]));
      await this.model.create(toRow(candidate));
      const inserted = await this.matches(candidate.identity.documentId, candidate.identity.documentVersion);
      if (inserted.length !== 1) return Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" });
      const value = parse(inserted[0]); return value ? Object.freeze({ inserted: true, document: value }) : Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" });
    } catch (e) {
      if (!duplicate(e)) return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" });
      try { const rows = await this.matches(candidate.identity.documentId, candidate.identity.documentVersion); return rows.length === 1 ? classify(candidate, parse(rows[0])) : Object.freeze({ inserted: false, code: "INVARIANT_VIOLATION" }); }
      catch { return Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" }); }
    }
  }
  public async findExact(documentId: string, documentVersion: number): Promise<KnowledgeDocumentReadResult> {
    try { const rows = await this.matches(documentId, documentVersion); if (rows.length > 1) return Object.freeze({ found: false, code: "INVARIANT_VIOLATION" }); if (!rows[0]) return Object.freeze({ found: false, code: "NOT_FOUND" }); const d = parse(rows[0]); return d ? Object.freeze({ found: true, document: d }) : Object.freeze({ found: false, code: "PERSISTENCE_FAILED" }); }
    catch { return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" }); }
  }
  private matches(id: string, version: number) { return this.model.find({ documentId: id, documentVersion: version }).limit(2).lean().exec(); }
}
const classify = (c: AdmittedKnowledgeDocument, e: PersistedKnowledgeDocument | null): KnowledgeDocumentInsertResult => !e ? Object.freeze({ inserted: false, code: "PERSISTENCE_FAILED" }) : isDeepStrictEqual(c, withoutCreated(e)) ? Object.freeze({ inserted: false, code: "ALREADY_EXISTS", document: e }) : Object.freeze({ inserted: false, code: c.contentDigest === e.contentDigest ? "IDENTITY_CONFLICT" : "CONTENT_CONFLICT" });
const toRow = (d: AdmittedKnowledgeDocument) => ({ documentId: d.identity.documentId, documentVersion: d.identity.documentVersion, corpus: d.corpus, documentType: d.documentType, title: d.title, ownership: d.ownership, source: d.source, trustLevel: d.trustLevel, effectiveFrom: d.effectiveFrom, effectiveUntil: d.effectiveUntil, parser: d.parser, admissionPolicy: d.admissionPolicy, supersedes: d.supersedes, blocks: d.blocks, contentDigest: d.contentDigest });
const parse = (r: Record<string, any> | undefined): PersistedKnowledgeDocument | null => r && r.createdAt instanceof Date ? freezeClone({ identity: { documentId: r.documentId, documentVersion: r.documentVersion }, corpus: r.corpus, documentType: r.documentType, title: r.title, ownership: r.ownership, source: r.source, trustLevel: r.trustLevel, ...(r.effectiveFrom ? { effectiveFrom: r.effectiveFrom } : {}), ...(r.effectiveUntil ? { effectiveUntil: r.effectiveUntil } : {}), parser: r.parser, admissionPolicy: r.admissionPolicy, ...(r.supersedes ? { supersedes: r.supersedes } : {}), blocks: canonicalBlocks(r.blocks), contentDigest: r.contentDigest, createdAt: r.createdAt }) : null;
const canonicalBlocks = (blocks: readonly Record<string, any>[]): PersistedKnowledgeDocument["blocks"] => blocks.map((block) => {
  const { table, ...value } = block;
  const canonical = { ...value, sourceSpan: canonicalSourceSpan(block.sourceSpan) };
  if (table === undefined || (typeof block.text === "string" && Array.isArray(table.headers) && table.headers.length === 0 && Array.isArray(table.rows) && table.rows.length === 0)) return canonical;
  return { ...canonical, table };
}) as unknown as PersistedKnowledgeDocument["blocks"];
const canonicalSourceSpan = (span: Record<string, any>) => {
  const { rowIds, ...value } = span;
  return Array.isArray(rowIds) && rowIds.length === 0 && span.tableId === undefined ? value : span;
};
const withoutCreated = ({ createdAt: _, ...d }: PersistedKnowledgeDocument): AdmittedKnowledgeDocument => d;
const duplicate = (e: unknown) => typeof e === "object" && e !== null && (e as any).code === 11000;
