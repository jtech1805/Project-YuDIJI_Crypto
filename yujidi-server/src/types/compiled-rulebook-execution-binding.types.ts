import type { CompiledRulebookIdentity } from "./compiled-rulebook.types.js";

export const COMPILED_EXECUTION_BINDING_TEMPLATE_SCOPES = Object.freeze(["SYSTEM"] as const);
export type CompiledExecutionBindingTemplateScope = (typeof COMPILED_EXECUTION_BINDING_TEMPLATE_SCOPES)[number];

export type ExactSystemTemplateIdentity = Readonly<{
  templateId: string;
  templateVersion: number;
  scope: CompiledExecutionBindingTemplateScope;
}>;

export type CompiledRulebookExecutionBindingIdentity = Readonly<{
  bindingId: string;
  bindingVersion: number;
}>;

export type CompiledRulebookExecutionBinding = Readonly<{
  bindingId: string;
  bindingVersion: number;
  sourceTemplate: ExactSystemTemplateIdentity;
  compiledRulebook: CompiledRulebookIdentity;
  createdAt: Date;
}>;

export const COMPILED_RULEBOOK_EXECUTION_BINDING_VALIDATION_FAILURES = Object.freeze([
  "INVALID_BINDING_ID",
  "INVALID_BINDING_VERSION",
  "INVALID_SOURCE_TEMPLATE",
  "INVALID_SOURCE_TEMPLATE_ID",
  "INVALID_SOURCE_TEMPLATE_VERSION",
  "UNSUPPORTED_TEMPLATE_SCOPE",
  "USER_TEMPLATE_NOT_ELIGIBLE",
  "INVALID_RULEBOOK_ID",
  "INVALID_RULEBOOK_VERSION",
  "INVALID_CREATED_AT",
] as const);
export type CompiledRulebookExecutionBindingValidationFailure =
  (typeof COMPILED_RULEBOOK_EXECUTION_BINDING_VALIDATION_FAILURES)[number];

export type InsertCompiledRulebookExecutionBindingResult =
  | Readonly<{ inserted: true; code: "INSERTED"; binding: CompiledRulebookExecutionBinding }>
  | Readonly<{ inserted: false; code: "ALREADY_EXISTS"; binding: CompiledRulebookExecutionBinding }>
  | Readonly<{ inserted: false; code: "CONFLICT" | "RULEBOOK_NOT_FOUND" | "LINEAGE_MISMATCH" | "PERSISTENCE_ERROR" }>
  | Readonly<{ inserted: false; code: "INVALID_REQUEST"; failure: CompiledRulebookExecutionBindingValidationFailure }>;

export type CompiledRulebookExecutionBindingReadResult =
  | Readonly<{ found: true; binding: CompiledRulebookExecutionBinding }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "INVALID_REQUEST" | "CONFLICT" | "PERSISTENCE_ERROR" }>;

export interface CompiledRulebookExecutionBindingRepositoryPort {
  insert(binding: CompiledRulebookExecutionBinding): Promise<InsertCompiledRulebookExecutionBindingResult>;
  findExactForSourceTemplate(identity: ExactSystemTemplateIdentity): Promise<CompiledRulebookExecutionBindingReadResult>;
}
