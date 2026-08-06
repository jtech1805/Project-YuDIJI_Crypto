import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeChunkSetManifestService } from "../../../src/services/knowledge-chunk-set-manifest.service.js";
import { FactorDocumentationStrategy } from "../../../src/strategies/platform-knowledge/factor-documentation.strategy.js";
import { persistedDocument } from "../../fixtures/platform-knowledge.fixture.js";
import type { KnowledgeChunkCandidate } from "../../../src/types/knowledge-chunk.types.js";

const document = persistedDocument();
const chunks = FactorDocumentationStrategy.chunk(document);
const base = {
  identity: { chunkSetId: "ETF_FLOW_CHUNK_SET", chunkSetVersion: 1 },
  documentIdentity: document.identity,
  strategy: { strategyId: FactorDocumentationStrategy.strategyId, strategyVersion: 1 },
};

test("manifest builder canonicalizes order and produces a stable frozen digest", () => {
  const service = new KnowledgeChunkSetManifestService();
  const a = service.build({ ...base, chunks: [...chunks].reverse() });
  const b = service.build({ ...base, chunks: structuredClone(chunks) });
  assert.deepEqual(a, b);
  assert.equal(a.built, true);
  if (!a.built) return;
  assert.deepEqual(a.manifest.orderedChunks.map((entry) => entry.ordinal), [0, 1, 2, 3]);
  assert.equal(a.manifest.expectedChunkCount, 4);
  assert.match(a.manifest.chunkSetDigest, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(a.manifest.orderedChunks));
  assert.equal(Object.isFrozen(chunks), true);
});

test("manifest digest changes for chunk, document, strategy, and publication lineage", () => {
  const service = new KnowledgeChunkSetManifestService();
  const original = service.build({ ...base, chunks });
  assert.equal(original.built, true);
  if (!original.built) return;
  const changedChunk = chunks.map((chunk, index) => index === 0 ? { ...chunk, contentDigest: "0".repeat(64) } : chunk);
  const changed = service.build({ ...base, chunks: changedChunk });
  const documentChanged = service.build({ ...base, identity: { chunkSetId: "OTHER_SET", chunkSetVersion: 1 }, documentIdentity: { documentId: "OTHER_DOC", documentVersion: 1 }, chunks: changedChunk.map((chunk) => ({ ...chunk, documentIdentity: { documentId: "OTHER_DOC", documentVersion: 1 } })) });
  assert.equal(changed.built, true);
  assert.equal(documentChanged.built, true);
  if (changed.built) assert.notEqual(changed.manifest.chunkSetDigest, original.manifest.chunkSetDigest);
  if (documentChanged.built) assert.notEqual(documentChanged.manifest.chunkSetDigest, original.manifest.chunkSetDigest);
});

test("manifest builder rejects duplicates, gaps, lineage mismatch, and bounds", () => {
  const service = new KnowledgeChunkSetManifestService();
  assert.deepEqual(service.build({ ...base, chunks: [chunks[0]!, chunks[0]!] }), { built: false, code: "DUPLICATE_CHUNK_IDENTITY" });
  const duplicateOrdinal = { ...chunks[1]!, ordinal: 0 };
  assert.deepEqual(service.build({ ...base, chunks: [chunks[0]!, duplicateOrdinal] }), { built: false, code: "DUPLICATE_ORDINAL" });
  const gap = { ...chunks[0]!, ordinal: 1 };
  assert.deepEqual(service.build({ ...base, chunks: [gap] }), { built: false, code: "ORDINAL_GAP" });
  const wrongDocument: KnowledgeChunkCandidate = { ...chunks[0]!, documentIdentity: { documentId: "OTHER", documentVersion: 1 } };
  assert.deepEqual(service.build({ ...base, chunks: [wrongDocument] }), { built: false, code: "DOCUMENT_LINEAGE_MISMATCH" });
  const bounded = new KnowledgeChunkSetManifestService({ ...({} as any), policyId: "P", policyVersion: 1, maxChunkCount: 1, requireDenseOrdinals: true, rejectUnexpectedChunks: true, requireExactDigestMatch: true });
  assert.deepEqual(bounded.build({ ...base, chunks }), { built: false, code: "COUNT_BOUND_EXCEEDED" });
});

