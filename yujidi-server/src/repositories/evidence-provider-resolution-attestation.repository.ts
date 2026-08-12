import { isDeepStrictEqual } from "node:util";

import { EvidenceProviderResolutionAttestationModel } from "../models/evidence-provider-resolution-attestation.model.js";
import { EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_STATUSES, type CreateEvidenceProviderResolutionAttestation, type EvidenceProviderResolutionAttestation, type EvidenceProviderResolutionAttestationReadResult, type EvidenceProviderResolutionAttestationRepositoryPort, type InsertEvidenceProviderResolutionAttestationResult } from "../types/evidence-provider-resolution-attestation.types.js";
import { PROVIDER_TYPES } from "../types/provider-definition.types.js";
import { PROVIDER_RESOLUTION_WARNING_CODES } from "../types/provider-resolution-policy.types.js";

type Query<T> = { lean(): { exec(): Promise<T> } };
type FindQuery<T> = { limit(value: number): Query<T[]> };
export type EvidenceProviderResolutionAttestationModelPort = Readonly<{
  create(value: unknown): Promise<unknown>;
  find(filter: Record<string, unknown>): FindQuery<Record<string, unknown>>;
}>;

export class EvidenceProviderResolutionAttestationRepository implements EvidenceProviderResolutionAttestationRepositoryPort {
  public constructor(
    private readonly model: EvidenceProviderResolutionAttestationModelPort = EvidenceProviderResolutionAttestationModel as unknown as EvidenceProviderResolutionAttestationModelPort,
  ) {}

  public async insert(candidate: CreateEvidenceProviderResolutionAttestation): Promise<InsertEvidenceProviderResolutionAttestationResult> {
    const input = cloneCandidate(candidate);
    try {
      const existing = await this.findConflicting(input);
      if (existing) return classifyExisting(input, existing);
      await this.model.create(toPersistence(input));
      const inserted = await this.findMatches({ evidenceId: input.evidenceId });
      if (inserted.length !== 1) return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      const attestation = fromPersistence(inserted[0]);
      return attestation
        ? Object.freeze({ inserted: true, code: "INSERTED", attestation })
        : Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
    } catch (error) {
      if (!duplicateKey(error)) return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      try {
        const raced = await this.findConflicting(input);
        return raced ? classifyExisting(input, raced) : Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      } catch {
        return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      }
    }
  }

  public async findExactByEvidenceId(evidenceId: string): Promise<EvidenceProviderResolutionAttestationReadResult> {
    try {
      const rows = await this.findMatches({ evidenceId });
      if (rows.length === 0) return Object.freeze({ found: false, code: "NOT_FOUND" });
      if (rows.length !== 1) return Object.freeze({ found: false, code: "INVARIANT_VIOLATION" });
      const attestation = fromPersistence(rows[0]);
      return attestation
        ? Object.freeze({ found: true, attestation })
        : Object.freeze({ found: false, code: "PERSISTENCE_ERROR" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_ERROR" });
    }
  }

  private async findConflicting(candidate: CreateEvidenceProviderResolutionAttestation): Promise<EvidenceProviderResolutionAttestation | "CORRUPTED" | null> {
    const byIdentity = await this.findMatches({ attestationId: candidate.attestationId, attestationVersion: candidate.attestationVersion });
    const byEvidence = await this.findMatches({ evidenceId: candidate.evidenceId });
    if (byIdentity.length > 1 || byEvidence.length > 1) return "CORRUPTED";
    const parsed = [...byIdentity, ...byEvidence].map(fromPersistence);
    if (parsed.length === 0) return null;
    if (parsed.some((value) => value === null)) return "CORRUPTED";
    const distinct = parsed.filter((value, index) => parsed.findIndex((other) => isDeepStrictEqual(other, value)) === index);
    return distinct.length === 1 ? distinct[0]! : "CORRUPTED";
  }

  private async findMatches(filter: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.model.find(filter).limit(2).lean().exec();
  }
}

const classifyExisting = (
  candidate: CreateEvidenceProviderResolutionAttestation,
  existing: EvidenceProviderResolutionAttestation | "CORRUPTED",
): InsertEvidenceProviderResolutionAttestationResult => existing !== "CORRUPTED" && isDeepStrictEqual(candidate, withoutCreatedAt(existing))
  ? Object.freeze({ inserted: false, code: "ALREADY_EXISTS", attestation: cloneAttestation(existing) })
  : Object.freeze({ inserted: false, code: "CONFLICT" });

const toPersistence = (value: CreateEvidenceProviderResolutionAttestation) => ({
  attestationId: value.attestationId,
  attestationVersion: value.attestationVersion,
  evidenceId: value.evidenceId,
  providerBinding: { ...value.providerBinding },
  resolutionPolicy: { ...value.resolutionPolicy },
  selectedProviderKey: value.selectedProviderKey,
  selectedProviderType: value.selectedProviderType,
  resolutionStatus: value.resolutionStatus,
  confidenceAdjustment: value.confidenceAdjustment,
  warningCodes: [...value.warningCodes],
  resolvedAt: new Date(value.resolvedAt.getTime()),
});

const fromPersistence = (row: Record<string, unknown> | undefined): EvidenceProviderResolutionAttestation | null => {
  if (!record(row) || !record(row.providerBinding) || !record(row.resolutionPolicy)) return null;
  const value = {
    attestationId: row.attestationId,
    attestationVersion: row.attestationVersion,
    evidenceId: row.evidenceId,
    providerBinding: { providerBindingId: row.providerBinding.providerBindingId, providerBindingVersion: row.providerBinding.providerBindingVersion },
    resolutionPolicy: { policyId: row.resolutionPolicy.policyId, policyVersion: row.resolutionPolicy.policyVersion },
    selectedProviderKey: row.selectedProviderKey,
    selectedProviderType: row.selectedProviderType,
    resolutionStatus: row.resolutionStatus,
    confidenceAdjustment: row.confidenceAdjustment,
    warningCodes: row.warningCodes,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
  return validAttestation(value) ? cloneAttestation(value) : null;
};

const validAttestation = (value: any): value is EvidenceProviderResolutionAttestation => identifier(value.attestationId)
  && positive(value.attestationVersion) && evidenceId(value.evidenceId)
  && identifier(value.providerBinding.providerBindingId) && positive(value.providerBinding.providerBindingVersion)
  && identifier(value.resolutionPolicy.policyId) && positive(value.resolutionPolicy.policyVersion)
  && identifier(value.selectedProviderKey) && PROVIDER_TYPES.includes(value.selectedProviderType)
  && EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_STATUSES.includes(value.resolutionStatus)
  && finiteNonPositive(value.confidenceAdjustment) && validWarnings(value.warningCodes)
  && validDate(value.resolvedAt) && validDate(value.createdAt)
  && value.resolvedAt.getTime() <= value.createdAt.getTime();

const withoutCreatedAt = (value: EvidenceProviderResolutionAttestation): CreateEvidenceProviderResolutionAttestation => cloneCandidate(value);
const cloneCandidate = (value: CreateEvidenceProviderResolutionAttestation): CreateEvidenceProviderResolutionAttestation => Object.freeze({
  attestationId: value.attestationId, attestationVersion: value.attestationVersion, evidenceId: value.evidenceId,
  providerBinding: Object.freeze({ ...value.providerBinding }), resolutionPolicy: Object.freeze({ ...value.resolutionPolicy }),
  selectedProviderKey: value.selectedProviderKey, selectedProviderType: value.selectedProviderType,
  resolutionStatus: value.resolutionStatus, confidenceAdjustment: value.confidenceAdjustment,
  warningCodes: Object.freeze([...value.warningCodes]), resolvedAt: Object.freeze(new Date(value.resolvedAt.getTime())) as Date,
});
const cloneAttestation = (value: EvidenceProviderResolutionAttestation): EvidenceProviderResolutionAttestation => Object.freeze({
  ...cloneCandidate(value), createdAt: Object.freeze(new Date(value.createdAt.getTime())) as Date,
});

const validWarnings = (value: unknown): value is readonly any[] => Array.isArray(value) && dense(value)
  && value.every((warning) => PROVIDER_RESOLUTION_WARNING_CODES.includes(warning))
  && new Set(value).size === value.length
  && value.every((warning, index) => index === 0 || PROVIDER_RESOLUTION_WARNING_CODES.indexOf(value[index - 1]) < PROVIDER_RESOLUTION_WARNING_CODES.indexOf(warning));
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const evidenceId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && value.trim() === value;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const finiteNonPositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value <= 0;
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const dense = (value: readonly unknown[]) => value.every((_, index) => index in value);
const duplicateKey = (error: unknown) => record(error) && error.code === 11000;
