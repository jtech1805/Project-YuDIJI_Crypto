import { CanonicalCompilationInputService } from "../../services/compiled-rulebook/canonical-compilation-input.service.js";
import { freezeClone } from "../../services/knowledge/knowledge-document-admission.service.js";
import type { NormalizedKnowledgeBlock, PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import type { KnowledgeChunkCandidate, KnowledgeChunkMetadata, KnowledgeChunkType, KnowledgeExampleClassification } from "../../types/knowledge-chunk.types.js";

export const buildChunk = (document: PersistedKnowledgeDocument, strategyId: string, strategyVersion: number, suffix: string, ordinal: number, chunkType: KnowledgeChunkType, blocks: readonly NormalizedKnowledgeBlock[], classification?: KnowledgeExampleClassification): KnowledgeChunkCandidate => {
  const identity = { chunkId: `${document.identity.documentId}:${suffix}`, chunkVersion: document.identity.documentVersion };
  const sourceSpan = mergeSpans(blocks); const metadata = metadataOf(blocks, classification);
  const base = { identity, documentIdentity: document.identity, strategy: { strategyId, strategyVersion }, chunkType, ordinal, content: blocks.map(render).join("\n\n"), sourceSpan, metadata };
  const hashed = new CanonicalCompilationInputService().hash(base); if (!hashed.hashed) throw new Error("CHUNK_CANONICALIZATION_FAILED");
  return freezeClone({ ...base, contentDigest: hashed.hash });
};
const render = (b: NormalizedKnowledgeBlock) => b.text ?? [b.table!.headers.join(" | "), ...b.table!.rows.map((r) => r.cells.join(" | "))].join("\n");
const mergeSpans = (blocks: readonly NormalizedKnowledgeBlock[]) => {
  const first = blocks[0]!.sourceSpan, last = blocks[blocks.length - 1]!.sourceSpan;
  return freezeClone({ sectionPath: commonPath(blocks.map((b) => b.sourceSpan.sectionPath ?? b.sectionPath)), ...(first.pageStart !== undefined ? { pageStart: first.pageStart } : {}), ...(last.pageEnd !== undefined ? { pageEnd: last.pageEnd } : {}), ...(first.paragraphStart !== undefined ? { paragraphStart: first.paragraphStart } : {}), ...(last.paragraphEnd !== undefined ? { paragraphEnd: last.paragraphEnd } : {}), ...(first.characterStart !== undefined ? { characterStart: first.characterStart } : {}), ...(last.characterEnd !== undefined ? { characterEnd: last.characterEnd } : {}), ...(first.timestampStartMs !== undefined ? { timestampStartMs: first.timestampStartMs } : {}), ...(last.timestampEndMs !== undefined ? { timestampEndMs: last.timestampEndMs } : {}), ...(blocks.length === 1 && first.tableId ? { tableId: first.tableId, rowIds: first.rowIds ?? [] } : {}) });
};
const commonPath = (paths: readonly (readonly string[])[]) => paths[0]?.filter((part, i) => paths.every((p) => p[i] === part)) ?? [];
const metadataOf = (blocks: readonly NormalizedKnowledgeBlock[], classification?: KnowledgeExampleClassification): KnowledgeChunkMetadata => {
  const refs = blocks.flatMap((b) => b.authorityReferences); const labels = blocks.flatMap((b) => b.semanticLabels);
  const factors = uniqueObjects(refs.filter((r) => r.authorityType === "FACTOR" && r.authorityVersion).map((r) => ({ factorKey: r.authorityId, factorVersion: r.authorityVersion! })));
  const values = (prefix: string) => unique(labels.filter((x) => x.startsWith(`${prefix}:`)).map((x) => x.slice(prefix.length + 1)));
  const adrRef = refs.find((r) => r.authorityType === "ADR");
  return freezeClone({ factors, relationshipTypes: values("RELATIONSHIP"), subjectTypes: values("SUBJECT"), markets: values("MARKET"), topics: values("TOPIC"), ...(classification ? { exampleClassification: classification } : {}), validationCodes: values("VALIDATION_CODE"), ...(adrRef ? { adr: { number: Number(adrRef.authorityId.replace("ADR-", "")), status: values("ADR_STATUS")[0] ?? "ACCEPTED" } } : {}) });
};
const unique = (v: readonly string[]) => [...new Set(v)].sort();
const uniqueObjects = (v: readonly { factorKey: string; factorVersion: number }[]) => [...new Map(v.map((x) => [`${x.factorKey}:${x.factorVersion}`, x])).values()].sort((a, b) => a.factorKey.localeCompare(b.factorKey) || a.factorVersion - b.factorVersion);
export const select = (d: PersistedKnowledgeDocument, types: readonly NormalizedKnowledgeBlock["blockType"][]) => d.blocks.filter((b) => types.includes(b.blockType));

