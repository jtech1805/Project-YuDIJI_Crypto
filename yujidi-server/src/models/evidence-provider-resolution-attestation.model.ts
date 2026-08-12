import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

import { PROVIDER_TYPES } from "../types/provider-definition.types.js";
import { PROVIDER_RESOLUTION_WARNING_CODES } from "../types/provider-resolution-policy.types.js";
import { EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_STATUSES } from "../types/evidence-provider-resolution-attestation.types.js";

const identifier = { type: String, required: true, trim: true, maxlength: 120 } as const;
const version = { type: Number, required: true, min: 1 } as const;

export const evidenceProviderResolutionAttestationSchema = new Schema({
  attestationId: identifier,
  attestationVersion: version,
  evidenceId: { type: String, required: true, trim: true, maxlength: 128 },
  providerBinding: {
    _id: false,
    providerBindingId: identifier,
    providerBindingVersion: version,
  },
  resolutionPolicy: {
    _id: false,
    policyId: identifier,
    policyVersion: version,
  },
  selectedProviderKey: identifier,
  selectedProviderType: { type: String, enum: PROVIDER_TYPES, required: true },
  resolutionStatus: { type: String, enum: EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_STATUSES, required: true },
  confidenceAdjustment: {
    type: Number,
    required: true,
    max: 0,
    validate: { validator: (value: number) => Number.isFinite(value), message: "confidenceAdjustment must be finite" },
  },
  warningCodes: { type: [{ type: String, enum: PROVIDER_RESOLUTION_WARNING_CODES }], required: true },
  resolvedAt: { type: Date, required: true },
}, {
  strict: true,
  versionKey: false,
  timestamps: { createdAt: true, updatedAt: false },
});

evidenceProviderResolutionAttestationSchema.index(
  { attestationId: 1, attestationVersion: 1 },
  { unique: true },
);
evidenceProviderResolutionAttestationSchema.index({ evidenceId: 1 }, { unique: true });

evidenceProviderResolutionAttestationSchema.pre("validate", function () {
  const resolvedAt = this.get("resolvedAt") as Date | undefined;
  const createdAt = this.get("createdAt") as Date | undefined;
  if (resolvedAt && createdAt && resolvedAt.getTime() > createdAt.getTime()) {
    this.invalidate("resolvedAt", "resolvedAt must be no later than createdAt");
  }
});

export type EvidenceProviderResolutionAttestationPersistence = InferSchemaType<typeof evidenceProviderResolutionAttestationSchema>;
export type EvidenceProviderResolutionAttestationDocument = HydratedDocument<EvidenceProviderResolutionAttestationPersistence>;
export const EvidenceProviderResolutionAttestationModel = model<EvidenceProviderResolutionAttestationPersistence>(
  "EvidenceProviderResolutionAttestation",
  evidenceProviderResolutionAttestationSchema,
);
