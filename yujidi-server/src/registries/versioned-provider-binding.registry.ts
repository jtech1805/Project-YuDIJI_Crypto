import type { ProviderDefinition } from "../types/provider-definition.types.js";
import {
  MAX_PROVIDERS_PER_VERSIONED_BINDING,
  MAX_VERSIONED_PROVIDER_BINDING_IDENTIFIER_LENGTH,
  VersionedProviderBindingRegistryError,
  type VersionedProviderBindingDefinition,
  type VersionedProviderBindingRegistry,
  type VersionedProviderBindingRegistryDependencies,
} from "../types/versioned-provider-binding.types.js";

const IDENTIFIER_PATTERN = /^[A-Z0-9_]+$/;

export const DEFAULT_VERSIONED_PROVIDER_BINDING_DEFINITIONS:
readonly VersionedProviderBindingDefinition[] = Object.freeze([]);

export class StaticVersionedProviderBindingRegistry
implements VersionedProviderBindingRegistry {
  private readonly definitions: ReadonlyMap<string, VersionedProviderBindingDefinition>;
  private readonly versionsById: ReadonlyMap<string, readonly number[]>;

  public constructor(
    definitions: readonly VersionedProviderBindingDefinition[],
    dependencies: VersionedProviderBindingRegistryDependencies,
  ) {
    if (!Array.isArray(definitions) || !dense(definitions)) throw registryError("INVALID_BINDING_COLLECTION");
    if (!record(dependencies) || !validCatalog(dependencies.catalog)
      || !dependencies.factorRegistry || typeof dependencies.factorRegistry.get !== "function") {
      throw registryError("INVALID_CATALOG");
    }
    const providers = new Map(dependencies.catalog.providers.map((provider) => [provider.providerKey, provider]));
    const snapshots = new Map<string, VersionedProviderBindingDefinition>();
    const versions = new Map<string, number[]>();
    for (const raw of definitions as readonly unknown[]) {
      const definition = validateDefinition(raw, providers, dependencies);
      const key = identityKey(definition.providerBindingId, definition.providerBindingVersion);
      if (snapshots.has(key)) throw registryError("DUPLICATE_BINDING_VERSION", definition.providerBindingId, definition.providerBindingVersion);
      snapshots.set(key, freezeDefinition(cloneDefinition(definition)));
      const registeredVersions = versions.get(definition.providerBindingId) ?? [];
      registeredVersions.push(definition.providerBindingVersion);
      versions.set(definition.providerBindingId, registeredVersions);
    }
    for (const registeredVersions of versions.values()) {
      registeredVersions.sort((left, right) => left - right);
      Object.freeze(registeredVersions);
    }
    this.definitions = snapshots;
    this.versionsById = versions;
  }

  public getExact(providerBindingId: string, providerBindingVersion: number): VersionedProviderBindingDefinition | null {
    if (!identifier(providerBindingId) || !positiveInteger(providerBindingVersion)) return null;
    const definition = this.definitions.get(identityKey(providerBindingId, providerBindingVersion));
    return definition ? freezeDefinition(cloneDefinition(definition)) : null;
  }

  public getLatest(providerBindingId: string): VersionedProviderBindingDefinition | null {
    if (!identifier(providerBindingId)) return null;
    const versions = this.versionsById.get(providerBindingId);
    const latest = versions?.[versions.length - 1];
    return latest === undefined ? null : this.getExact(providerBindingId, latest);
  }

  public listVersions(providerBindingId: string): readonly VersionedProviderBindingDefinition[] {
    if (!identifier(providerBindingId)) return Object.freeze([]);
    return Object.freeze((this.versionsById.get(providerBindingId) ?? [])
      .map((version) => this.getExact(providerBindingId, version)!));
  }
}

export const createDefaultVersionedProviderBindingRegistry = (
  dependencies: VersionedProviderBindingRegistryDependencies,
) => new StaticVersionedProviderBindingRegistry(
  DEFAULT_VERSIONED_PROVIDER_BINDING_DEFINITIONS,
  dependencies,
);

const validateDefinition = (
  raw: unknown,
  providers: ReadonlyMap<string, ProviderDefinition>,
  dependencies: VersionedProviderBindingRegistryDependencies,
): VersionedProviderBindingDefinition => {
  if (!record(raw)) throw registryError("INVALID_BINDING_DEFINITION");
  if (!identifier(raw.providerBindingId)) throw registryError("INVALID_BINDING_ID", safeId(raw), safeVersion(raw));
  if (!positiveInteger(raw.providerBindingVersion)) throw registryError("INVALID_BINDING_VERSION", raw.providerBindingId, safeVersion(raw));
  const factor = dependencies.factorRegistry.get(typeof raw.factorKey === "string" ? raw.factorKey : "");
  if (!factor) throw registryError("INVALID_FACTOR_KEY", raw.providerBindingId, raw.providerBindingVersion);
  if (!positiveInteger(raw.factorVersion) || raw.factorVersion !== factor.version) {
    throw registryError("INVALID_FACTOR_VERSION", raw.providerBindingId, raw.providerBindingVersion);
  }
  if (!Array.isArray(raw.orderedProviderKeys)) throw registryError("INVALID_PROVIDER_ORDER", raw.providerBindingId, raw.providerBindingVersion);
  if (raw.orderedProviderKeys.length === 0) throw registryError("EMPTY_PROVIDER_ORDER", raw.providerBindingId, raw.providerBindingVersion);
  if (raw.orderedProviderKeys.length > MAX_PROVIDERS_PER_VERSIONED_BINDING) throw registryError("TOO_MANY_PROVIDERS", raw.providerBindingId, raw.providerBindingVersion);
  if (!raw.orderedProviderKeys.every(identifier)) throw registryError("INVALID_PROVIDER_ORDER", raw.providerBindingId, raw.providerBindingVersion);
  const duplicate = firstDuplicate(raw.orderedProviderKeys);
  if (duplicate) throw registryError("DUPLICATE_PROVIDER_KEY", raw.providerBindingId, raw.providerBindingVersion, duplicate);
  for (const providerKey of raw.orderedProviderKeys) {
    const provider = providers.get(providerKey);
    if (!provider) throw registryError("UNKNOWN_PROVIDER_KEY", raw.providerBindingId, raw.providerBindingVersion, providerKey);
    if (!provider.enabled) throw registryError("DISABLED_PROVIDER", raw.providerBindingId, raw.providerBindingVersion, providerKey);
    if (!provider.supportedFactorKeys.includes(factor.factorKey)) {
      throw registryError("PROVIDER_FACTOR_UNSUPPORTED", raw.providerBindingId, raw.providerBindingVersion, providerKey);
    }
  }
  if (typeof raw.compileEligible !== "boolean") throw registryError("INVALID_COMPILE_ELIGIBILITY", raw.providerBindingId, raw.providerBindingVersion);
  return raw as unknown as VersionedProviderBindingDefinition;
};

const validCatalog = (catalog: unknown): boolean => record(catalog)
  && Array.isArray(catalog.providers) && Array.isArray(catalog.bindings)
  && catalog.providers.every((provider) => record(provider) && identifier(provider.providerKey)
    && Array.isArray(provider.supportedFactorKeys) && typeof provider.enabled === "boolean");
const cloneDefinition = (definition: VersionedProviderBindingDefinition): VersionedProviderBindingDefinition => ({
  ...definition,
  orderedProviderKeys: [...definition.orderedProviderKeys],
});
const freezeDefinition = (definition: VersionedProviderBindingDefinition): VersionedProviderBindingDefinition => {
  Object.freeze(definition.orderedProviderKeys);
  return Object.freeze(definition);
};
const registryError = (
  code: ConstructorParameters<typeof VersionedProviderBindingRegistryError>[0]["code"],
  providerBindingId: string | null = null,
  providerBindingVersion: number | null = null,
  providerKey: string | null = null,
) => new VersionedProviderBindingRegistryError({ code, providerBindingId, providerBindingVersion, providerKey });
const identityKey = (id: string, version: number) => `${id}:${version}`;
const identifier = (value: unknown): value is string => typeof value === "string"
  && value.length > 0 && value.length <= MAX_VERSIONED_PROVIDER_BINDING_IDENTIFIER_LENGTH
  && value.trim() === value && IDENTIFIER_PATTERN.test(value);
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const firstDuplicate = (values: readonly string[]) => {
  const seen = new Set<string>();
  for (const value of values) { if (seen.has(value)) return value; seen.add(value); }
  return null;
};
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const dense = (values: readonly unknown[]) => values.every((_, index) => index in values);
const safeId = (value: unknown) => record(value) && typeof value.providerBindingId === "string" ? value.providerBindingId : null;
const safeVersion = (value: unknown) => record(value) && typeof value.providerBindingVersion === "number" ? value.providerBindingVersion : null;
