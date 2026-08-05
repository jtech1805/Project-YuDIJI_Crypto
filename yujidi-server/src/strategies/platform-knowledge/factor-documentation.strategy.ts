import type { KnowledgeChunkingStrategy } from "../../types/knowledge-chunking.types.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import { buildChunk, select } from "./platform-strategy.helpers.js";
const ID = "PLATFORM_FACTOR_DOCUMENTATION", VERSION = 1;
export const FactorDocumentationStrategy: KnowledgeChunkingStrategy = Object.freeze({ strategyId: ID, strategyVersion: VERSION, supportedDocumentTypes: Object.freeze(["FACTOR_DOCUMENTATION"] as const), chunk(document: PersistedKnowledgeDocument) {
  const groups = [["HEADING", "DEFINITION"], ["CODE_OR_SCHEMA", "DECISION"], ["PARAGRAPH", "LIMITATION"], ["EXAMPLE"]] as const; const types = ["IDENTITY_AND_MEANING", "CONSTRAINTS", "INTERPRETATION", "EXAMPLE"] as const; const suffix = ["IDENTITY", "CONSTRAINTS", "INTERPRETATION", "EXAMPLES"];
  return Object.freeze(groups.map((g, i) => ({ blocks: select(document, g), i })).filter((x) => x.blocks.length).map((x, ordinal) => buildChunk(document, ID, VERSION, suffix[x.i]!, ordinal, types[x.i]!, x.blocks)));
} });
