import {
  EVIDENCE_RECORD_TYPES,
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SUBJECT_TYPES,
  EVIDENCE_VALUE_TYPES,
} from "../../types/evidence.types.js";
import type { EvidenceCandidate } from "../../types/evidence-ingestion.types.js";

export class EvidenceCandidateValidationError extends Error {
  public constructor() {
    super("Evidence candidate is invalid");
    this.name = "EvidenceCandidateValidationError";
  }
}

function fail(): never {
  throw new EvidenceCandidateValidationError();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const assertKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void => {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(value, key))) fail();
  if (Object.keys(value).some((key) => !allowed.has(key))) fail();
};

function assertString(value: unknown, maxLength: number): asserts value is string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maxLength
    || value.trim() !== value
  ) fail();
}

const assertOptionalString = (
  value: Record<string, unknown>,
  key: string,
  maxLength: number,
): void => {
  if (Object.hasOwn(value, key)) assertString(value[key], maxLength);
};

function assertDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail();
}

const assertOptionalDate = (value: Record<string, unknown>, key: string): void => {
  if (Object.hasOwn(value, key)) assertDate(value[key]);
};

const assertEnum = (value: unknown, values: readonly string[]): void => {
  if (typeof value !== "string" || !values.includes(value)) fail();
};

const validateSubject = (subject: unknown): void => {
  if (!isObject(subject)) fail();
  assertKeys(subject, ["type", "key"], ["symbol", "exchange", "marketType", "timeframe"]);
  assertEnum(subject.type, EVIDENCE_SUBJECT_TYPES);
  assertString(subject.key, 256);
  assertOptionalString(subject, "symbol", 80);
  assertOptionalString(subject, "exchange", 80);
  assertOptionalString(subject, "marketType", 80);
  assertOptionalString(subject, "timeframe", 80);
};

const validateProvenance = (provenance: unknown): void => {
  if (!isObject(provenance)) fail();
  assertKeys(
    provenance,
    ["sourceType", "provider"],
    ["sourceName", "externalReference", "sourcePublishedAt"],
  );
  assertEnum(provenance.sourceType, EVIDENCE_SOURCE_TYPES);
  assertString(provenance.provider, 120);
  assertOptionalString(provenance, "sourceName", 160);
  assertOptionalString(provenance, "externalReference", 512);
  assertOptionalDate(provenance, "sourcePublishedAt");
};

const validateValue = (value: unknown): void => {
  if (!isObject(value)) fail();
  assertEnum(value.type, EVIDENCE_VALUE_TYPES);
  switch (value.type) {
    case "NUMBER":
      assertKeys(value, ["type", "numberValue"], ["unit"]);
      if (typeof value.numberValue !== "number" || !Number.isFinite(value.numberValue)) fail();
      assertOptionalString(value, "unit", 40);
      return;
    case "BOOLEAN":
      assertKeys(value, ["type", "booleanValue"]);
      if (typeof value.booleanValue !== "boolean") fail();
      return;
    case "CATEGORY":
      assertKeys(value, ["type", "categoryValue"]);
      assertString(value.categoryValue, 160);
      return;
    case "EVENT":
      assertKeys(value, ["type", "eventCode"], ["summary"]);
      assertString(value.eventCode, 160);
      assertOptionalString(value, "summary", 500);
      return;
    default:
      fail();
  }
};

const cloneCandidate = (candidate: EvidenceCandidate): EvidenceCandidate =>
  structuredClone(candidate);

export class EvidenceCandidateNormalizer {
  public normalize(candidate: unknown): EvidenceCandidate {
    if (!isObject(candidate)) fail();
    assertEnum(candidate.recordType, EVIDENCE_RECORD_TYPES);

    const commonRequired = [
      "recordType",
      "factorKey",
      "subject",
      "provenance",
      "observedAt",
      "schemaVersion",
    ];
    if (candidate.recordType === "OBSERVATION") {
      assertKeys(
        candidate,
        [...commonRequired, "value"],
        ["validFrom", "validUntil", "confidence", "supersedesEvidenceId"],
      );
    } else if (candidate.recordType === "REVOCATION") {
      assertKeys(candidate, [...commonRequired, "revokesEvidenceId", "reasonCode"]);
    } else {
      fail();
    }

    assertString(candidate.factorKey, 160);
    validateSubject(candidate.subject);
    validateProvenance(candidate.provenance);
    assertDate(candidate.observedAt);
    assertString(candidate.schemaVersion, 80);

    if (candidate.recordType === "OBSERVATION") {
      validateValue(candidate.value);
      assertOptionalDate(candidate, "validFrom");
      assertOptionalDate(candidate, "validUntil");
      if (
        candidate.validFrom instanceof Date
        && candidate.validUntil instanceof Date
        && candidate.validUntil.getTime() < candidate.validFrom.getTime()
      ) fail();
      if (
        Object.hasOwn(candidate, "confidence")
        && (
          typeof candidate.confidence !== "number"
          || !Number.isFinite(candidate.confidence)
          || candidate.confidence < 0
          || candidate.confidence > 1
        )
      ) fail();
      assertOptionalString(candidate, "supersedesEvidenceId", 128);
    } else {
      assertString(candidate.revokesEvidenceId, 128);
      assertString(candidate.reasonCode, 160);
    }

    return cloneCandidate(candidate as EvidenceCandidate);
  }
}

export const evidenceCandidateNormalizer = new EvidenceCandidateNormalizer();
