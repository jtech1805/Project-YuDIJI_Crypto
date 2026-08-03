import { DEFAULT_FACTOR_DEFINITIONS } from "./default-factor-definitions.js";
import { StaticFactorRegistry } from "./factor.registry.js";
import { ImmutableHistoricalAuthority } from "./historical-authority.internal.js";
import { FACTOR_KEYS, type FactorKey } from "../types/factor-registry.types.js";
import { VersionedFactorDefinitionRegistryError, type VersionedFactorDefinition, type VersionedFactorDefinitionRegistry } from "../types/versioned-factor-definition.types.js";

export const DEFAULT_VERSIONED_FACTOR_DEFINITIONS: readonly VersionedFactorDefinition[] = Object.freeze(
  DEFAULT_FACTOR_DEFINITIONS.map((definition) => Object.freeze({ definition, compileEligible: definition.status === "ACTIVE" && definition.scoringEligibility === "ELIGIBLE" })),
);
export class StaticVersionedFactorDefinitionRegistry implements VersionedFactorDefinitionRegistry {
  private readonly authority: ImmutableHistoricalAuthority<VersionedFactorDefinition>;
  public constructor(values: readonly VersionedFactorDefinition[]) {
    if (!Array.isArray(values) || !dense(values)) throw new VersionedFactorDefinitionRegistryError("INVALID_COLLECTION");
    const seen = new Set<string>(); const entries = [];
    for (const value of values as readonly unknown[]) {
      if (!record(value) || !record(value.definition) || !FACTOR_KEYS.includes(value.definition.factorKey as FactorKey)
        || !positive(value.definition.version)) throw new VersionedFactorDefinitionRegistryError("INVALID_DEFINITION");
      try { new StaticFactorRegistry([value.definition as never]); } catch { throw new VersionedFactorDefinitionRegistryError("INVALID_DEFINITION"); }
      if (typeof value.compileEligible !== "boolean") throw new VersionedFactorDefinitionRegistryError("INVALID_COMPILE_ELIGIBILITY");
      const key = `${value.definition.factorKey}:${value.definition.version}`;
      if (seen.has(key)) throw new VersionedFactorDefinitionRegistryError("DUPLICATE_VERSION"); seen.add(key);
      entries.push({ id: value.definition.factorKey, version: value.definition.version, value: value as VersionedFactorDefinition });
    }
    this.authority = new ImmutableHistoricalAuthority(entries);
  }
  public getExact(key: FactorKey, version: number) { return validKey(key) && positive(version) ? this.authority.getExact(key, version) : null; }
  public getLatest(key: FactorKey) { return validKey(key) ? this.authority.getLatest(key) : null; }
  public listVersions(key: FactorKey) { return validKey(key) ? this.authority.listVersions(key) : Object.freeze([]); }
}
export const createDefaultVersionedFactorDefinitionRegistry = () => new StaticVersionedFactorDefinitionRegistry(DEFAULT_VERSIONED_FACTOR_DEFINITIONS);
const validKey = (v: unknown): v is FactorKey => typeof v === "string" && FACTOR_KEYS.includes(v as FactorKey);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const dense = (v: readonly unknown[]) => v.every((_, i) => i in v);
