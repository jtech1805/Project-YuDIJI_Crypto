import type { KnowledgeChunkingStrategy } from "../../types/knowledge-chunking.types.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import { buildChunk } from "./platform-strategy.helpers.js";
const ID = "PLATFORM_VALIDATION_GUIDANCE", VERSION = 1;
export const ValidationGuidanceStrategy: KnowledgeChunkingStrategy = Object.freeze({ strategyId: ID, strategyVersion: VERSION, supportedDocumentTypes: Object.freeze(["VALIDATION_GUIDANCE"] as const), chunk(document: PersistedKnowledgeDocument) { return Object.freeze([buildChunk(document, ID, VERSION, "VALIDATION_CODE_FAMILY", 0, "VALIDATION_GUIDANCE", document.blocks)]); } });
