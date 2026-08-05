import type { KnowledgeChunkCitationSource, PersistedKnowledgeChunk } from "../types/knowledge-chunk.types.js";
import type { PersistedKnowledgeDocument } from "../types/knowledge-document.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
export class KnowledgeChunkCitationSourceService {
  public project(document: PersistedKnowledgeDocument, chunk: PersistedKnowledgeChunk): KnowledgeChunkCitationSource | null {
    if (document.identity.documentId !== chunk.documentIdentity.documentId || document.identity.documentVersion !== chunk.documentIdentity.documentVersion || document.corpus !== "PLATFORM_KNOWLEDGE") return null;
    return freezeClone({ document: { identity: document.identity, sourceIdentity: document.source.sourceIdentity, title: document.title, contentDigest: document.contentDigest, corpus: document.corpus, trustLevel: document.trustLevel, parser: document.parser }, chunk: { identity: chunk.identity, sourceSpan: chunk.sourceSpan, contentDigest: chunk.contentDigest, strategy: chunk.strategy } });
  }
}

