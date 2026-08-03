import type { FactorDefinition, FactorKey } from "./factor-registry.types.js";

export type VersionedFactorDefinition = Readonly<{ definition: FactorDefinition; compileEligible: boolean }>;
export interface VersionedFactorDefinitionRegistry {
  getExact(factorKey: FactorKey, factorVersion: number): VersionedFactorDefinition | null;
  getLatest(factorKey: FactorKey): VersionedFactorDefinition | null;
  listVersions(factorKey: FactorKey): readonly VersionedFactorDefinition[];
}
export type VersionedFactorDefinitionRegistryErrorCode = "INVALID_COLLECTION" | "INVALID_DEFINITION" | "INVALID_COMPILE_ELIGIBILITY" | "DUPLICATE_VERSION";
export class VersionedFactorDefinitionRegistryError extends Error {
  public constructor(public readonly code: VersionedFactorDefinitionRegistryErrorCode) { super(`Versioned factor-definition authority failed: ${code}`); this.name = "VersionedFactorDefinitionRegistryError"; }
}
