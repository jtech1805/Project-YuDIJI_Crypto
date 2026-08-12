import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeVectorSearchableMetadataProjectionService } from "../../../src/services/knowledge/knowledge-vector-searchable-metadata-projection.service.js";
import { verifiedEmbeddingFixture } from "../../fixtures/knowledge-embedding.fixture.js";

test("searchable metadata projection is bounded, canonical, detached and excludes content/source data", () => {
  const fixture = verifiedEmbeddingFixture();
  const document = { ...fixture.document, effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveUntil: new Date("2027-01-01T00:00:00Z") };
  const chunk = { ...fixture.chunks[0]!, metadata: { ...fixture.chunks[0]!.metadata, topics: ["Z_TOPIC", "A_TOPIC"] } };
  const output = new KnowledgeVectorSearchableMetadataProjectionService().project(document, chunk);
  assert.deepEqual(output.topics, ["A_TOPIC", "Z_TOPIC"]);
  assert.notEqual(output.topics, chunk.metadata.topics);
  assert.notEqual(output.effectiveFrom, document.effectiveFrom);
  assert.ok(Object.isFrozen(output));
  assert.ok(Object.isFrozen(output.topics));
  assert.equal("content" in output, false);
  assert.equal("source" in output, false);
  assert.equal("sourceUri" in output, false);
  assert.deepEqual(document.effectiveFrom, new Date("2026-01-01T00:00:00Z"));
});
