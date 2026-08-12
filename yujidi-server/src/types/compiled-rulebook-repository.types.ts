import type { CompiledRulebookDefinition } from "./compiled-rulebook.types.js";

export const MAX_COMPILED_RULEBOOK_LIST_LIMIT = 100;
export const MAX_COMPILED_RULEBOOK_LIST_SKIP = 10_000;

export type InsertCompiledRulebookResult =
  | Readonly<{ inserted: true; rulebook: CompiledRulebookDefinition }>
  | Readonly<{ inserted: false; code: "DUPLICATE_RULEBOOK" | "RULEBOOK_VERSION_CONFLICT" | "INVALID_RULEBOOK" | "PERSISTENCE_ERROR" }>;

export type CompiledRulebookReadResult =
  | Readonly<{ found: true; rulebook: CompiledRulebookDefinition }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "INVALID_REQUEST" | "PERSISTENCE_ERROR" }>;

export type CompiledRulebookListResult =
  | Readonly<{ listed: true; items: readonly CompiledRulebookDefinition[]; skip: number; limit: number; hasMore: boolean }>
  | Readonly<{ listed: false; code: "INVALID_REQUEST" | "PERSISTENCE_ERROR" }>;

export interface CompiledRulebookRepositoryPort {
  insert(rulebook: CompiledRulebookDefinition): Promise<InsertCompiledRulebookResult>;
  findExact(rulebookId: string, rulebookVersion: number): Promise<CompiledRulebookReadResult>;
  findByTemplateVersion(params: { templateId: string; templateVersion: number; skip: number; limit: number }): Promise<CompiledRulebookListResult>;
  findMostRecentlyCompiledForTemplateVersion(templateId: string, templateVersion: number): Promise<CompiledRulebookReadResult>;
}
