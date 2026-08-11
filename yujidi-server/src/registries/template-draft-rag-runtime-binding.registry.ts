import { freezeClone } from "../services/knowledge-document-admission.service.js";
import {
  GEMINI_GENERATION_MODEL,
  GEMINI_GENERATION_PROVIDER,
} from "../types/gemini-generation-adapter.types.js";
import type { TemplateDraftRagRuntimeBinding } from "../types/template-draft-rag-runtime-binding.types.js";
export const TEMPLATE_DRAFT_RAG_RUNTIME_V1: TemplateDraftRagRuntimeBinding =
  Object.freeze({
    bindingId: "YUDIJI_TEMPLATE_DRAFT_RAG_RUNTIME",
    bindingVersion: 1,
    indexPublicationId: "YUDIJI_PLATFORM_KNOWLEDGE_GEMINI_ATLAS_PUBLICATION",
    indexPublicationVersion: 1,
    retrievalPolicyId: "GEMINI_ATLAS_RAG_LIVE",
    retrievalPolicyVersion: 1,
    promptId: "TEMPLATE_DRAFT_REGISTRY_GROUNDED",
    promptVersion: 1,
    candidateSchemaId: "TEMPLATE_DRAFT_CANDIDATE",
    candidateSchemaVersion: 1,
    generationProvider: GEMINI_GENERATION_PROVIDER,
    generationModel: GEMINI_GENERATION_MODEL,
    embeddingSchemaId: "YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING",
    embeddingSchemaVersion: 1,
    executionPolicyId: "TEMPLATE_DRAFT_RAG_EXECUTION_POLICY",
    executionPolicyVersion: 1,
    rolloutMode: "SHADOW_ONLY",
    corpus: "PLATFORM_KNOWLEDGE",
  });
export class TemplateDraftRagRuntimeBindingRegistry {
  getExact(id: string, v: number) {
    return id === TEMPLATE_DRAFT_RAG_RUNTIME_V1.bindingId && v === 1
      ? freezeClone(TEMPLATE_DRAFT_RAG_RUNTIME_V1)
      : null;
  }
}
