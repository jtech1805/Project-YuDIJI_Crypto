import type { FactorKey, FactorRegistry } from "./factor-registry.types.js";
import type { ProviderKey, ValidatedProviderCatalog } from "./provider-definition.types.js";

export const MAX_VERSIONED_PROVIDER_BINDING_IDENTIFIER_LENGTH = 120;
export const MAX_PROVIDERS_PER_VERSIONED_BINDING = 20;

export type VersionedProviderBindingIdentity = Readonly<{
  providerBindingId: string;
  providerBindingVersion: number;
}>;

export type VersionedProviderBindingDefinition = Readonly<{
  providerBindingId: string;
  providerBindingVersion: number;
  factorKey: FactorKey;
  factorVersion: number;
  orderedProviderKeys: readonly ProviderKey[];
  compileEligible: boolean;
}>;

export const VERSIONED_PROVIDER_BINDING_REGISTRY_ERROR_CODES = Object.freeze([
  "INVALID_BINDING_COLLECTION",
  "INVALID_CATALOG",
  "INVALID_BINDING_DEFINITION",
  "INVALID_BINDING_ID",
  "INVALID_BINDING_VERSION",
  "INVALID_FACTOR_KEY",
  "INVALID_FACTOR_VERSION",
  "INVALID_PROVIDER_ORDER",
  "EMPTY_PROVIDER_ORDER",
  "TOO_MANY_PROVIDERS",
  "DUPLICATE_PROVIDER_KEY",
  "UNKNOWN_PROVIDER_KEY",
  "DISABLED_PROVIDER",
  "PROVIDER_FACTOR_UNSUPPORTED",
  "INVALID_COMPILE_ELIGIBILITY",
  "DUPLICATE_BINDING_VERSION",
] as const);
export type VersionedProviderBindingRegistryErrorCode =
  (typeof VERSIONED_PROVIDER_BINDING_REGISTRY_ERROR_CODES)[number];

export class VersionedProviderBindingRegistryError extends Error {
  public readonly code: VersionedProviderBindingRegistryErrorCode;
  public readonly providerBindingId: string | null;
  public readonly providerBindingVersion: number | null;
  public readonly providerKey: string | null;

  public constructor(params: {
    code: VersionedProviderBindingRegistryErrorCode;
    providerBindingId?: string | null;
    providerBindingVersion?: number | null;
    providerKey?: string | null;
  }) {
    super(`Versioned provider-binding registry failed: ${params.code}`);
    this.name = "VersionedProviderBindingRegistryError";
    this.code = params.code;
    this.providerBindingId = params.providerBindingId ?? null;
    this.providerBindingVersion = params.providerBindingVersion ?? null;
    this.providerKey = params.providerKey ?? null;
  }
}

export interface VersionedProviderBindingRegistry {
  getExact(providerBindingId: string, providerBindingVersion: number):
    VersionedProviderBindingDefinition | null;
  getLatest(providerBindingId: string): VersionedProviderBindingDefinition | null;
  listVersions(providerBindingId: string): readonly VersionedProviderBindingDefinition[];
}

export type VersionedProviderBindingRegistryDependencies = Readonly<{
  catalog: ValidatedProviderCatalog;
  factorRegistry: Pick<FactorRegistry, "get">;
}>;
