import { FACTOR_KEYS } from "../types/factor-registry.types.js";
import { GENERIC_FACTOR_RELATIONSHIP_TYPES, classifyGenericFactorRelationship } from "../types/generic-factor-relationship.types.js";
import { VersionedEvaluatorDeclarationRegistryError, type VersionedEvaluatorDeclaration, type VersionedEvaluatorDeclarationRegistry } from "../types/versioned-evaluator-declaration.types.js";
import { ImmutableHistoricalAuthority } from "./historical-authority.internal.js";
const ID = /^[A-Z0-9_]{1,120}$/;
const genericRelationshipDeclaration: VersionedEvaluatorDeclaration = Object.freeze({ evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, implementationKey: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", supportedFactorKeys: Object.freeze(["CRYPTO.ETF_NET_FLOW"] as const), supportedRelationshipTypes: Object.freeze(["DIRECT", "INVERSE"] as const), compileEligible: true });
export const DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS: readonly VersionedEvaluatorDeclaration[] = Object.freeze([genericRelationshipDeclaration]);
export class StaticVersionedEvaluatorDeclarationRegistry implements VersionedEvaluatorDeclarationRegistry {
  private readonly authority: ImmutableHistoricalAuthority<VersionedEvaluatorDeclaration>;
  public constructor(values: readonly VersionedEvaluatorDeclaration[]) {
    if (!Array.isArray(values) || !dense(values)) throw new VersionedEvaluatorDeclarationRegistryError("INVALID_COLLECTION");
    const seen = new Set<string>(); const entries = [];
    for (const value of values as readonly unknown[]) {
      if (!record(value) || !identifier(value.evaluatorId) || !positive(value.evaluatorVersion) || !identifier(value.implementationKey)
        || !Array.isArray(value.supportedFactorKeys) || value.supportedFactorKeys.length === 0 || !value.supportedFactorKeys.every((v) => FACTOR_KEYS.includes(v))
        || new Set(value.supportedFactorKeys).size !== value.supportedFactorKeys.length
        || !Array.isArray(value.supportedRelationshipTypes) || value.supportedRelationshipTypes.length === 0 || !value.supportedRelationshipTypes.every((v) => GENERIC_FACTOR_RELATIONSHIP_TYPES.includes(v))
        || new Set(value.supportedRelationshipTypes).size !== value.supportedRelationshipTypes.length) throw new VersionedEvaluatorDeclarationRegistryError("INVALID_DECLARATION");
      if (typeof value.compileEligible !== "boolean") throw new VersionedEvaluatorDeclarationRegistryError("INVALID_COMPILE_ELIGIBILITY");
      if (value.compileEligible && value.supportedRelationshipTypes.some((v) => classifyGenericFactorRelationship(v)?.supportState !== "SINGLE_FACTOR_EXECUTABLE")) throw new VersionedEvaluatorDeclarationRegistryError("INVALID_COMPILE_ELIGIBILITY");
      const key = `${value.evaluatorId}:${value.evaluatorVersion}`; if (seen.has(key)) throw new VersionedEvaluatorDeclarationRegistryError("DUPLICATE_VERSION"); seen.add(key);
      entries.push({ id: value.evaluatorId, version: value.evaluatorVersion, value: value as VersionedEvaluatorDeclaration });
    } this.authority = new ImmutableHistoricalAuthority(entries);
  }
  public getExact(id: string, version: number) { return identifier(id) && positive(version) ? this.authority.getExact(id, version) : null; }
  public getLatest(id: string) { return identifier(id) ? this.authority.getLatest(id) : null; }
  public listVersions(id: string) { return identifier(id) ? this.authority.listVersions(id) : Object.freeze([]); }
}
export const createDefaultVersionedEvaluatorDeclarationRegistry = () => new StaticVersionedEvaluatorDeclarationRegistry(DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS);
const identifier = (v: unknown): v is string => typeof v === "string" && ID.test(v);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const dense = (v: readonly unknown[]) => v.every((_, i) => i in v);
