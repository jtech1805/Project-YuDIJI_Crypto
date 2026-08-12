import { KnowledgeDocumentAdmissionService } from "../../src/services/knowledge/knowledge-document-admission.service.js";
import type { KnowledgeDocumentMaterial, PersistedKnowledgeDocument, PlatformKnowledgeDocumentType, NormalizedKnowledgeBlock } from "../../src/types/knowledge-document.types.js";

const block = (blockId: string, ordinal: number, blockType: NormalizedKnowledgeBlock["blockType"], text: string, labels: readonly string[] = [], refs: NormalizedKnowledgeBlock["authorityReferences"] = []): NormalizedKnowledgeBlock => ({ blockId, ordinal, blockType, text, sectionPath: ["YUDIJI"], sourceSpan: { sectionPath: ["YUDIJI"], paragraphStart: ordinal, paragraphEnd: ordinal }, semanticLabels: labels, authorityReferences: refs });
export const documentMaterial = (documentType: PlatformKnowledgeDocumentType = "FACTOR_DOCUMENTATION", documentId = "CRYPTO_ETF_FLOW_DOC"): KnowledgeDocumentMaterial => ({
  identity: { documentId, documentVersion: 1 }, corpus: "PLATFORM_KNOWLEDGE", documentType, title: `${documentType} fixture`, ownership: { ownerType: "SYSTEM", ownerId: "YUDIJI_PLATFORM" },
  source: { sourceType: "MANUAL_NORMALIZED_FIXTURE", sourceIdentity: `${documentId}:SOURCE` }, trustLevel: "APPROVED_GUIDANCE", parser: { parserId: "MANUAL_NORMALIZER", parserVersion: 1 }, admissionPolicy: { policyId: "PLATFORM_KNOWLEDGE_ADMISSION", policyVersion: 1 },
  blocks: documentType === "FACTOR_DOCUMENTATION" ? [
    block("IDENTITY", 0, "DEFINITION", "CRYPTO.ETF_NET_FLOW measures net Bitcoin ETF flow.", ["TOPIC:ETF_FLOW"], [{ authorityType: "FACTOR", authorityId: "CRYPTO.ETF_NET_FLOW", authorityVersion: 1 }]),
    block("CONSTRAINT", 1, "CODE_OR_SCHEMA", "Subject ASSET/BTC, numeric USD value.", ["SUBJECT:ASSET"], [{ authorityType: "FACTOR", authorityId: "CRYPTO.ETF_NET_FLOW", authorityVersion: 1 }]),
    block("LIMIT", 2, "LIMITATION", "Do not silently substitute price for ETF flow."),
    block("EXAMPLE", 3, "EXAMPLE", "Positive net flow with DIRECT relationship is supportive.", ["RELATIONSHIP:DIRECT"]),
  ] : [
    block("PRIMARY", 0, documentType === "ADR_SUMMARY" ? "DECISION" : "DEFINITION", `${documentType} approved meaning and exact behavior.`, documentType === "TEMPLATE_EXAMPLE" ? ["EXAMPLE_CLASSIFICATION:APPROVED_EXAMPLE"] : documentType === "VALIDATION_GUIDANCE" ? ["VALIDATION_CODE:FACTOR_NOT_REGISTERED"] : ["RELATIONSHIP:INVERSE"], documentType === "ADR_SUMMARY" ? [{ authorityType: "ADR", authorityId: "ADR-060", authorityVersion: 1 }] : []),
    block("SECONDARY", 1, documentType === "ADR_SUMMARY" ? "CONSEQUENCE" : "LIMITATION", documentType === "VALIDATION_GUIDANCE" ? "Register the exact factor or preserve it as unresolved." : "Restrictions and consequences remain attached."),
  ],
});
export const admittedDocument = (type: PlatformKnowledgeDocumentType = "FACTOR_DOCUMENTATION", id?: string) => { const result = new KnowledgeDocumentAdmissionService().admit({ document: documentMaterial(type, id) }); if (!result.admitted) throw new Error(result.code); return result.document; };
export const persistedDocument = (type: PlatformKnowledgeDocumentType = "FACTOR_DOCUMENTATION", id?: string): PersistedKnowledgeDocument => ({ ...admittedDocument(type, id), createdAt: new Date("2026-08-05T00:00:00.000Z") });
export const negativeTemplateDocument = (): PersistedKnowledgeDocument => {
  const material = documentMaterial("TEMPLATE_EXAMPLE", "NEGATIVE_TEMPLATE_DOC");
  const blocks = material.blocks.map((value) => ({ ...value, semanticLabels: value.semanticLabels.map((label) => label === "EXAMPLE_CLASSIFICATION:APPROVED_EXAMPLE" ? "EXAMPLE_CLASSIFICATION:NEGATIVE_EXAMPLE" : label), ...(value.text ? { text: value.text.replace("approved meaning", "invalid silent factor substitution") } : {}) }));
  const admitted = new KnowledgeDocumentAdmissionService().admit({ document: { ...material, blocks } });
  if (!admitted.admitted) throw new Error(admitted.code);
  return { ...admitted.document, createdAt: new Date("2026-08-05T00:00:00.000Z") };
};
