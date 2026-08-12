import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeChunkingService } from "../../../src/services/knowledge/knowledge-chunking.service.js";
import { KnowledgeChunkCitationSourceService } from "../../../src/services/knowledge/knowledge-chunk-citation-source.service.js";
import { KnowledgeChunkingStrategyRegistry } from "../../../src/registries/knowledge-chunking-strategy.registry.js";
import { FactorDocumentationStrategy } from "../../../src/strategies/platform-knowledge/factor-documentation.strategy.js";
import { persistedDocument } from "../../fixtures/platform-knowledge.fixture.js";
import { KnowledgeChunkSetManifestService } from "../../../src/services/knowledge/knowledge-chunk-set-manifest.service.js";

const request = {
  strategyId: FactorDocumentationStrategy.strategyId,
  strategyVersion: 1,
  manifestIdentity: { chunkSetId: "ETF_FLOW_CHUNK_SET", chunkSetVersion: 1 },
};

test("chunking service publishes manifest last and requires final verified reread", async () => {
  const document = persistedDocument();
  const candidates = FactorDocumentationStrategy.chunk(document);
  const persisted = candidates.map((chunk) => ({ ...chunk, createdAt: new Date("2026-08-06") }));
  const events: string[] = [];
  let manifest: any;
  const chunks = {
    insertSet: async () => { events.push("chunks"); return { inserted: true, chunks: persisted }; },
    findStoredSetForVerification: async () => ({ found: true, chunks: persisted }),
  } as any;
  const manifests = {
    insert: async (value: any) => { events.push("manifest"); manifest = { ...value, createdAt: new Date("2026-08-06") }; return { inserted: true, manifest }; },
  } as any;
  const verifier = {
    verify: () => ({ verified: true, set: { manifest: { createdAt: new Date(0) }, chunks: persisted } }),
    readExactCompleteSet: async () => ({ verified: true, set: { manifest, chunks: persisted } }),
  } as any;
  const service = new KnowledgeChunkingService(new KnowledgeChunkingStrategyRegistry([FactorDocumentationStrategy]), undefined, chunks, undefined, manifests, verifier);
  const result = await service.chunkAndPersist(document, request);
  assert.equal(result.status, "CREATED");
  assert.deepEqual(events, ["chunks", "manifest"]);
  if (result.status === "CREATED") assert.equal(result.completenessVerified, true);
});

test("chunk or post-write verification failure prevents manifest publication", async () => {
  const document = persistedDocument();
  let manifestCalls = 0;
  const manifestRepository = { insert: async () => { manifestCalls += 1; return { inserted: false, code: "PERSISTENCE_FAILED" }; } } as any;
  const failedChunks = { insertSet: async () => ({ inserted: false, code: "PERSISTENCE_FAILED" }) } as any;
  const first = new KnowledgeChunkingService(new KnowledgeChunkingStrategyRegistry([FactorDocumentationStrategy]), undefined, failedChunks, undefined, manifestRepository, {} as any);
  assert.equal((await first.chunkAndPersist(document, request)).status, "PERSISTENCE_FAILED");
  const candidates = FactorDocumentationStrategy.chunk(document).map((chunk) => ({ ...chunk, createdAt: new Date("2026-08-06") }));
  const partial = { insertSet: async () => ({ inserted: true, chunks: candidates }), findStoredSetForVerification: async () => ({ found: true, chunks: candidates.slice(0, 2) }) } as any;
  const verifier = { verify: () => ({ verified: false, code: "CHUNK_MISSING" }) } as any;
  const second = new KnowledgeChunkingService(new KnowledgeChunkingStrategyRegistry([FactorDocumentationStrategy]), undefined, partial, undefined, manifestRepository, verifier);
  const result = await second.chunkAndPersist(document, request);
  assert.deepEqual(result, { status: "COMPLETENESS_VERIFICATION_FAILED", code: "CHUNK_MISSING" });
  assert.equal(manifestCalls, 0);
});

test("citation-source projection accepts only a chunk from a verified set", () => {
  const document = persistedDocument();
  const candidate = FactorDocumentationStrategy.chunk(document)[0]!;
  const chunk = { ...candidate, createdAt: new Date("2026-08-06") };
  const built = new KnowledgeChunkSetManifestService().build({ identity: request.manifestIdentity, documentIdentity: document.identity, strategy: candidate.strategy, chunks: [candidate] });
  assert.equal(built.built, true);
  if (!built.built) return;
  const verifiedSet = { manifest: { ...built.manifest, createdAt: new Date("2026-08-06") }, chunks: [chunk] };
  const result = new KnowledgeChunkCitationSourceService().project(document, verifiedSet, chunk.identity);
  assert.equal(result?.document.sourceIdentity, "CRYPTO_ETF_FLOW_DOC:SOURCE");
  assert.equal(new KnowledgeChunkCitationSourceService().project(document, verifiedSet, { chunkId: "ORPHAN", chunkVersion: 1 }), null);
});
