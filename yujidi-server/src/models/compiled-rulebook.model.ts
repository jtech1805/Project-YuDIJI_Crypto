import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { COMPILED_OPTIONAL_FACTOR_BEHAVIORS, COMPILED_SUBJECT_BINDING_TYPES, FACTOR_REQUIREMENT_LEVELS } from "../types/compiled-rulebook.types.js";
import { EVIDENCE_SUBJECT_TYPES } from "../types/evidence.types.js";
import { FACTOR_KEYS } from "../types/factor-registry.types.js";
import { GENERIC_FACTOR_RELATIONSHIP_TYPES } from "../types/generic-factor-relationship.types.js";

const id = { type: String, required: true, trim: true, maxlength: 120 } as const;
const version = { type: Number, required: true, min: 1 } as const;
const policySchema = new Schema({ policyId: id, policyVersion: version }, { _id: false, strict: true });
const subjectSchema = new Schema({ type: { type: String, enum: EVIDENCE_SUBJECT_TYPES }, key: { type: String, trim: true, maxlength: 160 } }, { _id: false, strict: true });
const subjectBindingSchema = new Schema({ type: { type: String, enum: COMPILED_SUBJECT_BINDING_TYPES, required: true }, subject: { type: subjectSchema } }, { _id: false, strict: true });
const bindingSchema = new Schema({
  bindingId: id, order: { type: Number, required: true, min: 0 },
  factor: { _id: false, factorKey: { type: String, enum: FACTOR_KEYS, required: true }, factorVersion: version },
  subjectBinding: { type: subjectBindingSchema, required: true },
  evaluator: { _id: false, evaluatorId: id, evaluatorVersion: version, configurationId: id, configurationVersion: version },
  relationshipType: { type: String, enum: GENERIC_FACTOR_RELATIONSHIP_TYPES, required: true },
  requirementLevel: { type: String, enum: FACTOR_REQUIREMENT_LEVELS, required: true },
  optionalBehavior: { type: String, enum: COMPILED_OPTIONAL_FACTOR_BEHAVIORS },
  weight: { type: Number, required: true, min: 0, max: 100 },
  provider: { _id: false, providerBindingId: id, providerBindingVersion: version, resolutionPolicyId: id, resolutionPolicyVersion: version },
  executionPolicies: { _id: false, aggregationPolicyId: id, aggregationPolicyVersion: version, normalizationPolicyId: id, normalizationPolicyVersion: version, decisionBandPolicyId: id, decisionBandPolicyVersion: version },
}, { _id: false, strict: true });

bindingSchema.pre("validate", function () {
  const behavior = this.get("optionalBehavior");
  const level = this.get("requirementLevel");
  if (behavior === undefined || (level === "MANDATORY" ? behavior !== null : behavior === null || !COMPILED_OPTIONAL_FACTOR_BEHAVIORS.includes(behavior))) {
    this.invalidate("optionalBehavior", "optionalBehavior does not match requirementLevel");
  }
});

export const compiledRulebookSchema = new Schema({
  rulebookId: id,
  rulebookVersion: version,
  sourceTemplate: { _id: false, templateId: id, templateVersion: version },
  compilation: { _id: false, compilerId: id, compilerVersion: version, compilationInputHash: { type: String, required: true, minlength: 64, maxlength: 64 }, compiledAt: { type: Date, required: true } },
  factorBindings: { type: [bindingSchema], required: true },
  crossFactorPolicy: { type: policySchema, default: null },
  decisionPolicy: { type: policySchema, default: null },
}, { strict: true, versionKey: false, timestamps: false });

compiledRulebookSchema.index({ rulebookId: 1, rulebookVersion: 1 }, { unique: true });
compiledRulebookSchema.index({ "sourceTemplate.templateId": 1, "sourceTemplate.templateVersion": 1, "compilation.compiledAt": -1 });
compiledRulebookSchema.index({ "sourceTemplate.templateId": 1, "sourceTemplate.templateVersion": 1, rulebookVersion: 1, rulebookId: 1 });
compiledRulebookSchema.index({ "compilation.compilationInputHash": 1 });

export type CompiledRulebookPersistence = InferSchemaType<typeof compiledRulebookSchema>;
export type CompiledRulebookDocument = HydratedDocument<CompiledRulebookPersistence>;
export const CompiledRulebookModel = model<CompiledRulebookPersistence>("CompiledRulebook", compiledRulebookSchema);
