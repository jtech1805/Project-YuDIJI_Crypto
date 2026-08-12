import type { KnowledgeChunkCitationSource, KnowledgeChunkIdentity } from "../../types/knowledge-chunk.types.js";
import type { VerifiedKnowledgeChunkSet } from "../../types/knowledge-chunk-set-manifest.types.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
export class KnowledgeChunkCitationSourceService {
  public project(document: PersistedKnowledgeDocument, verifiedSet: VerifiedKnowledgeChunkSet, chunkIdentity: KnowledgeChunkIdentity): KnowledgeChunkCitationSource | null {
    const chunk = verifiedSet.chunks.find((value) => value.identity.chunkId === chunkIdentity.chunkId && value.identity.chunkVersion === chunkIdentity.chunkVersion);
    if (!chunk) return null;
    if (verifiedSet.manifest.documentIdentity.documentId !== document.identity.documentId || verifiedSet.manifest.documentIdentity.documentVersion !== document.identity.documentVersion) return null;
    if (document.identity.documentId !== chunk.documentIdentity.documentId || document.identity.documentVersion !== chunk.documentIdentity.documentVersion || document.corpus !== "PLATFORM_KNOWLEDGE") return null;
    return freezeClone({ document: { identity: document.identity, sourceIdentity: document.source.sourceIdentity, title: document.title, contentDigest: document.contentDigest, corpus: document.corpus, trustLevel: document.trustLevel, parser: document.parser }, chunk: { identity: chunk.identity, sourceSpan: chunk.sourceSpan, contentDigest: chunk.contentDigest, strategy: chunk.strategy } });
  }
}
