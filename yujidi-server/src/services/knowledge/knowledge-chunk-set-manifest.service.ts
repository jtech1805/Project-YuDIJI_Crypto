import { CanonicalCompilationInputService } from "../compiled-rulebook/canonical-compilation-input.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import {
  KNOWLEDGE_CHUNK_SET_PUBLICATION_POLICY,
  type KnowledgeChunkSetManifestBuildRequest,
  type KnowledgeChunkSetManifestBuildResult,
  type KnowledgeChunkSetManifestCommand,
  type KnowledgeChunkSetPublicationPolicy,
} from "../../types/knowledge-chunk-set-manifest.types.js";

const MANIFEST_SCHEMA = Object.freeze({ schemaId: "KNOWLEDGE_CHUNK_SET_MANIFEST", schemaVersion: 1 });

export class KnowledgeChunkSetManifestService {
  public constructor(
    private readonly policy: KnowledgeChunkSetPublicationPolicy = KNOWLEDGE_CHUNK_SET_PUBLICATION_POLICY,
    private readonly canonical = new CanonicalCompilationInputService(),
  ) {}

  public build(request: KnowledgeChunkSetManifestBuildRequest): KnowledgeChunkSetManifestBuildResult {
    if (!identifier(request.identity?.chunkSetId) || !positive(request.identity?.chunkSetVersion)) {
      return failure("INVALID_MANIFEST_IDENTITY");
    }
    if (!identifier(request.documentIdentity?.documentId) || !positive(request.documentIdentity?.documentVersion)) {
      return failure("INVALID_DOCUMENT_IDENTITY");
    }
    if (!identifier(request.strategy?.strategyId) || !positive(request.strategy?.strategyVersion)) {
      return failure("INVALID_STRATEGY_IDENTITY");
    }
    if (!Array.isArray(request.chunks) || request.chunks.length === 0) return failure("EMPTY_SET");
    if (request.chunks.length > this.policy.maxChunkCount) return failure("COUNT_BOUND_EXCEEDED");

    const ordered = [...request.chunks].sort((a, b) =>
      a.ordinal - b.ordinal
      || a.identity.chunkId.localeCompare(b.identity.chunkId)
      || a.identity.chunkVersion - b.identity.chunkVersion);
    const identities = ordered.map((chunk) => `${chunk.identity.chunkId}:${chunk.identity.chunkVersion}`);
    if (new Set(identities).size !== identities.length) return failure("DUPLICATE_CHUNK_IDENTITY");
    const ordinals = ordered.map((chunk) => chunk.ordinal);
    if (new Set(ordinals).size !== ordinals.length) return failure("DUPLICATE_ORDINAL");
    if (ordinals.some((ordinal, index) => ordinal !== index)) return failure("ORDINAL_GAP");

    for (const chunk of ordered) {
      if (chunk.documentIdentity.documentId !== request.documentIdentity.documentId
        || chunk.documentIdentity.documentVersion !== request.documentIdentity.documentVersion) {
        return failure("DOCUMENT_LINEAGE_MISMATCH");
      }
      if (chunk.strategy.strategyId !== request.strategy.strategyId
        || chunk.strategy.strategyVersion !== request.strategy.strategyVersion) {
        return failure("STRATEGY_LINEAGE_MISMATCH");
      }
      if (!digest(chunk.contentDigest)) return failure("INVALID_CHUNK_DIGEST");
    }

    const material = {
      identity: request.identity,
      documentIdentity: request.documentIdentity,
      strategy: request.strategy,
      expectedChunkCount: ordered.length,
      orderedChunks: ordered.map((chunk) => ({
        ordinal: chunk.ordinal,
        chunkId: chunk.identity.chunkId,
        chunkVersion: chunk.identity.chunkVersion,
        chunkDigest: chunk.contentDigest,
      })),
      publicationPolicy: {
        policyId: this.policy.policyId,
        policyVersion: this.policy.policyVersion,
      },
    };
    const chunkSetDigest = calculateChunkSetDigest(material, this.canonical);
    if (!chunkSetDigest) return failure("CANONICALIZATION_FAILED");
    return freezeClone({ built: true as const, manifest: { ...material, chunkSetDigest } });
  }
}

export const calculateChunkSetDigest = (
  manifest: Omit<KnowledgeChunkSetManifestCommand, "chunkSetDigest">,
  canonical = new CanonicalCompilationInputService(),
): string | null => {
  const hashed = canonical.hash({ ...MANIFEST_SCHEMA, ...manifest });
  return hashed.hashed ? hashed.hash : null;
};

const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value);
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const failure = (code: any): KnowledgeChunkSetManifestBuildResult => Object.freeze({ built: false, code });
