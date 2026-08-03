import { MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH } from "../types/compiled-rulebook.types.js";
import { MAX_COMPILED_RULEBOOK_LIST_LIMIT, MAX_COMPILED_RULEBOOK_LIST_SKIP, type CompiledRulebookListResult, type CompiledRulebookReadResult, type CompiledRulebookRepositoryPort } from "../types/compiled-rulebook-repository.types.js";
const ID = /^[A-Z0-9_]+$/;
export class CompiledRulebookReadService {
  public constructor(private readonly repository: Pick<CompiledRulebookRepositoryPort, "findExact" | "findByTemplateVersion" | "findMostRecentlyCompiledForTemplateVersion">) {}
  public getExact(id: string, version: number): Promise<CompiledRulebookReadResult> { return identifier(id) && positive(version) ? this.repository.findExact(id, version) : Promise.resolve(Object.freeze({ found: false, code: "INVALID_REQUEST" })); }
  public listForTemplateVersion(params: { templateId: string; templateVersion: number; skip: number; limit: number }): Promise<CompiledRulebookListResult> { return identifier(params?.templateId) && positive(params?.templateVersion) && Number.isSafeInteger(params?.skip) && params.skip >= 0 && params.skip <= MAX_COMPILED_RULEBOOK_LIST_SKIP && Number.isSafeInteger(params?.limit) && params.limit >= 1 && params.limit <= MAX_COMPILED_RULEBOOK_LIST_LIMIT ? this.repository.findByTemplateVersion(params) : Promise.resolve(Object.freeze({ listed: false, code: "INVALID_REQUEST" })); }
  public getMostRecentlyCompiledForTemplateVersion(id: string, version: number): Promise<CompiledRulebookReadResult> { return identifier(id) && positive(version) ? this.repository.findMostRecentlyCompiledForTemplateVersion(id, version) : Promise.resolve(Object.freeze({ found: false, code: "INVALID_REQUEST" })); }
}
const identifier = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH && v.trim() === v && ID.test(v);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
