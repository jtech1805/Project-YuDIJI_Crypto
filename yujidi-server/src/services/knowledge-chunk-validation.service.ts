import { CanonicalCompilationInputService } from "./canonical-compilation-input.service.js";
import { freezeClone, validSourceSpan } from "./knowledge-document-admission.service.js";
import { KNOWLEDGE_CHUNK_TYPES, type KnowledgeChunkCandidate } from "../types/knowledge-chunk.types.js";
import { KNOWLEDGE_CHUNK_VALIDATION_POLICY, type KnowledgeChunkValidationPolicy, type KnowledgeChunkValidationResult } from "../types/knowledge-chunking.types.js";
import type { KnowledgeDocumentIdentity } from "../types/knowledge-document.types.js";

export class KnowledgeChunkValidationService {
  public constructor(private readonly policy: KnowledgeChunkValidationPolicy = KNOWLEDGE_CHUNK_VALIDATION_POLICY, private readonly canonical = new CanonicalCompilationInputService()) {}
  public validate(input: { chunks: readonly KnowledgeChunkCandidate[]; documentIdentity: KnowledgeDocumentIdentity; strategy: { strategyId: string; strategyVersion: number } }): KnowledgeChunkValidationResult {
    const chunks = input.chunks; if (!Array.isArray(chunks) || !dense(chunks) || chunks.length === 0) return fail("EMPTY_SET"); if (chunks.length > this.policy.maxChunks) return fail("BOUNDS_EXCEEDED");
    const identities = chunks.map(key), ordinals = chunks.map((c) => c.ordinal); if (new Set(identities).size !== identities.length) return fail("DUPLICATE_IDENTITY"); if (new Set(ordinals).size !== ordinals.length) return fail("DUPLICATE_ORDINAL");
    if (this.policy.requireDenseOrdinals && [...ordinals].sort((a, b) => a - b).some((v, i) => v !== i)) return fail("NON_DENSE_ORDINALS");
    const map = new Map(chunks.map((c) => [key(c), c]));
    for (const c of chunks) {
      if (c.documentIdentity.documentId !== input.documentIdentity.documentId || c.documentIdentity.documentVersion !== input.documentIdentity.documentVersion) return fail("DOCUMENT_LINEAGE_MISMATCH");
      if (c.strategy.strategyId !== input.strategy.strategyId || c.strategy.strategyVersion !== input.strategy.strategyVersion) return fail("STRATEGY_LINEAGE_MISMATCH");
      if (!identifier(c.identity.chunkId) || !positive(c.identity.chunkVersion) || !KNOWLEDGE_CHUNK_TYPES.includes(c.chunkType) || !Number.isSafeInteger(c.ordinal) || c.ordinal < 0 || !bounded(c.content, this.policy.maxChunkCharacters) || !validMetadata(c.metadata)) return fail("INVALID_CHUNK");
      if (!validSourceSpan(c.sourceSpan)) return fail("INVALID_SPAN");
      if (c.parent && !map.has(key(c.parent))) return fail("MISSING_PARENT");
      const digest = chunkDigest(c, this.canonical); if (!digest || digest !== c.contentDigest) return fail("DIGEST_MISMATCH");
    }
    for (const c of chunks) { const seen = new Set<string>(); let current: KnowledgeChunkCandidate | undefined = c; while (current?.parent) { const pkey = key(current.parent); if (seen.has(pkey) || pkey === key(c)) return fail("PARENT_CYCLE"); seen.add(pkey); const parent = map.get(pkey); if (!parent) break; if (!covers(parent, current)) return fail("PARENT_SPAN_MISMATCH"); current = parent; } }
    return freezeClone({ valid: true as const, chunks: [...chunks].sort((a, b) => a.ordinal - b.ordinal || key(a).localeCompare(key(b))) });
  }
}
export const chunkDigest = (c: Omit<KnowledgeChunkCandidate, "contentDigest"> | KnowledgeChunkCandidate, canonical = new CanonicalCompilationInputService()): string | null => { const { contentDigest: _, ...base } = c as KnowledgeChunkCandidate; const result = canonical.hash(base); return result.hashed ? result.hash : null; };
const covers = (p: KnowledgeChunkCandidate, c: KnowledgeChunkCandidate) => rangeCovers(p.sourceSpan.pageStart, p.sourceSpan.pageEnd, c.sourceSpan.pageStart, c.sourceSpan.pageEnd) && rangeCovers(p.sourceSpan.paragraphStart, p.sourceSpan.paragraphEnd, c.sourceSpan.paragraphStart, c.sourceSpan.paragraphEnd) && rangeCovers(p.sourceSpan.characterStart, p.sourceSpan.characterEnd, c.sourceSpan.characterStart, c.sourceSpan.characterEnd) && rangeCovers(p.sourceSpan.timestampStartMs, p.sourceSpan.timestampEndMs, c.sourceSpan.timestampStartMs, c.sourceSpan.timestampEndMs);
const rangeCovers = (ps?: number, pe?: number, cs?: number, ce?: number) => cs === undefined || (ps !== undefined && pe !== undefined && ps <= cs && pe >= (ce ?? cs));
const validMetadata = (m: KnowledgeChunkCandidate["metadata"]) => !!m && uniqueStrings(m.relationshipTypes) && uniqueStrings(m.subjectTypes) && uniqueStrings(m.markets) && uniqueStrings(m.topics) && uniqueStrings(m.validationCodes) && Array.isArray(m.factors) && m.factors.every((f) => identifier(f.factorKey) && positive(f.factorVersion)) && new Set(m.factors.map((f) => `${f.factorKey}:${f.factorVersion}`)).size === m.factors.length;
const uniqueStrings = (v: readonly string[]) => Array.isArray(v) && dense(v) && v.every((x) => bounded(x, 160)) && new Set(v).size === v.length;
const key = (c: { identity?: { chunkId: string; chunkVersion: number }; chunkId?: string; chunkVersion?: number }) => c.identity ? `${c.identity.chunkId}:${c.identity.chunkVersion}` : `${c.chunkId}:${c.chunkVersion}`;
const identifier = (v: unknown): v is string => typeof v === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(v); const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0; const bounded = (v: unknown, n: number): v is string => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= n; const dense = (v: readonly unknown[]) => v.every((_, i) => i in v); const fail = (code: any): KnowledgeChunkValidationResult => Object.freeze({ valid: false, code });

