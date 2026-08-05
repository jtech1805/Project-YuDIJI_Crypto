import type { KnowledgeChunkingStrategy } from "../../types/knowledge-chunking.types.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import { buildChunk } from "./platform-strategy.helpers.js";
const ID = "PLATFORM_RELATIONSHIP_DOCUMENTATION", VERSION = 1;
export const RelationshipDocumentationStrategy: KnowledgeChunkingStrategy = Object.freeze({ strategyId: ID, strategyVersion: VERSION, supportedDocumentTypes: Object.freeze(["RELATIONSHIP_DOCUMENTATION"] as const), chunk(document: PersistedKnowledgeDocument) { return Object.freeze([buildChunk(document, ID, VERSION, "SEMANTICS_AND_RESTRICTIONS", 0, "INTERPRETATION", document.blocks)]); } });
