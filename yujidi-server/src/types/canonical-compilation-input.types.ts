import type { CompiledPolicyLineage } from "./compiled-rulebook.types.js";
import type { ResolvedCompilationSpecification, ResolvedTemplateRuleBinding } from "./compiled-rulebook-compatibility.types.js";

export type CanonicalCompilationBindingInput = Readonly<{
  sourceRule: ResolvedTemplateRuleBinding["sourceRule"];
  mapping: ResolvedTemplateRuleBinding["mapping"];
  factor: ResolvedTemplateRuleBinding["factor"];
  subjectBinding: ResolvedTemplateRuleBinding["subjectBinding"];
  evaluator: ResolvedTemplateRuleBinding["evaluator"];
  relationshipType: ResolvedTemplateRuleBinding["relationshipType"];
  requirement: ResolvedTemplateRuleBinding["requirement"];
  effectiveWeight: number;
  provider: ResolvedTemplateRuleBinding["provider"];
  executionPolicies: ResolvedTemplateRuleBinding["executionPolicies"];
}>;

export type CanonicalCompilationInput = Readonly<{
  compiler: Readonly<{ compilerId: string; compilerVersion: number }>;
  sourceTemplate: ResolvedCompilationSpecification["sourceTemplate"];
  bindings: readonly CanonicalCompilationBindingInput[];
  crossFactorPolicy: CompiledPolicyLineage | null;
  decisionPolicy: CompiledPolicyLineage | null;
}>;

export type CanonicalCompilationHashResult =
  | Readonly<{ hashed: true; canonical: unknown; serialized: string; hash: string }>
  | Readonly<{ hashed: false; code: "COMPILATION_INPUT_CANONICALIZATION_FAILED" | "COMPILATION_INPUT_HASH_FAILED"; path: string }>;
