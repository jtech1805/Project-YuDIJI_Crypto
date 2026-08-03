import type { CompiledRulebookDefinition, CompiledRulebookIdentity } from "./compiled-rulebook.types.js";
import type { ResolvedCompilationSpecification } from "./compiled-rulebook-compatibility.types.js";

export type CompiledRulebookCompilerRequest = Readonly<{
  rulebookIdentity: CompiledRulebookIdentity;
  compilerLineage: Readonly<{ compilerId: string; compilerVersion: number; compiledAt: Date }>;
  specification: ResolvedCompilationSpecification;
}>;

export const COMPILED_RULEBOOK_COMPILER_FAILURE_CODES = Object.freeze([
  "INVALID_COMPILER_REQUEST", "INVALID_RULEBOOK_ID", "INVALID_RULEBOOK_VERSION",
  "INVALID_COMPILER_ID", "INVALID_COMPILER_VERSION", "INVALID_COMPILED_AT",
  "INVALID_RESOLVED_SPECIFICATION", "INVALID_TEMPLATE_SNAPSHOT_HASH", "INVALID_COMPILATION_INPUT",
  "COMPILATION_INPUT_CANONICALIZATION_FAILED", "COMPILATION_INPUT_HASH_FAILED",
  "INVALID_SOURCE_RULE_COORDINATE", "BINDING_ID_GENERATION_FAILED", "DUPLICATE_BINDING_ID",
  "INVALID_BINDING_ORDER", "INVALID_COMPILED_BINDING", "OPTIONAL_BEHAVIOR_NOT_REPRESENTABLE",
  "COMPILED_RULEBOOK_CONTRACT_INVALID",
] as const);
export type CompiledRulebookCompilerFailureCode = (typeof COMPILED_RULEBOOK_COMPILER_FAILURE_CODES)[number];
export type CompiledRulebookCompilerResult =
  | Readonly<{ compiled: true; rulebook: CompiledRulebookDefinition }>
  | Readonly<{ compiled: false; code: CompiledRulebookCompilerFailureCode; path: string }>;
