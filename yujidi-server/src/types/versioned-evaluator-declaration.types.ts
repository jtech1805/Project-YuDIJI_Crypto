import type { FactorKey } from "./factor-registry.types.js";
import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";
export type VersionedEvaluatorDeclaration = Readonly<{ evaluatorId: string; evaluatorVersion: number; implementationKey: string; supportedFactorKeys: readonly FactorKey[]; supportedRelationshipTypes: readonly GenericFactorRelationshipType[]; compileEligible: boolean }>;
export interface VersionedEvaluatorDeclarationRegistry { getExact(id: string, version: number): VersionedEvaluatorDeclaration | null; getLatest(id: string): VersionedEvaluatorDeclaration | null; listVersions(id: string): readonly VersionedEvaluatorDeclaration[]; }
export type VersionedEvaluatorDeclarationRegistryErrorCode = "INVALID_COLLECTION" | "INVALID_DECLARATION" | "INVALID_COMPILE_ELIGIBILITY" | "DUPLICATE_VERSION";
export class VersionedEvaluatorDeclarationRegistryError extends Error { public constructor(public readonly code: VersionedEvaluatorDeclarationRegistryErrorCode) { super(`Versioned evaluator-declaration authority failed: ${code}`); this.name = "VersionedEvaluatorDeclarationRegistryError"; } }
