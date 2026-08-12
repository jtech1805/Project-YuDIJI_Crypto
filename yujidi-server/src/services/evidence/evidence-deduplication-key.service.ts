import { createHash } from "node:crypto";

import type { EvidenceCandidate } from "../../types/evidence-ingestion.types.js";

export const EVIDENCE_DEDUPLICATION_VERSION = "v1" as const;

const canonicalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }
  return value;
};

export class EvidenceDeduplicationKeyBuilder {
  public build(candidate: EvidenceCandidate): string {
    const canonicalIdentity = JSON.stringify({
      candidate: canonicalize(candidate),
      version: EVIDENCE_DEDUPLICATION_VERSION,
    });
    const digest = createHash("sha256").update(canonicalIdentity, "utf8").digest("hex");
    return `evidence:${EVIDENCE_DEDUPLICATION_VERSION}:${digest}`;
  }
}

export const evidenceDeduplicationKeyBuilder =
  new EvidenceDeduplicationKeyBuilder();
