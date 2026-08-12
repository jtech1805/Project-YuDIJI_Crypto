import type { KnowledgeChunkingStrategy } from "../../types/knowledge-chunking.types.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import { buildChunk } from "./platform-strategy.helpers.js";
const ID = "PLATFORM_ADR_SUMMARY", VERSION = 1;
export const AdrSummaryStrategy: KnowledgeChunkingStrategy = Object.freeze({ strategyId: ID, strategyVersion: VERSION, supportedDocumentTypes: Object.freeze(["ADR_SUMMARY"] as const), chunk(document: PersistedKnowledgeDocument) { return Object.freeze([buildChunk(document, ID, VERSION, "DECISION_AND_CONSEQUENCES", 0, "DECISION_SUMMARY", document.blocks)]); } });
