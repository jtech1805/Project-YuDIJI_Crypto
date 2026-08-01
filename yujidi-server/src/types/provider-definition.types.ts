import type { FactorKey } from "./factor-registry.types.js";

export type ProviderKey = string;

export const PROVIDER_TYPES = Object.freeze([
  "DIRECT",
  "PROXY",
  "MANUAL",
] as const);
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_AUTHORITY_LEVELS = Object.freeze([
  "PRIMARY_SOURCE",
  "LICENSED_VENDOR",
  "PUBLIC_AGENCY",
  "EXCHANGE",
  "APPROVED_PROXY",
  "MANUAL_REVIEWED",
] as const);
export type ProviderAuthorityLevel =
  (typeof PROVIDER_AUTHORITY_LEVELS)[number];

export const PROVIDER_COST_TIERS = Object.freeze([
  "FREE",
  "PAID",
  "INTERNAL",
  "MANUAL",
] as const);
export type ProviderCostTier = (typeof PROVIDER_COST_TIERS)[number];

export type ProviderDefinition = {
  providerKey: ProviderKey;
  displayName: string;
  providerType: ProviderType;
  authorityLevel: ProviderAuthorityLevel;
  costTier: ProviderCostTier;
  supportedFactorKeys: readonly FactorKey[];
  enabled: boolean;
};

export type FactorProviderBinding = {
  factorKey: FactorKey;
  orderedProviderKeys: readonly ProviderKey[];
};

export type ValidatedProviderCatalog = {
  providers: readonly ProviderDefinition[];
  bindings: readonly FactorProviderBinding[];
};

export const PROVIDER_CATALOG_FAILURE_CODES = Object.freeze([
  "INVALID_REQUEST",
  "INVALID_PROVIDER_DEFINITIONS",
  "INVALID_PROVIDER_DEFINITION",
  "INVALID_PROVIDER_KEY",
  "DUPLICATE_PROVIDER_KEY",
  "INVALID_DISPLAY_NAME",
  "INVALID_PROVIDER_TYPE",
  "INVALID_AUTHORITY_LEVEL",
  "INVALID_COST_TIER",
  "INVALID_SUPPORTED_FACTORS",
  "DUPLICATE_SUPPORTED_FACTOR",
  "INVALID_ENABLED_FLAG",
  "INVALID_FACTOR_BINDINGS",
  "INVALID_FACTOR_BINDING",
  "DUPLICATE_FACTOR_BINDING",
  "EMPTY_PROVIDER_ORDER",
  "DUPLICATE_BOUND_PROVIDER",
  "UNKNOWN_BOUND_PROVIDER",
  "DISABLED_BOUND_PROVIDER",
  "PROVIDER_FACTOR_UNSUPPORTED",
] as const);
export type ProviderCatalogFailureCode =
  (typeof PROVIDER_CATALOG_FAILURE_CODES)[number];

export type ProviderCatalogValidationResult =
  | {
      valid: true;
      catalog: ValidatedProviderCatalog;
    }
  | {
      valid: false;
      code: ProviderCatalogFailureCode;
      providerKey: string | null;
      factorKey: string | null;
    };
