import { FACTOR_KEYS, type FactorKey } from "../types/factor-registry.types.js";
import {
  PROVIDER_AUTHORITY_LEVELS,
  PROVIDER_COST_TIERS,
  PROVIDER_TYPES,
  type FactorProviderBinding,
  type ProviderCatalogFailureCode,
  type ProviderCatalogValidationResult,
  type ProviderDefinition,
  type ProviderKey,
  type ValidatedProviderCatalog,
} from "../types/provider-definition.types.js";

const PROVIDER_KEY_PATTERN = /^[A-Z0-9_]+$/;

type InvalidResult = Exclude<ProviderCatalogValidationResult, { valid: true }>;

export class ProviderCatalogService {
  public validate(params: {
    providers: unknown;
    bindings: unknown;
  }): ProviderCatalogValidationResult {
    if (!isRecord(params) || !("providers" in params) || !("bindings" in params)) {
      return invalid("INVALID_REQUEST");
    }
    if (!Array.isArray(params.providers)) {
      return invalid("INVALID_PROVIDER_DEFINITIONS");
    }

    const providers: ProviderDefinition[] = [];
    const providersByKey = new Map<ProviderKey, ProviderDefinition>();
    for (const value of params.providers) {
      if (!isRecord(value)) return invalid("INVALID_PROVIDER_DEFINITION");

      const rawProviderKey = value.providerKey;
      const reportedProviderKey = typeof rawProviderKey === "string"
        ? rawProviderKey
        : null;
      if (!isProviderKey(rawProviderKey)) {
        return invalid("INVALID_PROVIDER_KEY", reportedProviderKey);
      }
      if (providersByKey.has(rawProviderKey)) {
        return invalid("DUPLICATE_PROVIDER_KEY", rawProviderKey);
      }
      if (!isBoundedTrimmedText(value.displayName, 160)) {
        return invalid("INVALID_DISPLAY_NAME", rawProviderKey);
      }
      if (!PROVIDER_TYPES.includes(value.providerType as never)) {
        return invalid("INVALID_PROVIDER_TYPE", rawProviderKey);
      }
      if (!PROVIDER_AUTHORITY_LEVELS.includes(value.authorityLevel as never)) {
        return invalid("INVALID_AUTHORITY_LEVEL", rawProviderKey);
      }
      if (!PROVIDER_COST_TIERS.includes(value.costTier as never)) {
        return invalid("INVALID_COST_TIER", rawProviderKey);
      }
      if (
        !Array.isArray(value.supportedFactorKeys)
        || value.supportedFactorKeys.length === 0
        || !value.supportedFactorKeys.every(isFactorKey)
      ) {
        return invalid("INVALID_SUPPORTED_FACTORS", rawProviderKey);
      }
      const duplicateFactor = firstDuplicate(value.supportedFactorKeys);
      if (duplicateFactor !== null) {
        return invalid(
          "DUPLICATE_SUPPORTED_FACTOR",
          rawProviderKey,
          duplicateFactor,
        );
      }
      if (typeof value.enabled !== "boolean") {
        return invalid("INVALID_ENABLED_FLAG", rawProviderKey);
      }

      const provider = freezeProvider({
        providerKey: rawProviderKey,
        displayName: value.displayName,
        providerType: value.providerType,
        authorityLevel: value.authorityLevel,
        costTier: value.costTier,
        supportedFactorKeys: value.supportedFactorKeys,
        enabled: value.enabled,
      } as ProviderDefinition);
      providers.push(provider);
      providersByKey.set(provider.providerKey, provider);
    }

    if (!Array.isArray(params.bindings)) {
      return invalid("INVALID_FACTOR_BINDINGS");
    }
    const bindings: FactorProviderBinding[] = [];
    const boundFactors = new Set<FactorKey>();
    for (const value of params.bindings) {
      const reportedFactorKey = isRecord(value) && typeof value.factorKey === "string"
        ? value.factorKey
        : null;
      if (!isRecord(value) || !isFactorKey(value.factorKey)) {
        return invalid("INVALID_FACTOR_BINDING", null, reportedFactorKey);
      }
      const factorKey = value.factorKey;
      if (boundFactors.has(factorKey)) {
        return invalid("DUPLICATE_FACTOR_BINDING", null, factorKey);
      }
      boundFactors.add(factorKey);
      if (!Array.isArray(value.orderedProviderKeys)) {
        return invalid("INVALID_FACTOR_BINDING", null, factorKey);
      }
      if (value.orderedProviderKeys.length === 0) {
        return invalid("EMPTY_PROVIDER_ORDER", null, factorKey);
      }
      if (!value.orderedProviderKeys.every(isProviderKey)) {
        const malformed = value.orderedProviderKeys.find(
          (providerKey) => !isProviderKey(providerKey),
        );
        return invalid(
          "INVALID_FACTOR_BINDING",
          typeof malformed === "string" ? malformed : null,
          factorKey,
        );
      }
      const orderedProviderKeys = value.orderedProviderKeys as ProviderKey[];
      const duplicateProvider = firstDuplicate(orderedProviderKeys);
      if (duplicateProvider !== null) {
        return invalid("DUPLICATE_BOUND_PROVIDER", duplicateProvider, factorKey);
      }
      for (const providerKey of orderedProviderKeys) {
        const provider = providersByKey.get(providerKey);
        if (!provider) {
          return invalid("UNKNOWN_BOUND_PROVIDER", providerKey, factorKey);
        }
        if (!provider.enabled) {
          return invalid("DISABLED_BOUND_PROVIDER", providerKey, factorKey);
        }
        if (!provider.supportedFactorKeys.includes(factorKey)) {
          return invalid("PROVIDER_FACTOR_UNSUPPORTED", providerKey, factorKey);
        }
      }
      bindings.push(freezeBinding({ factorKey, orderedProviderKeys }));
    }

    return {
      valid: true,
      catalog: freezeCatalog(providers, bindings),
    };
  }
}

const invalid = (
  code: ProviderCatalogFailureCode,
  providerKey: string | null = null,
  factorKey: string | null = null,
): InvalidResult => ({ valid: false, code, providerKey, factorKey });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProviderKey = (value: unknown): value is ProviderKey =>
  typeof value === "string"
  && value.length >= 1
  && value.length <= 120
  && value.trim() === value
  && PROVIDER_KEY_PATTERN.test(value);

const isBoundedTrimmedText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string"
  && value.length >= 1
  && value.length <= maxLength
  && value.trim() === value;

const isFactorKey = (value: unknown): value is FactorKey =>
  typeof value === "string" && FACTOR_KEYS.includes(value as never);

const firstDuplicate = <T>(values: readonly T[]): T | null => {
  const seen = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
};

const freezeProvider = (provider: ProviderDefinition): ProviderDefinition =>
  Object.freeze({
    ...provider,
    supportedFactorKeys: Object.freeze([...provider.supportedFactorKeys]),
  });

const freezeBinding = (binding: FactorProviderBinding): FactorProviderBinding =>
  Object.freeze({
    factorKey: binding.factorKey,
    orderedProviderKeys: Object.freeze([...binding.orderedProviderKeys]),
  });

const freezeCatalog = (
  providers: readonly ProviderDefinition[],
  bindings: readonly FactorProviderBinding[],
): ValidatedProviderCatalog => Object.freeze({
  providers: Object.freeze([...providers]),
  bindings: Object.freeze([...bindings]),
});
