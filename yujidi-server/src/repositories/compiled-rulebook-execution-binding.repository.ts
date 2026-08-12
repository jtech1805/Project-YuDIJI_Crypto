import { isDeepStrictEqual } from "node:util";

import { CompiledRulebookExecutionBindingModel } from "../models/compiled-rulebook-execution-binding.model.js";
import type {
  CompiledRulebookExecutionBinding,
  CompiledRulebookExecutionBindingReadResult,
  CompiledRulebookExecutionBindingRepositoryPort,
  ExactSystemTemplateIdentity,
  InsertCompiledRulebookExecutionBindingResult,
} from "../types/compiled-rulebook-execution-binding.types.js";

type Query<T> = { lean(): { exec(): Promise<T> } };
type FindQuery<T> = { limit(value: number): Query<T[]> };
export type CompiledRulebookExecutionBindingModelPort = Readonly<{
  create(value: unknown): Promise<unknown>;
  find(filter: Record<string, unknown>): FindQuery<Record<string, unknown>>;
}>;

export class CompiledRulebookExecutionBindingRepository implements CompiledRulebookExecutionBindingRepositoryPort {
  public constructor(
    private readonly model: CompiledRulebookExecutionBindingModelPort = CompiledRulebookExecutionBindingModel as unknown as CompiledRulebookExecutionBindingModelPort,
  ) {}

  public async insert(binding: CompiledRulebookExecutionBinding): Promise<InsertCompiledRulebookExecutionBindingResult> {
    const candidate = cloneAndFreeze(binding);
    try {
      const existing = await this.findConflicting(candidate);
      if (existing) return classifyExisting(candidate, existing);
      await this.model.create(toPersistence(candidate));
      return Object.freeze({ inserted: true, code: "INSERTED", binding: cloneAndFreeze(candidate) });
    } catch (error) {
      if (!duplicateKey(error)) return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      try {
        const raced = await this.findConflicting(candidate);
        return raced ? classifyExisting(candidate, raced) : Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      } catch {
        return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      }
    }
  }

  public async findExactForSourceTemplate(identity: ExactSystemTemplateIdentity): Promise<CompiledRulebookExecutionBindingReadResult> {
    try {
      const matches = await this.findMatches(sourceFilter(identity));
      if (matches.length === 0) return Object.freeze({ found: false, code: "NOT_FOUND" });
      if (matches.length !== 1) return Object.freeze({ found: false, code: "CONFLICT" });
      const binding = fromPersistence(matches[0]);
      return binding
        ? Object.freeze({ found: true, binding })
        : Object.freeze({ found: false, code: "PERSISTENCE_ERROR" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_ERROR" });
    }
  }

  private async findConflicting(binding: CompiledRulebookExecutionBinding): Promise<CompiledRulebookExecutionBinding | "CORRUPTED" | null> {
    const byBinding = await this.findMatches({ bindingId: binding.bindingId, bindingVersion: binding.bindingVersion });
    const bySource = await this.findMatches(sourceFilter(binding.sourceTemplate));
    if (byBinding.length > 1 || bySource.length > 1) return "CORRUPTED";
    const rows = [...byBinding, ...bySource];
    if (rows.length === 0) return null;
    const parsed = rows.map(fromPersistence);
    if (parsed.some((value) => value === null)) return "CORRUPTED";
    const distinct = parsed.filter((value, index) => parsed.findIndex((candidate) => isDeepStrictEqual(candidate, value)) === index);
    return distinct.length === 1 ? distinct[0]! : "CORRUPTED";
  }

  private async findMatches(filter: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.model.find(filter).limit(2).lean().exec();
  }
}

const classifyExisting = (
  candidate: CompiledRulebookExecutionBinding,
  existing: CompiledRulebookExecutionBinding | "CORRUPTED",
): InsertCompiledRulebookExecutionBindingResult => existing !== "CORRUPTED" && isDeepStrictEqual(candidate, existing)
  ? Object.freeze({ inserted: false, code: "ALREADY_EXISTS", binding: cloneAndFreeze(existing) })
  : Object.freeze({ inserted: false, code: "CONFLICT" });

const sourceFilter = (identity: ExactSystemTemplateIdentity): Record<string, unknown> => ({
  "sourceTemplate.templateId": identity.templateId,
  "sourceTemplate.templateVersion": identity.templateVersion,
  "sourceTemplate.scope": identity.scope,
});

const toPersistence = (binding: CompiledRulebookExecutionBinding) => ({
  bindingId: binding.bindingId,
  bindingVersion: binding.bindingVersion,
  sourceTemplate: { ...binding.sourceTemplate },
  compiledRulebook: { ...binding.compiledRulebook },
  createdAt: new Date(binding.createdAt.getTime()),
});

const fromPersistence = (row: Record<string, unknown> | undefined): CompiledRulebookExecutionBinding | null => {
  if (!record(row) || !record(row.sourceTemplate) || !record(row.compiledRulebook) || !(row.createdAt instanceof Date)) return null;
  const candidate = {
    bindingId: row.bindingId,
    bindingVersion: row.bindingVersion,
    sourceTemplate: {
      templateId: row.sourceTemplate.templateId,
      templateVersion: row.sourceTemplate.templateVersion,
      scope: row.sourceTemplate.scope,
    },
    compiledRulebook: {
      rulebookId: row.compiledRulebook.rulebookId,
      rulebookVersion: row.compiledRulebook.rulebookVersion,
    },
    createdAt: row.createdAt,
  };
  return validPersisted(candidate) ? cloneAndFreeze(candidate) : null;
};

const validPersisted = (value: any): value is CompiledRulebookExecutionBinding => identifier(value.bindingId)
  && positive(value.bindingVersion)
  && identifier(value.sourceTemplate.templateId)
  && positive(value.sourceTemplate.templateVersion)
  && value.sourceTemplate.scope === "SYSTEM"
  && identifier(value.compiledRulebook.rulebookId)
  && positive(value.compiledRulebook.rulebookVersion)
  && validDate(value.createdAt);

const cloneAndFreeze = (binding: CompiledRulebookExecutionBinding): CompiledRulebookExecutionBinding => Object.freeze({
  bindingId: binding.bindingId,
  bindingVersion: binding.bindingVersion,
  sourceTemplate: Object.freeze({ ...binding.sourceTemplate }),
  compiledRulebook: Object.freeze({ ...binding.compiledRulebook }),
  createdAt: Object.freeze(new Date(binding.createdAt.getTime())) as Date,
});

const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const duplicateKey = (error: unknown): boolean => record(error) && error.code === 11000;
