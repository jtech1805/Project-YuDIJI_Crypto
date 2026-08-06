export const DRAFT_CITATION_PURPOSES=["FACTOR_EXPLANATION","RELATIONSHIP_EXPLANATION","EXAMPLE","LIMITATION","UNRESOLVED_CONCEPT","VALIDATION_GUIDANCE"] as const;
export type DraftCitationPurpose=typeof DRAFT_CITATION_PURPOSES[number];
export type DraftCitationReference=Readonly<{citationHandle:string;purpose:DraftCitationPurpose;claimTarget:Readonly<{type:"BINDING"|"UNRESOLVED_CONCEPT"|"CLARIFICATION"|"GENERAL";id:string}>}>;
export type DraftCitationDiagnostic=Readonly<{reference:DraftCitationReference;status:"VALID"|"UNKNOWN_HANDLE"|"DUPLICATE_HANDLE"|"CONTEXT_MISMATCH"|"HANDLE_NOT_SELECTED";claimValid:boolean}>;
export type TemplateDraftRagContradictionCode="RETRIEVED_FACTOR_NOT_REGISTERED"|"RETRIEVED_FACTOR_VERSION_STALE"|"RETRIEVED_RELATIONSHIP_NOT_SUPPORTED"|"RETRIEVED_SUBJECT_NOT_ALLOWED"|"RETRIEVED_PROVIDER_CAPABILITY_CONFLICT"|"RETRIEVED_COMPILATION_SUPPORT_CONFLICT"|"MODEL_OVERRULED_REGISTRY"|"CITATION_DOES_NOT_SUPPORT_CLAIM_TYPE";
export type TemplateDraftRagContradiction=Readonly<{code:TemplateDraftRagContradictionCode;claimTargetType:string;claimTargetId:string;citationHandle?:string}>;
