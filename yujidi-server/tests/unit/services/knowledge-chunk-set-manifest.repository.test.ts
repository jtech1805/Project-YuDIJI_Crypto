import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeChunkSetManifestRepository, type KnowledgeChunkSetManifestModelPort } from "../../../src/repositories/knowledge-chunk-set-manifest.repository.js";
import { KnowledgeChunkSetManifestService } from "../../../src/services/knowledge/knowledge-chunk-set-manifest.service.js";
import { FactorDocumentationStrategy } from "../../../src/strategies/platform-knowledge/factor-documentation.strategy.js";
import { persistedDocument } from "../../fixtures/platform-knowledge.fixture.js";

const query = <T>(value: T) => ({ lean: () => ({ exec: async () => structuredClone(value) }) });
const document = persistedDocument();
const built = new KnowledgeChunkSetManifestService().build({ identity: { chunkSetId: "ETF_FLOW_CHUNK_SET", chunkSetVersion: 1 }, documentIdentity: document.identity, strategy: { strategyId: FactorDocumentationStrategy.strategyId, strategyVersion: 1 }, chunks: FactorDocumentationStrategy.chunk(document) });
if (!built.built) throw new Error(built.code);
const candidate = built.manifest;

test("manifest repository creates, exact-reads, duplicates, and has no mutable/latest API", async () => {
  let rows: any[] = [];
  const model: KnowledgeChunkSetManifestModelPort = {
    create: async (value: any) => { rows = [{ ...structuredClone(value), createdAt: new Date("2026-08-06") }]; },
    find: (filter) => ({ limit: () => query(rows.filter((row) => matches(row, filter))) }),
  };
  const repository = new KnowledgeChunkSetManifestRepository(model);
  const created = await repository.insert(candidate);
  assert.equal(created.inserted, true);
  assert.equal((await repository.findExact(candidate.identity.chunkSetId, 1)).found, true);
  assert.equal((await repository.findBySet(candidate.documentIdentity, candidate.strategy)).found, true);
  const duplicate = await repository.insert(candidate);
  assert.equal(duplicate.inserted ? null : duplicate.code, "ALREADY_EXISTS");
  assert.equal("getLatest" in repository || "update" in repository || "delete" in repository || "upsert" in repository, false);
});

test("manifest repository rejects identity and set-publication conflicts", async () => {
  let rows = [toRow(candidate)];
  const model: KnowledgeChunkSetManifestModelPort = { create: async () => undefined, find: (filter) => ({ limit: () => query(rows.filter((row) => matches(row, filter))) }) };
  const repository = new KnowledgeChunkSetManifestRepository(model);
  const contentConflict = await repository.insert({ ...candidate, chunkSetDigest: "0".repeat(64) });
  assert.equal(contentConflict.inserted ? null : contentConflict.code, "CONTENT_CONFLICT");
  const setConflict = await repository.insert({ ...candidate, identity: { chunkSetId: "OTHER_SET", chunkSetVersion: 1 } });
  assert.equal(setConflict.inserted ? null : setConflict.code, "SET_IDENTITY_CONFLICT");
  rows = [toRow(candidate), toRow(candidate)];
  assert.deepEqual(await repository.findBySet(candidate.documentIdentity, candidate.strategy), { found: false, code: "INVARIANT_VIOLATION" });
});

test("manifest repository classifies duplicate-key race through exact reread", async () => {
  let calls = 0;
  const model: KnowledgeChunkSetManifestModelPort = {
    create: async () => { throw { code: 11000 }; },
    find: () => ({ limit: () => query(++calls <= 2 ? [] : [toRow(candidate)]) }),
  };
  const result = await new KnowledgeChunkSetManifestRepository(model).insert(candidate);
  assert.equal(result.inserted, false);
  assert.equal(result.code, "ALREADY_EXISTS");
});

const toRow = (value: typeof candidate) => ({ chunkSetId: value.identity.chunkSetId, chunkSetVersion: value.identity.chunkSetVersion, documentIdentity: value.documentIdentity, strategy: value.strategy, expectedChunkCount: value.expectedChunkCount, orderedChunks: value.orderedChunks, chunkSetDigest: value.chunkSetDigest, publicationPolicy: value.publicationPolicy, createdAt: new Date("2026-08-06") });
const matches = (row: any, filter: Record<string, unknown>) => Object.entries(filter).every(([path, expected]) => path.split(".").reduce((value, key) => value?.[key], row) === expected);

