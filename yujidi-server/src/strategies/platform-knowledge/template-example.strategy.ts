import type { KnowledgeChunkingStrategy } from "../../types/knowledge-chunking.types.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import { buildChunk } from "./platform-strategy.helpers.js";
const ID = "PLATFORM_TEMPLATE_EXAMPLE", VERSION = 1;
export const TemplateExampleStrategy: KnowledgeChunkingStrategy = Object.freeze({ strategyId: ID, strategyVersion: VERSION, supportedDocumentTypes: Object.freeze(["TEMPLATE_EXAMPLE"] as const), chunk(document: PersistedKnowledgeDocument) { const raw = document.blocks.flatMap((b) => b.semanticLabels).find((x) => x.startsWith("EXAMPLE_CLASSIFICATION:"))?.split(":")[1]; const classification = raw === "NEGATIVE_EXAMPLE" || raw === "CHARACTERIZATION_ONLY" ? raw : "APPROVED_EXAMPLE"; return Object.freeze([buildChunk(document, ID, VERSION, classification, 0, classification === "NEGATIVE_EXAMPLE" ? "NEGATIVE_EXAMPLE" : "EXAMPLE", document.blocks, classification)]); } });
