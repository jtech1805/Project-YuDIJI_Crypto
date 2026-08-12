import type { CompiledRulebookReadService } from "./compiled-rulebook-read.service.js";
import type {
  CompiledRulebookExecutionBinding,
  CompiledRulebookExecutionBindingReadResult,
  CompiledRulebookExecutionBindingRepositoryPort,
  CompiledRulebookExecutionBindingValidationFailure,
  ExactSystemTemplateIdentity,
  InsertCompiledRulebookExecutionBindingResult,
} from "../../types/compiled-rulebook-execution-binding.types.js";

type ExactCompiledRulebookReader = Pick<CompiledRulebookReadService, "getExact">;

export class CompiledRulebookExecutionBindingService {
  public constructor(
    private readonly repository: CompiledRulebookExecutionBindingRepositoryPort,
    private readonly rulebookReadService: ExactCompiledRulebookReader,
  ) {}

  public async insert(candidate: unknown): Promise<InsertCompiledRulebookExecutionBindingResult> {
    const validated = validateBinding(candidate);
    if (!validated.valid) return Object.freeze({ inserted: false, code: "INVALID_REQUEST", failure: validated.failure });

    const exactRulebook = await this.rulebookReadService.getExact(
      validated.binding.compiledRulebook.rulebookId,
      validated.binding.compiledRulebook.rulebookVersion,
    );
    if (!exactRulebook.found) return exactRulebook.code === "NOT_FOUND"
      ? Object.freeze({ inserted: false, code: "RULEBOOK_NOT_FOUND" })
      : Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
    if (exactRulebook.rulebook.source.templateId !== validated.binding.sourceTemplate.templateId
      || exactRulebook.rulebook.source.templateVersion !== validated.binding.sourceTemplate.templateVersion) {
      return Object.freeze({ inserted: false, code: "LINEAGE_MISMATCH" });
    }
    return cloneInsertResult(await this.repository.insert(validated.binding));
  }

  public async getExactForSourceTemplate(identity: unknown): Promise<CompiledRulebookExecutionBindingReadResult> {
    const validated = validateSourceIdentity(identity);
    if (!validated.valid) return Object.freeze({ found: false, code: "INVALID_REQUEST" });
    return cloneReadResult(await this.repository.findExactForSourceTemplate(validated.identity));
  }
}

type BindingValidation = Readonly<{ valid: true; binding: CompiledRulebookExecutionBinding }>
  | Readonly<{ valid: false; failure: CompiledRulebookExecutionBindingValidationFailure }>;
type SourceValidation = Readonly<{ valid: true; identity: ExactSystemTemplateIdentity }>
  | Readonly<{ valid: false }>;

const validateBinding = (value: unknown): BindingValidation => {
  if (!record(value) || !identifier(value.bindingId)) return invalid("INVALID_BINDING_ID");
  if (!positive(value.bindingVersion)) return invalid("INVALID_BINDING_VERSION");
  if (!record(value.sourceTemplate)) return invalid("INVALID_SOURCE_TEMPLATE");
  if (!identifier(value.sourceTemplate.templateId)) return invalid("INVALID_SOURCE_TEMPLATE_ID");
  if (!positive(value.sourceTemplate.templateVersion)) return invalid("INVALID_SOURCE_TEMPLATE_VERSION");
  if (value.sourceTemplate.scope === "USER") return invalid("USER_TEMPLATE_NOT_ELIGIBLE");
  if (value.sourceTemplate.scope !== "SYSTEM") return invalid("UNSUPPORTED_TEMPLATE_SCOPE");
  if (!record(value.compiledRulebook) || !identifier(value.compiledRulebook.rulebookId)) return invalid("INVALID_RULEBOOK_ID");
  if (!positive(value.compiledRulebook.rulebookVersion)) return invalid("INVALID_RULEBOOK_VERSION");
  if (!validDate(value.createdAt)) return invalid("INVALID_CREATED_AT");
  return Object.freeze({ valid: true, binding: cloneBinding(value as CompiledRulebookExecutionBinding) });
};

const validateSourceIdentity = (value: unknown): SourceValidation => {
  if (!record(value) || !identifier(value.templateId) || !positive(value.templateVersion) || value.scope !== "SYSTEM") {
    return Object.freeze({ valid: false });
  }
  return Object.freeze({ valid: true, identity: Object.freeze({ templateId: value.templateId, templateVersion: value.templateVersion, scope: "SYSTEM" }) });
};

const cloneInsertResult = (result: InsertCompiledRulebookExecutionBindingResult): InsertCompiledRulebookExecutionBindingResult => (
  result.code === "INSERTED"
    ? Object.freeze({ inserted: true, code: "INSERTED", binding: cloneBinding(result.binding) })
    : result.code === "ALREADY_EXISTS"
      ? Object.freeze({ inserted: false, code: "ALREADY_EXISTS", binding: cloneBinding(result.binding) })
      : Object.freeze({ ...result })
);

const cloneReadResult = (result: CompiledRulebookExecutionBindingReadResult): CompiledRulebookExecutionBindingReadResult => result.found
  ? Object.freeze({ found: true, binding: cloneBinding(result.binding) })
  : Object.freeze({ ...result });

const cloneBinding = (binding: CompiledRulebookExecutionBinding): CompiledRulebookExecutionBinding => Object.freeze({
  bindingId: binding.bindingId,
  bindingVersion: binding.bindingVersion,
  sourceTemplate: Object.freeze({ ...binding.sourceTemplate }),
  compiledRulebook: Object.freeze({ ...binding.compiledRulebook }),
  createdAt: Object.freeze(new Date(binding.createdAt.getTime())) as Date,
});

const invalid = (failure: CompiledRulebookExecutionBindingValidationFailure): BindingValidation => Object.freeze({ valid: false, failure });
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
