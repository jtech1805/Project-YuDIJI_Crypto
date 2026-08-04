import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

import { COMPILED_EXECUTION_BINDING_TEMPLATE_SCOPES } from "../types/compiled-rulebook-execution-binding.types.js";

const identifier = { type: String, required: true, trim: true, maxlength: 120 } as const;
const version = { type: Number, required: true, min: 1 } as const;

export const compiledRulebookExecutionBindingSchema = new Schema({
  bindingId: identifier,
  bindingVersion: version,
  sourceTemplate: {
    _id: false,
    templateId: identifier,
    templateVersion: version,
    scope: { type: String, enum: COMPILED_EXECUTION_BINDING_TEMPLATE_SCOPES, required: true },
  },
  compiledRulebook: {
    _id: false,
    rulebookId: identifier,
    rulebookVersion: version,
  },
  createdAt: { type: Date, required: true },
}, { strict: true, versionKey: false, timestamps: false });

compiledRulebookExecutionBindingSchema.index(
  { bindingId: 1, bindingVersion: 1 },
  { unique: true },
);
compiledRulebookExecutionBindingSchema.index(
  { "sourceTemplate.templateId": 1, "sourceTemplate.templateVersion": 1, "sourceTemplate.scope": 1 },
  { unique: true },
);

export type CompiledRulebookExecutionBindingPersistence = InferSchemaType<typeof compiledRulebookExecutionBindingSchema>;
export type CompiledRulebookExecutionBindingDocument = HydratedDocument<CompiledRulebookExecutionBindingPersistence>;
export const CompiledRulebookExecutionBindingModel = model<CompiledRulebookExecutionBindingPersistence>(
  "CompiledRulebookExecutionBinding",
  compiledRulebookExecutionBindingSchema,
);
