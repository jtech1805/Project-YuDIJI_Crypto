import type { EvidenceRepositoryContract } from "../../repositories/evidence.repository.js";
import { EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_STATUSES, type CreateEvidenceProviderResolutionAttestation, type EvidenceProviderResolutionAttestation, type EvidenceProviderResolutionAttestationReadResult, type EvidenceProviderResolutionAttestationRepositoryPort, type EvidenceProviderResolutionAttestationValidationFailure, type InsertEvidenceProviderResolutionAttestationResult } from "../../types/evidence-provider-resolution-attestation.types.js";
import { PROVIDER_TYPES } from "../../types/provider-definition.types.js";
import { PROVIDER_RESOLUTION_WARNING_CODES } from "../../types/provider-resolution-policy.types.js";

type EvidenceLookup = Pick<EvidenceRepositoryContract, "findByEvidenceId">;

export class EvidenceProviderResolutionAttestationService {
  public constructor(
    private readonly repository: EvidenceProviderResolutionAttestationRepositoryPort,
    private readonly evidenceRepository: EvidenceLookup,
  ) {}

  public async insert(candidate: unknown): Promise<InsertEvidenceProviderResolutionAttestationResult> {
    const validated = validate(candidate);
    if (!validated.valid) return Object.freeze({ inserted: false, code: "INVALID_REQUEST", failure: validated.failure });
    try {
      const evidence = await this.evidenceRepository.findByEvidenceId(validated.attestation.evidenceId);
      if (!evidence) return Object.freeze({ inserted: false, code: "EVIDENCE_NOT_FOUND" });
    } catch {
      return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
    }
    return cloneInsertResult(await this.repository.insert(validated.attestation));
  }

  public async getExactByEvidenceId(evidenceId: unknown): Promise<EvidenceProviderResolutionAttestationReadResult> {
    if (!validEvidenceId(evidenceId)) return Object.freeze({ found: false, code: "INVALID_REQUEST" });
    return cloneReadResult(await this.repository.findExactByEvidenceId(evidenceId));
  }
}

type Validation = Readonly<{ valid: true; attestation: CreateEvidenceProviderResolutionAttestation }>
  | Readonly<{ valid: false; failure: EvidenceProviderResolutionAttestationValidationFailure }>;

const validate = (value: unknown): Validation => {
  if (!record(value) || !identifier(value.attestationId)) return invalid("INVALID_ATTESTATION_ID");
  if (!positive(value.attestationVersion)) return invalid("INVALID_ATTESTATION_VERSION");
  if (!validEvidenceId(value.evidenceId)) return invalid("INVALID_EVIDENCE_ID");
  if (!record(value.providerBinding)) return invalid("INVALID_PROVIDER_BINDING");
  if (!identifier(value.providerBinding.providerBindingId)) return invalid("INVALID_PROVIDER_BINDING_ID");
  if (!positive(value.providerBinding.providerBindingVersion)) return invalid("INVALID_PROVIDER_BINDING_VERSION");
  if (!record(value.resolutionPolicy)) return invalid("INVALID_RESOLUTION_POLICY");
  if (!identifier(value.resolutionPolicy.policyId)) return invalid("INVALID_RESOLUTION_POLICY_ID");
  if (!positive(value.resolutionPolicy.policyVersion)) return invalid("INVALID_RESOLUTION_POLICY_VERSION");
  if (!identifier(value.selectedProviderKey)) return invalid("INVALID_SELECTED_PROVIDER");
  if (!PROVIDER_TYPES.includes(value.selectedProviderType)) return invalid("INVALID_SELECTED_PROVIDER_TYPE");
  if (!EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_STATUSES.includes(value.resolutionStatus)) return invalid("UNSUPPORTED_RESOLUTION_STATUS");
  if (!finiteNonPositive(value.confidenceAdjustment) || (value.resolutionStatus === "RESOLVED" && value.confidenceAdjustment !== 0)) return invalid("INVALID_CONFIDENCE_ADJUSTMENT");
  if (!validWarnings(value.warningCodes)) return invalid("INVALID_WARNINGS");
  if (!validDate(value.resolvedAt)) return invalid("INVALID_RESOLVED_AT");
  if (Object.hasOwn(value, "createdAt")) return invalid("CALLER_CREATED_AT_FORBIDDEN");
  return Object.freeze({ valid: true, attestation: cloneCandidate(value as CreateEvidenceProviderResolutionAttestation) });
};

const cloneInsertResult = (result: InsertEvidenceProviderResolutionAttestationResult): InsertEvidenceProviderResolutionAttestationResult => result.code === "INSERTED"
  ? Object.freeze({ inserted: true, code: "INSERTED", attestation: cloneAttestation(result.attestation) })
  : result.code === "ALREADY_EXISTS"
    ? Object.freeze({ inserted: false, code: "ALREADY_EXISTS", attestation: cloneAttestation(result.attestation) })
    : Object.freeze({ ...result });
const cloneReadResult = (result: EvidenceProviderResolutionAttestationReadResult): EvidenceProviderResolutionAttestationReadResult => result.found
  ? Object.freeze({ found: true, attestation: cloneAttestation(result.attestation) })
  : Object.freeze({ ...result });
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

const invalid = (failure: EvidenceProviderResolutionAttestationValidationFailure): Validation => Object.freeze({ valid: false, failure });
const validWarnings = (value: unknown): value is readonly any[] => Array.isArray(value) && dense(value)
  && value.every((warning) => PROVIDER_RESOLUTION_WARNING_CODES.includes(warning))
  && new Set(value).size === value.length
  && value.every((warning, index) => index === 0 || PROVIDER_RESOLUTION_WARNING_CODES.indexOf(value[index - 1]) < PROVIDER_RESOLUTION_WARNING_CODES.indexOf(warning));
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const validEvidenceId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && value.trim() === value;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const finiteNonPositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value <= 0;
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const dense = (value: readonly unknown[]) => value.every((_, index) => index in value);
