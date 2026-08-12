import { CanonicalCompilationInputService } from "../compiled-rulebook/canonical-compilation-input.service.js";
import { KNOWLEDGE_CORPORA, KNOWLEDGE_OWNER_TYPES, KNOWLEDGE_TRUST_LEVELS, NORMALIZED_KNOWLEDGE_BLOCK_TYPES, PLATFORM_KNOWLEDGE_DOCUMENT_TYPES, type KnowledgeDocumentMaterial, type KnowledgeSourceSpan, type NormalizedKnowledgeBlock } from "../../types/knowledge-document.types.js";
import { PLATFORM_KNOWLEDGE_ADMISSION_POLICY, type KnowledgeDocumentAdmissionPolicy, type KnowledgeDocumentAdmissionRequest, type KnowledgeDocumentAdmissionResult } from "../../types/knowledge-admission.types.js";

export class KnowledgeDocumentAdmissionService {
  public constructor(private readonly policy: KnowledgeDocumentAdmissionPolicy = PLATFORM_KNOWLEDGE_ADMISSION_POLICY, private readonly canonical = new CanonicalCompilationInputService()) {}
  public admit(request: KnowledgeDocumentAdmissionRequest): KnowledgeDocumentAdmissionResult {
    const d = request?.document;
    if (!d || !identifier(d.identity?.documentId) || !positive(d.identity?.documentVersion)) return fail("INVALID_IDENTITY");
    if (!KNOWLEDGE_CORPORA.includes(d.corpus) || !this.policy.allowedCorpora.includes(d.corpus)) return fail("UNSUPPORTED_CORPUS");
    if (!PLATFORM_KNOWLEDGE_DOCUMENT_TYPES.includes(d.documentType) || !this.policy.allowedDocumentTypes.includes(d.documentType)) return fail("UNSUPPORTED_DOCUMENT_TYPE");
    if (!KNOWLEDGE_TRUST_LEVELS.includes(d.trustLevel) || !this.policy.allowedTrustLevels.includes(d.trustLevel)) return fail("UNSUPPORTED_TRUST");
    if (!KNOWLEDGE_OWNER_TYPES.includes(d.ownership?.ownerType) || d.ownership.ownerType !== "SYSTEM" || (d.ownership.ownerId !== undefined && !identifier(d.ownership.ownerId))) return fail("INVALID_OWNERSHIP");
    if (!identifier(d.source?.sourceType) || !bounded(d.source?.sourceIdentity, 500) || (d.source.sourceUri !== undefined && !bounded(d.source.sourceUri, 2_000))) return fail("INVALID_SOURCE");
    if (!identifier(d.parser?.parserId) || !positive(d.parser?.parserVersion) || d.admissionPolicy?.policyId !== this.policy.policyId || d.admissionPolicy?.policyVersion !== this.policy.policyVersion) return fail("INVALID_PARSER");
    if (!validOptionalDate(d.effectiveFrom) || !validOptionalDate(d.effectiveUntil) || (d.effectiveFrom && d.effectiveUntil && d.effectiveFrom.getTime() >= d.effectiveUntil.getTime())) return fail("INVALID_EFFECTIVE_TIME");
    if (d.supersedes && (!identifier(d.supersedes.documentId) || !positive(d.supersedes.documentVersion) || sameIdentity(d.identity, d.supersedes))) return fail("INVALID_SUPERSESSION");
    if (!bounded(d.title, this.policy.maxTitleLength) || !Array.isArray(d.blocks) || !dense(d.blocks) || d.blocks.length === 0 || d.blocks.length > this.policy.maxBlocks) return fail(d.blocks?.length > this.policy.maxBlocks ? "BOUNDS_EXCEEDED" : "INVALID_BLOCKS");
    let characters = 0;
    for (let index = 0; index < d.blocks.length; index++) {
      const block = d.blocks[index]!; const size = blockCharacters(block); characters += size;
      if (!validBlock(block, index) || size > this.policy.maxBlockCharacters) return fail(size > this.policy.maxBlockCharacters ? "BOUNDS_EXCEEDED" : "INVALID_BLOCKS");
    }
    if (characters > this.policy.maxDocumentCharacters) return fail("BOUNDS_EXCEEDED");
    const material = freezeClone(d);
    const digest = documentDigest(material, this.canonical);
    if (!digest) return fail("CANONICALIZATION_FAILED");
    if (request.expectedContentDigest !== undefined && request.expectedContentDigest !== digest) return fail("DIGEST_MISMATCH");
    return freezeClone({ admitted: true as const, document: { ...material, contentDigest: digest } });
  }
}

export const documentDigest = (d: KnowledgeDocumentMaterial, canonical = new CanonicalCompilationInputService()): string | null => {
  const projection = { ...d, effectiveFrom: d.effectiveFrom?.toISOString() ?? null, effectiveUntil: d.effectiveUntil?.toISOString() ?? null, supersedes: d.supersedes ?? null,
    ownership: { ownerType: d.ownership.ownerType, ownerId: d.ownership.ownerId ?? null }, source: { sourceType: d.source.sourceType, sourceIdentity: d.source.sourceIdentity, sourceUri: d.source.sourceUri ?? null } };
  const result = canonical.hash(projection); return result.hashed ? result.hash : null;
};
export const validSourceSpan = (s: KnowledgeSourceSpan): boolean => !!s && pair(s.pageStart, s.pageEnd, 1) && pair(s.paragraphStart, s.paragraphEnd, 0) && pair(s.characterStart, s.characterEnd, 0) && pair(s.timestampStartMs, s.timestampEndMs, 0)
  && optionalUnique(s.sectionPath, 160) && optionalIdentifier(s.tableId) && optionalUnique(s.rowIds, 160)
  && (!!s.sectionPath?.length || s.pageStart !== undefined || s.paragraphStart !== undefined || s.characterStart !== undefined || s.tableId !== undefined || s.timestampStartMs !== undefined);
const validBlock = (b: NormalizedKnowledgeBlock, expectedOrdinal: number) => identifier(b?.blockId) && b.ordinal === expectedOrdinal && NORMALIZED_KNOWLEDGE_BLOCK_TYPES.includes(b.blockType)
  && optionalUnique(b.sectionPath, 160) && validSourceSpan(b.sourceSpan) && optionalUnique(b.semanticLabels, 160)
  && Array.isArray(b.authorityReferences) && dense(b.authorityReferences) && b.authorityReferences.every((r) => identifier(r.authorityType) && identifier(r.authorityId) && (r.authorityVersion === undefined || positive(r.authorityVersion)))
  && (b.blockType === "TABLE" ? validTable(b.table) && b.text === undefined : bounded(b.text, 20_000) && b.table === undefined);
const validTable = (t: NormalizedKnowledgeBlock["table"]) => !!t && Array.isArray(t.headers) && t.headers.length > 0 && t.headers.every((v: string) => bounded(v, 500)) && Array.isArray(t.rows) && t.rows.length > 0 && t.rows.every((r) => identifier(r.rowId) && r.cells.length === t.headers.length && r.cells.every((v: string) => bounded(v, 2_000))) && new Set(t.rows.map((r) => r.rowId)).size === t.rows.length;
const blockCharacters = (b: NormalizedKnowledgeBlock) => b.text?.length ?? ((b.table?.headers.join("").length ?? 0) + (b.table?.rows.reduce((n, r) => n + r.cells.join("").length, 0) ?? 0));
const pair = (a: number | undefined, b: number | undefined, min: number) => (a === undefined && b === undefined) || (Number.isSafeInteger(a) && Number.isSafeInteger(b) && (a as number) >= min && (b as number) >= (a as number));
const optionalUnique = (v: readonly string[] | undefined, max: number) => v === undefined || (Array.isArray(v) && dense(v) && v.every((x) => bounded(x, max)) && new Set(v).size === v.length);
const optionalIdentifier = (v: string | undefined) => v === undefined || identifier(v);
const identifier = (v: unknown): v is string => typeof v === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(v);
const bounded = (v: unknown, max: number): v is string => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= max;
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const validOptionalDate = (v: unknown) => v === undefined || (v instanceof Date && Number.isFinite(v.getTime()));
const dense = (v: readonly unknown[]) => v.every((_, i) => i in v);
const sameIdentity = (a: { documentId: string; documentVersion: number }, b: { documentId: string; documentVersion: number }) => a.documentId === b.documentId && a.documentVersion === b.documentVersion;
const fail = (code: any): KnowledgeDocumentAdmissionResult => Object.freeze({ admitted: false, code });
export const freezeClone = <T>(v: T): T => deepFreeze(structuredClone(v));
const deepFreeze = <T>(v: T): T => { if (v && typeof v === "object" && !Object.isFrozen(v)) { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; };
