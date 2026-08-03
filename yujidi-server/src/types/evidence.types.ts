export const EVIDENCE_RECORD_TYPES = ["OBSERVATION", "REVOCATION"] as const;
export type EvidenceRecordType = (typeof EVIDENCE_RECORD_TYPES)[number];

export const EVIDENCE_VALUE_TYPES = ["NUMBER", "BOOLEAN", "CATEGORY", "EVENT"] as const;
export type EvidenceValueType = (typeof EVIDENCE_VALUE_TYPES)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "MARKET_DATA",
  "MACRO_DATA",
  "NEWS",
  "BROKER",
  "INTERNAL_CALCULATION",
  "MANUAL",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_SUBJECT_TYPES = [
  "INSTRUMENT",
  "ASSET",
  "MARKET",
  "ECONOMY",
  "EVENT",
  "PORTFOLIO",
] as const;
export type EvidenceSubjectType = (typeof EVIDENCE_SUBJECT_TYPES)[number];

export type EvidenceNumberValue = {
  type: "NUMBER";
  numberValue: number;
  unit?: string;
};

export type EvidenceBooleanValue = {
  type: "BOOLEAN";
  booleanValue: boolean;
};

export type EvidenceCategoryValue = {
  type: "CATEGORY";
  categoryValue: string;
};

export type EvidenceEventValue = {
  type: "EVENT";
  eventCode: string;
  summary?: string;
};

export type EvidenceValue =
  | EvidenceNumberValue
  | EvidenceBooleanValue
  | EvidenceCategoryValue
  | EvidenceEventValue;

export type EvidenceProvenance = {
  sourceType: EvidenceSourceType;
  provider: string;
  sourceName?: string;
  externalReference?: string;
  sourcePublishedAt?: Date;
};

export type EvidenceSubject = {
  type: EvidenceSubjectType;
  key: string;
  symbol?: string;
  exchange?: string;
  marketType?: string;
  timeframe?: string;
};

export type CreateEvidenceObservationInput = {
  evidenceId: string;
  recordType: "OBSERVATION";
  factorKey: string;
  deduplicationKey: string;
  subject: EvidenceSubject;
  provenance: EvidenceProvenance;
  value: EvidenceValue;
  observedAt: Date;
  validFrom?: Date;
  validUntil?: Date;
  confidence?: number;
  supersedesEvidenceId?: string;
  schemaVersion: string;
};

export type CreateEvidenceRevocationInput = {
  evidenceId: string;
  recordType: "REVOCATION";
  factorKey: string;
  deduplicationKey: string;
  subject: EvidenceSubject;
  provenance: EvidenceProvenance;
  observedAt: Date;
  revokesEvidenceId: string;
  reasonCode: string;
  schemaVersion: string;
};

export type CreateEvidenceInput =
  | CreateEvidenceObservationInput
  | CreateEvidenceRevocationInput;
