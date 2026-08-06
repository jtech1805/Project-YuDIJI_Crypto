import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeChunkSetVerificationService } from "../../../src/services/knowledge-chunk-set-verification.service.js";
import { KnowledgeChunkSetManifestService, calculateChunkSetDigest } from "../../../src/services/knowledge-chunk-set-manifest.service.js";
import { FactorDocumentationStrategy } from "../../../src/strategies/platform-knowledge/factor-documentation.strategy.js";
import { persistedDocument } from "../../fixtures/platform-knowledge.fixture.js";
import type { PersistedKnowledgeChunkSetManifest } from "../../../src/types/knowledge-chunk-set-manifest.types.js";

const document = persistedDocument();
const candidates = FactorDocumentationStrategy.chunk(document);
const chunks = candidates.map((chunk) => ({ ...chunk, createdAt: new Date("2026-08-06") }));
const built = new KnowledgeChunkSetManifestService().build({ identity: { chunkSetId: "ETF_FLOW_CHUNK_SET", chunkSetVersion: 1 }, documentIdentity: document.identity, strategy: candidates[0]!.strategy, chunks: candidates });
if (!built.built) throw new Error(built.code);
const manifest: PersistedKnowledgeChunkSetManifest = { ...built.manifest, createdAt: new Date("2026-08-06") };
const service = new KnowledgeChunkSetVerificationService({} as any, {} as any);

test("verification returns only the exact complete immutable set", () => {
  const result = service.verify(manifest, [...chunks].reverse());
  assert.equal(result.verified, true);
  if (result.verified) {
    assert.deepEqual(result.set.chunks.map((chunk) => chunk.ordinal), [0, 1, 2, 3]);
    assert.ok(Object.isFrozen(result.set.chunks));
    assert.notEqual(result.set.manifest.createdAt, manifest.createdAt);
  }
});

test("verification fails for missing and unexpected chunks", () => {
  assert.deepEqual(service.verify(manifest, chunks.slice(0, -1)), { verified: false, code: "CHUNK_MISSING" });
  const orphan = { ...chunks[0]!, identity: { chunkId: "ORPHAN", chunkVersion: 1 }, ordinal: 4 };
  assert.deepEqual(service.verify(manifest, [...chunks, orphan]), { verified: false, code: "UNEXPECTED_CHUNK" });
});

test("verification fails for ordinal, chunk digest, set digest, and lineage mismatch", () => {
  const manifestOrder = { ...manifest, orderedChunks: [...manifest.orderedChunks].reverse() };
  assert.deepEqual(service.verify(manifestOrder, chunks), { verified: false, code: "ORDINAL_MISMATCH" });
  const ordinal = chunks.map((chunk, index) => index === 0 ? { ...chunk, ordinal: 1 } : chunk);
  assert.deepEqual(service.verify(manifest, ordinal), { verified: false, code: "ORDINAL_MISMATCH" });
  const digest = chunks.map((chunk, index) => index === 0 ? { ...chunk, contentDigest: "0".repeat(64) } : chunk);
  assert.deepEqual(service.verify(manifest, digest), { verified: false, code: "CHUNK_DIGEST_MISMATCH" });
  assert.deepEqual(service.verify({ ...manifest, chunkSetDigest: "0".repeat(64) }, chunks), { verified: false, code: "SET_DIGEST_MISMATCH" });
  const lineage = chunks.map((chunk, index) => index === 0 ? { ...chunk, documentIdentity: { documentId: "OTHER", documentVersion: 1 } } : chunk);
  assert.deepEqual(service.verify(manifest, lineage), { verified: false, code: "LINEAGE_MISMATCH" });
});

test("manifest-backed read rejects missing manifest and partial orphan sets", async () => {
  const missingManifest = new KnowledgeChunkSetVerificationService({ findStoredSetForVerification: async () => ({ found: true, chunks: chunks.slice(0, 2) }) } as any, { findBySet: async () => ({ found: false, code: "NOT_FOUND" }) } as any);
  assert.deepEqual(await missingManifest.readExactCompleteSet(document.identity, candidates[0]!.strategy), { verified: false, code: "MANIFEST_NOT_FOUND" });
  const partial = new KnowledgeChunkSetVerificationService({ findStoredSetForVerification: async () => ({ found: true, chunks: chunks.slice(0, 2) }) } as any, { findBySet: async () => ({ found: true, manifest }) } as any);
  assert.deepEqual(await partial.readExactCompleteSet(document.identity, candidates[0]!.strategy), { verified: false, code: "CHUNK_MISSING" });
});
