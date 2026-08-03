import type { CompiledFactorBinding, CompiledRulebookDefinition } from "../types/compiled-rulebook.types.js";
import { MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH } from "../types/compiled-rulebook.types.js";
import type { CanonicalCompilationInput } from "../types/canonical-compilation-input.types.js";
import type { CompiledRulebookCompilerFailureCode, CompiledRulebookCompilerRequest, CompiledRulebookCompilerResult } from "../types/compiled-rulebook-compiler.types.js";
import type { ResolvedTemplateRuleBinding } from "../types/compiled-rulebook-compatibility.types.js";
import { CanonicalCompilationInputService } from "./canonical-compilation-input.service.js";
import { CompiledRulebookContractValidationService } from "./compiled-rulebook-contract-validation.service.js";

const ID = /^[A-Z0-9_]+$/;
const HASH = /^[a-f0-9]{64}$/;

export class DeterministicCompiledRulebookCompilerService {
  public constructor(
    private readonly canonical = new CanonicalCompilationInputService(),
    private readonly validator = new CompiledRulebookContractValidationService(),
  ) {}

  public compile(request: CompiledRulebookCompilerRequest): CompiledRulebookCompilerResult {
    const invalid = validateRequest(request);
    if (invalid) return invalid;
    const specification = request.specification;
    const projection: CanonicalCompilationInput = {
      compiler: { compilerId: request.compilerLineage.compilerId, compilerVersion: request.compilerLineage.compilerVersion },
      sourceTemplate: specification.sourceTemplate,
      bindings: specification.resolvedBindings.map((binding) => ({
        sourceRule: binding.sourceRule, mapping: binding.mapping, factor: binding.factor,
        subjectBinding: binding.subjectBinding, evaluator: binding.evaluator,
        relationshipType: binding.relationshipType, requirement: binding.requirement,
        effectiveWeight: binding.source.effectiveWeight, provider: binding.provider,
        executionPolicies: binding.executionPolicies,
      })),
      crossFactorPolicy: specification.futureCrossFactorPolicy,
      decisionPolicy: specification.futureDecisionPolicy,
    };
    const compilationHash = this.canonical.hash(projection);
    if (!compilationHash.hashed) return failure(compilationHash.code, compilationHash.path);
    const bindings: CompiledFactorBinding[] = [];
    const ids = new Set<string>();
    for (let order = 0; order < specification.resolvedBindings.length; order++) {
      const source = specification.resolvedBindings[order]!;
      const bindingIdResult = this.bindingId(specification.sourceTemplate.templateSnapshotHash, source);
      if (!bindingIdResult.ok) return failure(bindingIdResult.code, `specification.resolvedBindings[${order}].sourceRule`);
      if (ids.has(bindingIdResult.id)) return failure("DUPLICATE_BINDING_ID", `factorBindings[${order}].bindingId`);
      ids.add(bindingIdResult.id);
      bindings.push({
        bindingId: bindingIdResult.id, order, factor: source.factor, subjectBinding: source.subjectBinding,
        evaluator: source.evaluator, relationshipType: source.relationshipType,
        requirementLevel: source.requirement.requirementLevel, optionalBehavior: source.requirement.optionalBehavior,
        weight: source.source.effectiveWeight, provider: source.provider, executionPolicies: source.executionPolicies,
      });
    }
    const candidate: CompiledRulebookDefinition = {
      identity: request.rulebookIdentity,
      source: { templateId: specification.sourceTemplate.templateId, templateVersion: specification.sourceTemplate.templateVersion },
      compilation: { compilerId: request.compilerLineage.compilerId, compilerVersion: request.compilerLineage.compilerVersion,
        compilationInputHash: compilationHash.hash, compiledAt: new Date(request.compilerLineage.compiledAt.getTime()) },
      factorBindings: bindings,
      crossFactorPolicy: specification.futureCrossFactorPolicy,
      decisionPolicy: specification.futureDecisionPolicy,
    };
    const validated = this.validator.validate({ rulebook: candidate });
    return validated.valid
      ? Object.freeze({ compiled: true, rulebook: validated.rulebook })
      : failure("COMPILED_RULEBOOK_CONTRACT_INVALID", validated.path);
  }

  private bindingId(templateSnapshotHash: string, binding: ResolvedTemplateRuleBinding):
  { ok: true; id: string } | { ok: false; code: CompiledRulebookCompilerFailureCode } {
    const result = this.canonical.hash({ templateSnapshotHash, sectionIndex: binding.sourceRule.sectionIndex,
      evaluatorIndex: binding.sourceRule.evaluatorIndex, mappingId: binding.mapping.mappingId, mappingVersion: binding.mapping.mappingVersion });
    if (!result.hashed) return { ok: false, code: "BINDING_ID_GENERATION_FAILED" };
    const id = `BINDING_${result.hash.toUpperCase()}`;
    return ID.test(id) && id.length <= MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH
      ? { ok: true, id } : { ok: false, code: "BINDING_ID_GENERATION_FAILED" };
  }
}

const validateRequest = (r: unknown): CompiledRulebookCompilerResult | null => {
  if (!record(r) || !record(r.rulebookIdentity) || !record(r.compilerLineage) || !record(r.specification)) return failure("INVALID_COMPILER_REQUEST", "request");
  if (!identifier(r.rulebookIdentity.rulebookId)) return failure("INVALID_RULEBOOK_ID", "rulebookIdentity.rulebookId");
  if (!positive(r.rulebookIdentity.rulebookVersion)) return failure("INVALID_RULEBOOK_VERSION", "rulebookIdentity.rulebookVersion");
  if (!identifier(r.compilerLineage.compilerId)) return failure("INVALID_COMPILER_ID", "compilerLineage.compilerId");
  if (!positive(r.compilerLineage.compilerVersion)) return failure("INVALID_COMPILER_VERSION", "compilerLineage.compilerVersion");
  if (!(r.compilerLineage.compiledAt instanceof Date) || !Number.isFinite(r.compilerLineage.compiledAt.getTime())) return failure("INVALID_COMPILED_AT", "compilerLineage.compiledAt");
  const s = r.specification;
  if (!record(s.sourceTemplate) || !Array.isArray(s.resolvedBindings) || s.resolvedBindings.length === 0) return failure("INVALID_RESOLVED_SPECIFICATION", "specification");
  if (typeof s.sourceTemplate.templateSnapshotHash !== "string" || !HASH.test(s.sourceTemplate.templateSnapshotHash)) return failure("INVALID_TEMPLATE_SNAPSHOT_HASH", "specification.sourceTemplate.templateSnapshotHash");
  for (let index = 0; index < s.resolvedBindings.length; index++) {
    const b = s.resolvedBindings[index];
    if (!record(b) || !record(b.sourceRule) || !nonNegative(b.sourceRule.sectionIndex) || !nonNegative(b.sourceRule.evaluatorIndex)
      || typeof b.sourceRule.sectionKey !== "string" || b.sourceRule.sectionKey.length === 0
      || typeof b.sourceRule.evaluatorKey !== "string" || b.sourceRule.evaluatorKey.length === 0) return failure("INVALID_SOURCE_RULE_COORDINATE", `specification.resolvedBindings[${index}].sourceRule`);
    if (!record(b.requirement) || (b.requirement.requirementLevel === "MANDATORY" ? b.requirement.optionalBehavior !== null
      : b.requirement.requirementLevel !== "OPTIONAL" || !["PARTIAL", "OMIT"].includes(b.requirement.optionalBehavior))) return failure("OPTIONAL_BEHAVIOR_NOT_REPRESENTABLE", `specification.resolvedBindings[${index}].requirement`);
  }
  return null;
};
const failure = (code: CompiledRulebookCompilerFailureCode, path: string): CompiledRulebookCompilerResult => Object.freeze({ compiled: false, code, path });
const identifier = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH && v.trim() === v && ID.test(v);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const nonNegative = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
