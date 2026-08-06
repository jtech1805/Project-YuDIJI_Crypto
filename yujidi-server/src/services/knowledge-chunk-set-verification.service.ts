import { KnowledgeChunkRepository } from "../repositories/knowledge-chunk.repository.js";
import { KnowledgeChunkSetManifestRepository } from "../repositories/knowledge-chunk-set-manifest.repository.js";
import type { PersistedKnowledgeChunk } from "../types/knowledge-chunk.types.js";
import type {
  KnowledgeChunkSetManifestCommand,
  KnowledgeChunkSetStrategyIdentity,
  KnowledgeChunkSetVerificationResult,
  PersistedKnowledgeChunkSetManifest,
} from "../types/knowledge-chunk-set-manifest.types.js";
import type { KnowledgeDocumentIdentity } from "../types/knowledge-document.types.js";
import { calculateChunkSetDigest } from "./knowledge-chunk-set-manifest.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";

export class KnowledgeChunkSetVerificationService {
  public constructor(
    private readonly chunks = new KnowledgeChunkRepository(),
    private readonly manifests = new KnowledgeChunkSetManifestRepository(),
  ) {}

  public async readExactCompleteSet(
    document: KnowledgeDocumentIdentity,
    strategy: KnowledgeChunkSetStrategyIdentity,
  ): Promise<KnowledgeChunkSetVerificationResult> {
    const manifest = await this.manifests.findBySet(document, strategy);
    if (!manifest.found) {
      return Object.freeze({
        verified: false,
        code: manifest.code === "NOT_FOUND" ? "MANIFEST_NOT_FOUND" : manifest.code,
      });
    }
    const stored = await this.chunks.findStoredSetForVerification(document, strategy);
    if (!stored.found) {
      return Object.freeze({
        verified: false,
        code: stored.code === "NOT_FOUND" ? "CHUNK_MISSING" : stored.code,
      });
    }
    return this.verify(manifest.manifest, stored.chunks);
  }

  public verify(
    manifest: KnowledgeChunkSetManifestCommand | PersistedKnowledgeChunkSetManifest,
    chunks: readonly PersistedKnowledgeChunk[],
  ): KnowledgeChunkSetVerificationResult {
    const manifestIdentities = manifest.orderedChunks.map(entryKey);
    if (new Set(manifestIdentities).size !== manifestIdentities.length) {
      return failure("INVARIANT_VIOLATION");
    }
    if (manifest.orderedChunks.some((entry, index) => entry.ordinal !== index)) {
      return failure("ORDINAL_MISMATCH");
    }
    if (manifest.expectedChunkCount !== manifest.orderedChunks.length
      || chunks.length !== manifest.expectedChunkCount) {
      const listed = new Set(manifest.orderedChunks.map(entryKey));
      const stored = new Set(chunks.map(chunkKey));
      if (chunks.some((chunk) => !listed.has(chunkKey(chunk)))) {
        return failure("UNEXPECTED_CHUNK");
      }
      if (manifest.orderedChunks.some((entry) => !stored.has(entryKey(entry)))) {
        return failure("CHUNK_MISSING");
      }
      return failure("COUNT_MISMATCH");
    }

    const byIdentity = new Map<string, PersistedKnowledgeChunk>();
    for (const chunk of chunks) {
      const key = chunkKey(chunk);
      if (byIdentity.has(key)) return failure("INVARIANT_VIOLATION");
      if (chunk.documentIdentity.documentId !== manifest.documentIdentity.documentId
        || chunk.documentIdentity.documentVersion !== manifest.documentIdentity.documentVersion
        || chunk.strategy.strategyId !== manifest.strategy.strategyId
        || chunk.strategy.strategyVersion !== manifest.strategy.strategyVersion) {
        return failure("LINEAGE_MISMATCH");
      }
      byIdentity.set(key, chunk);
    }

    const ordered: PersistedKnowledgeChunk[] = [];
    for (const entry of manifest.orderedChunks) {
      const chunk = byIdentity.get(entryKey(entry));
      if (!chunk) return failure("CHUNK_MISSING");
      if (chunk.ordinal !== entry.ordinal) return failure("ORDINAL_MISMATCH");
      if (chunk.contentDigest !== entry.chunkDigest) return failure("CHUNK_DIGEST_MISMATCH");
      ordered.push(chunk);
    }
    if (chunks.some((chunk) => !manifest.orderedChunks.some((entry) => entryKey(entry) === chunkKey(chunk)))) {
      return failure("UNEXPECTED_CHUNK");
    }

    const { chunkSetDigest, createdAt: _, ...material } = manifest as PersistedKnowledgeChunkSetManifest;
    const recalculated = calculateChunkSetDigest(material);
    if (!recalculated || recalculated !== chunkSetDigest) return failure("SET_DIGEST_MISMATCH");
    const persistedManifest = "createdAt" in manifest
      ? manifest
      : { ...manifest, createdAt: new Date(0) };
    return freezeClone({ verified: true as const, set: { manifest: persistedManifest, chunks: ordered } });
  }
}

const entryKey = (entry: { chunkId: string; chunkVersion: number }) =>
  `${entry.chunkId}:${entry.chunkVersion}`;
const chunkKey = (chunk: PersistedKnowledgeChunk) =>
  `${chunk.identity.chunkId}:${chunk.identity.chunkVersion}`;
const failure = (code: any): KnowledgeChunkSetVerificationResult => Object.freeze({ verified: false, code });
