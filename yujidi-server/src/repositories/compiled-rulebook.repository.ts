import { isDeepStrictEqual } from "node:util";
import { CompiledRulebookModel } from "../models/compiled-rulebook.model.js";
import { CompiledRulebookContractValidationService } from "../services/compiled-rulebook/compiled-rulebook-contract-validation.service.js";
import type { CompiledRulebookDefinition } from "../types/compiled-rulebook.types.js";
import type { CompiledRulebookListResult, CompiledRulebookReadResult, CompiledRulebookRepositoryPort, InsertCompiledRulebookResult } from "../types/compiled-rulebook-repository.types.js";

type Query<T> = { lean(): { exec(): Promise<T> } };
type ListQuery<T> = { sort(value: Record<string, 1 | -1>): ListQuery<T>; skip(value: number): ListQuery<T>; limit(value: number): Query<T[]> };
export type CompiledRulebookModelPort = {
  create(value: unknown): Promise<unknown>;
  findOne(filter: Record<string, unknown>): Query<Record<string, unknown> | null>;
  find(filter: Record<string, unknown>): ListQuery<Record<string, unknown>>;
};

export class CompiledRulebookRepository implements CompiledRulebookRepositoryPort {
  public constructor(private readonly model: CompiledRulebookModelPort = CompiledRulebookModel as unknown as CompiledRulebookModelPort,
    private readonly validator = new CompiledRulebookContractValidationService()) {}

  public async insert(rulebook: CompiledRulebookDefinition): Promise<InsertCompiledRulebookResult> {
    const validated = this.validator.validate({ rulebook });
    if (!validated.valid) return Object.freeze({ inserted: false, code: "INVALID_RULEBOOK" });
    try {
      const existing = await this.loadExact(rulebook.identity.rulebookId, rulebook.identity.rulebookVersion);
      if (existing) return conflictResult(validated.rulebook, existing);
      await this.model.create(toPersistence(validated.rulebook));
      return Object.freeze({ inserted: true, rulebook: validated.rulebook });
    } catch (error) {
      if (!duplicateKey(error)) return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      try {
        const raced = await this.loadExact(rulebook.identity.rulebookId, rulebook.identity.rulebookVersion);
        return raced ? conflictResult(validated.rulebook, raced) : Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" });
      } catch { return Object.freeze({ inserted: false, code: "PERSISTENCE_ERROR" }); }
    }
  }

  public async findExact(rulebookId: string, rulebookVersion: number): Promise<CompiledRulebookReadResult> {
    try { const value = await this.loadExact(rulebookId, rulebookVersion); return value
      ? Object.freeze({ found: true, rulebook: value }) : Object.freeze({ found: false, code: "NOT_FOUND" });
    } catch { return Object.freeze({ found: false, code: "PERSISTENCE_ERROR" }); }
  }

  public async findByTemplateVersion(params: { templateId: string; templateVersion: number; skip: number; limit: number }): Promise<CompiledRulebookListResult> {
    try {
      const rows = await this.model.find({ "sourceTemplate.templateId": params.templateId, "sourceTemplate.templateVersion": params.templateVersion })
        .sort({ rulebookVersion: 1, rulebookId: 1 }).skip(params.skip).limit(params.limit + 1).lean().exec();
      const items = rows.slice(0, params.limit).map(fromPersistence);
      if (items.some((item) => item === null)) return Object.freeze({ listed: false, code: "PERSISTENCE_ERROR" });
      return Object.freeze({ listed: true, items: Object.freeze(items as CompiledRulebookDefinition[]), skip: params.skip, limit: params.limit, hasMore: rows.length > params.limit });
    } catch { return Object.freeze({ listed: false, code: "PERSISTENCE_ERROR" }); }
  }

  public async findMostRecentlyCompiledForTemplateVersion(templateId: string, templateVersion: number): Promise<CompiledRulebookReadResult> {
    try {
      const rows = await this.model.find({ "sourceTemplate.templateId": templateId, "sourceTemplate.templateVersion": templateVersion })
        .sort({ "compilation.compiledAt": -1, rulebookVersion: -1, rulebookId: -1 }).skip(0).limit(1).lean().exec();
      const rulebook = rows[0] ? fromPersistence(rows[0]) : null;
      return rulebook ? Object.freeze({ found: true, rulebook }) : Object.freeze({ found: false, code: "NOT_FOUND" });
    } catch { return Object.freeze({ found: false, code: "PERSISTENCE_ERROR" }); }
  }

  private async loadExact(id: string, version: number): Promise<CompiledRulebookDefinition | null> {
    const row = await this.model.findOne({ rulebookId: id, rulebookVersion: version }).lean().exec();
    return row ? fromPersistence(row) : null;
  }
}

const conflictResult = (incoming: CompiledRulebookDefinition, existing: CompiledRulebookDefinition): InsertCompiledRulebookResult => Object.freeze({ inserted: false, code: isDeepStrictEqual(incoming, existing) ? "DUPLICATE_RULEBOOK" : "RULEBOOK_VERSION_CONFLICT" });
const duplicateKey = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
const toPersistence = (r: CompiledRulebookDefinition) => ({ rulebookId: r.identity.rulebookId, rulebookVersion: r.identity.rulebookVersion, sourceTemplate: r.source, compilation: r.compilation, factorBindings: r.factorBindings, crossFactorPolicy: r.crossFactorPolicy, decisionPolicy: r.decisionPolicy });
const fromPersistence = (row: Record<string, unknown>): CompiledRulebookDefinition | null => {
  const candidate = { identity: { rulebookId: row.rulebookId, rulebookVersion: row.rulebookVersion }, source: row.sourceTemplate, compilation: row.compilation, factorBindings: row.factorBindings, crossFactorPolicy: row.crossFactorPolicy ?? null, decisionPolicy: row.decisionPolicy ?? null };
  const result = new CompiledRulebookContractValidationService().validate({ rulebook: candidate });
  return result.valid ? result.rulebook : null;
};
