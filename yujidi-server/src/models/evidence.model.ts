import {
  model,
  Schema,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";

import {
  EVIDENCE_RECORD_TYPES,
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SUBJECT_TYPES,
  EVIDENCE_VALUE_TYPES,
} from "../types/evidence.types.js";

const trimmedString = (maxlength: number, required = false) => ({
  type: String,
  trim: true,
  maxlength,
  ...(required ? { required: true } : {}),
});

const evidenceValueSchema = new Schema(
  {
    type: { type: String, enum: EVIDENCE_VALUE_TYPES, required: true },
    numberValue: {
      type: Number,
      validate: {
        validator: (value: number): boolean => Number.isFinite(value),
        message: "numberValue must be finite",
      },
    },
    unit: trimmedString(40),
    booleanValue: Boolean,
    categoryValue: trimmedString(160),
    eventCode: trimmedString(160),
    summary: trimmedString(500),
  },
  { _id: false },
);

evidenceValueSchema.path("type").validate(function (): boolean {
  const value = this as unknown as Record<string, unknown>;
  const present = (key: string): boolean => value[key] !== undefined;
  switch (value.type) {
    case "NUMBER":
      return present("numberValue")
        && !present("booleanValue")
        && !present("categoryValue")
        && !present("eventCode");
    case "BOOLEAN":
      return present("booleanValue")
        && !present("numberValue")
        && !present("categoryValue")
        && !present("eventCode");
    case "CATEGORY":
      return present("categoryValue")
        && !present("numberValue")
        && !present("booleanValue")
        && !present("eventCode");
    case "EVENT":
      return present("eventCode")
        && !present("numberValue")
        && !present("booleanValue")
        && !present("categoryValue");
    default:
      return false;
  }
}, "value fields do not match value type");

const evidenceSchema = new Schema(
  {
    evidenceId: { ...trimmedString(128, true), unique: true },
    recordType: { type: String, enum: EVIDENCE_RECORD_TYPES, required: true },
    factorKey: trimmedString(160, true),
    deduplicationKey: { ...trimmedString(256, true), unique: true },
    subject: {
      _id: false,
      type: { type: String, enum: EVIDENCE_SUBJECT_TYPES, required: true },
      key: trimmedString(256, true),
      symbol: trimmedString(80),
      exchange: trimmedString(80),
      marketType: trimmedString(80),
      timeframe: trimmedString(80),
    },
    provenance: {
      _id: false,
      sourceType: { type: String, enum: EVIDENCE_SOURCE_TYPES, required: true },
      provider: trimmedString(120, true),
      sourceName: trimmedString(160),
      externalReference: trimmedString(512),
      sourcePublishedAt: Date,
    },
    value: evidenceValueSchema,
    observedAt: { type: Date, required: true },
    validFrom: Date,
    validUntil: Date,
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      validate: {
        validator: (value: number): boolean => Number.isFinite(value),
        message: "confidence must be finite",
      },
    },
    supersedesEvidenceId: trimmedString(128),
    revokesEvidenceId: trimmedString(128),
    reasonCode: trimmedString(160),
    schemaVersion: trimmedString(80, true),
  },
  {
    strict: true,
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

evidenceSchema.pre("validate", function () {
  const isPresent = (path: string): boolean => this.get(path) !== undefined;
  if (this.get("recordType") === "OBSERVATION") {
    if (!isPresent("value")) this.invalidate("value", "value is required for observations");
    if (isPresent("revokesEvidenceId")) {
      this.invalidate("revokesEvidenceId", "revokesEvidenceId is forbidden for observations");
    }
    if (isPresent("reasonCode")) {
      this.invalidate("reasonCode", "reasonCode is forbidden for observations");
    }
  }
  if (this.get("recordType") === "REVOCATION") {
    if (isPresent("value")) this.invalidate("value", "value is forbidden for revocations");
    if (!isPresent("revokesEvidenceId")) {
      this.invalidate("revokesEvidenceId", "revokesEvidenceId is required for revocations");
    }
    if (!isPresent("reasonCode")) {
      this.invalidate("reasonCode", "reasonCode is required for revocations");
    }
    for (const path of ["supersedesEvidenceId", "validFrom", "validUntil"]) {
      if (isPresent(path)) this.invalidate(path, `${path} is forbidden for revocations`);
    }
  }

  const validFrom = this.get("validFrom") as Date | undefined;
  const validUntil = this.get("validUntil") as Date | undefined;
  if (validFrom && validUntil && validUntil.getTime() < validFrom.getTime()) {
    this.invalidate("validUntil", "validUntil must be greater than or equal to validFrom");
  }
});

evidenceSchema.index({ factorKey: 1, observedAt: -1 });
evidenceSchema.index({ "subject.type": 1, "subject.key": 1, observedAt: -1 });
evidenceSchema.index({
  "provenance.sourceType": 1,
  "provenance.provider": 1,
  observedAt: -1,
});
evidenceSchema.index({ recordType: 1, observedAt: -1 });
evidenceSchema.index({ revokesEvidenceId: 1, createdAt: -1 }, { sparse: true });
evidenceSchema.index({ supersedesEvidenceId: 1, createdAt: -1 }, { sparse: true });
evidenceSchema.index({
  factorKey: 1,
  "subject.type": 1,
  "subject.key": 1,
  observedAt: 1,
  evidenceId: 1,
});
evidenceSchema.index(
  { revokesEvidenceId: 1, observedAt: 1, evidenceId: 1 },
  { sparse: true },
);
evidenceSchema.index(
  { supersedesEvidenceId: 1, observedAt: 1, evidenceId: 1 },
  { sparse: true },
);

export type Evidence = InferSchemaType<typeof evidenceSchema>;
export type EvidenceDocument = HydratedDocument<Evidence>;
export const EvidenceModel = model<Evidence>("Evidence", evidenceSchema);
