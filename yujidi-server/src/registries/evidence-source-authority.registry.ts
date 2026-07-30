import { FACTOR_KEYS } from "../types/factor-registry.types.js";
import type {
  EvidenceSourceAuthorityRegistry,
  EvidenceSourceAuthorityRule,
} from "../types/evidence-source-resolution.types.js";
import { DEFAULT_EVIDENCE_SOURCE_AUTHORITY_RULES } from "./default-evidence-source-authority.js";

export class EvidenceSourceAuthorityRegistryError extends Error {
  public constructor(public readonly code: "DUPLICATE_RULE" | "INVALID_RULE") {
    super(`Evidence source authority registry failed: ${code}`);
    this.name = "EvidenceSourceAuthorityRegistryError";
  }
}

export class StaticEvidenceSourceAuthorityRegistry
implements EvidenceSourceAuthorityRegistry {
  private readonly rules: readonly EvidenceSourceAuthorityRule[];
  private readonly priorities: ReadonlyMap<string, number>;

  public constructor(rules: readonly EvidenceSourceAuthorityRule[]) {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new EvidenceSourceAuthorityRegistryError("INVALID_RULE");
    }
    const keys = new Set<string>();
    const cloned: EvidenceSourceAuthorityRule[] = [];
    for (const rule of rules as readonly unknown[]) {
      if (!validRule(rule)) {
        throw new EvidenceSourceAuthorityRegistryError("INVALID_RULE");
      }
      const key = ruleKey(rule);
      if (keys.has(key)) {
        throw new EvidenceSourceAuthorityRegistryError("DUPLICATE_RULE");
      }
      keys.add(key);
      cloned.push(Object.freeze({ ...rule }));
    }
    cloned.sort(compareRule);
    this.rules = Object.freeze(cloned);
    this.priorities = new Map(cloned.map((rule) => [ruleKey(rule), rule.priority]));
  }

  public getPriority(params: {
    factorKey: string;
    sourceType: string;
    provider: string;
  }): number | null {
    return this.priorities.get(ruleKey(params)) ?? null;
  }

  public list(): readonly EvidenceSourceAuthorityRule[] {
    return Object.freeze(this.rules.map((rule) => Object.freeze({ ...rule })));
  }
}

const validRule = (value: unknown): value is EvidenceSourceAuthorityRule => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const rule = value as Record<string, unknown>;
  return FACTOR_KEYS.includes(rule.factorKey as never)
    && trimmed(rule.sourceType)
    && trimmed(rule.provider)
    && Number.isInteger(rule.priority)
    && (rule.priority as number) >= 0;
};
const trimmed = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const ruleKey = (rule: { factorKey: string; sourceType: string; provider: string }) =>
  `${rule.factorKey}\0${rule.sourceType}\0${rule.provider}`;
const compareRule = (a: EvidenceSourceAuthorityRule, b: EvidenceSourceAuthorityRule) =>
  compare(a.factorKey, b.factorKey)
  || compare(a.sourceType, b.sourceType)
  || compare(a.provider, b.provider);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export const evidenceSourceAuthorityRegistry =
  new StaticEvidenceSourceAuthorityRegistry(DEFAULT_EVIDENCE_SOURCE_AUTHORITY_RULES);
