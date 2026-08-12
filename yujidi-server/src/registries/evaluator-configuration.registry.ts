import {
  GENERIC_RELATIONSHIP_FACTOR_EVALUATOR_ID,
  validateGenericRelationshipConfiguration,
} from "../services/scoring/generic-relationship-factor-evaluator.js";
import {
  EvaluatorConfigurationRegistryError,
  MAX_EVALUATOR_CONFIGURATION_IDENTIFIER_LENGTH,
  MAX_EVALUATOR_CONFIGURATION_SUPPORTED_FACTORS,
  MAX_EVALUATOR_CONFIGURATION_SUPPORTED_RELATIONSHIPS,
  type EvaluatorConfigurationDefinition,
  type EvaluatorConfigurationRegistry,
} from "../types/evaluator-configuration-registry.types.js";
import { FACTOR_KEYS, type FactorKey } from "../types/factor-registry.types.js";
import {
  GENERIC_FACTOR_RELATIONSHIP_TYPES,
  classifyGenericFactorRelationship,
  type GenericFactorRelationshipType,
} from "../types/generic-factor-relationship.types.js";
import type { GenericRelationshipEvaluatorConfiguration } from "../types/generic-relationship-evaluator.types.js";

const IDENTIFIER_PATTERN = /^[A-Z0-9_]+$/;

export const DEFAULT_EVALUATOR_CONFIGURATION_DEFINITIONS:
readonly EvaluatorConfigurationDefinition[] = Object.freeze([]);

export class StaticEvaluatorConfigurationRegistry
implements EvaluatorConfigurationRegistry {
  private readonly definitions: ReadonlyMap<string, EvaluatorConfigurationDefinition>;
  private readonly versionsById: ReadonlyMap<string, readonly number[]>;

  public constructor(definitions: readonly EvaluatorConfigurationDefinition[]) {
    if (!Array.isArray(definitions) || !dense(definitions)) {
      throw error("INVALID_CONFIGURATION_COLLECTION");
    }
    const snapshots = new Map<string, EvaluatorConfigurationDefinition>();
    const versions = new Map<string, number[]>();
    for (const raw of definitions as readonly unknown[]) {
      const definition = validateDefinition(raw);
      const key = identityKey(definition.configurationId, definition.configurationVersion);
      if (snapshots.has(key)) {
        throw error("DUPLICATE_CONFIGURATION_VERSION", definition.configurationId, definition.configurationVersion);
      }
      snapshots.set(key, freezeDefinition(cloneDefinition(definition)));
      const registeredVersions = versions.get(definition.configurationId) ?? [];
      registeredVersions.push(definition.configurationVersion);
      versions.set(definition.configurationId, registeredVersions);
    }
    for (const registeredVersions of versions.values()) {
      registeredVersions.sort((left, right) => left - right);
      Object.freeze(registeredVersions);
    }
    this.definitions = snapshots;
    this.versionsById = versions;
  }

  public getExact(configurationId: string, configurationVersion: number): EvaluatorConfigurationDefinition | null {
    if (!identifier(configurationId) || !positiveInteger(configurationVersion)) return null;
    const definition = this.definitions.get(identityKey(configurationId, configurationVersion));
    return definition ? freezeDefinition(cloneDefinition(definition)) : null;
  }

  public getLatest(configurationId: string): EvaluatorConfigurationDefinition | null {
    if (!identifier(configurationId)) return null;
    const versions = this.versionsById.get(configurationId);
    const latest = versions?.[versions.length - 1];
    return latest === undefined ? null : this.getExact(configurationId, latest);
  }

  public listVersions(configurationId: string): readonly EvaluatorConfigurationDefinition[] {
    if (!identifier(configurationId)) return Object.freeze([]);
    return Object.freeze((this.versionsById.get(configurationId) ?? [])
      .map((version) => this.getExact(configurationId, version)!));
  }
}

export const createDefaultEvaluatorConfigurationRegistry = () =>
  new StaticEvaluatorConfigurationRegistry(DEFAULT_EVALUATOR_CONFIGURATION_DEFINITIONS);

const validateDefinition = (raw: unknown): EvaluatorConfigurationDefinition => {
  if (!record(raw) || raw.configurationType !== "GENERIC_RELATIONSHIP") {
    throw error("INVALID_CONFIGURATION_DEFINITION", safeId(raw), safeVersion(raw));
  }
  if (!identifier(raw.configurationId)) throw error("INVALID_CONFIGURATION_ID", safeId(raw), safeVersion(raw));
  if (!positiveInteger(raw.configurationVersion)) throw error("INVALID_CONFIGURATION_VERSION", raw.configurationId, safeVersion(raw));
  if (raw.evaluatorId !== GENERIC_RELATIONSHIP_FACTOR_EVALUATOR_ID) throw error("INVALID_EVALUATOR_ID", raw.configurationId, raw.configurationVersion);
  if (raw.evaluatorVersion !== 1) throw error("INVALID_EVALUATOR_VERSION", raw.configurationId, raw.configurationVersion);
  if (!Array.isArray(raw.supportedFactorKeys) || raw.supportedFactorKeys.length === 0
    || raw.supportedFactorKeys.length > MAX_EVALUATOR_CONFIGURATION_SUPPORTED_FACTORS
    || !raw.supportedFactorKeys.every((key) => FACTOR_KEYS.includes(key as FactorKey))) {
    throw error("INVALID_SUPPORTED_FACTORS", raw.configurationId, raw.configurationVersion);
  }
  if (new Set(raw.supportedFactorKeys).size !== raw.supportedFactorKeys.length) {
    throw error("DUPLICATE_SUPPORTED_FACTOR", raw.configurationId, raw.configurationVersion);
  }
  if (!Array.isArray(raw.supportedRelationshipTypes) || raw.supportedRelationshipTypes.length === 0
    || raw.supportedRelationshipTypes.length > MAX_EVALUATOR_CONFIGURATION_SUPPORTED_RELATIONSHIPS
    || !raw.supportedRelationshipTypes.every((relationship) => GENERIC_FACTOR_RELATIONSHIP_TYPES.includes(relationship as GenericFactorRelationshipType))) {
    throw error("INVALID_SUPPORTED_RELATIONSHIPS", raw.configurationId, raw.configurationVersion);
  }
  if (new Set(raw.supportedRelationshipTypes).size !== raw.supportedRelationshipTypes.length) {
    throw error("DUPLICATE_SUPPORTED_RELATIONSHIP", raw.configurationId, raw.configurationVersion);
  }
  if (typeof raw.compileEligible !== "boolean") throw error("INVALID_COMPILE_ELIGIBILITY", raw.configurationId, raw.configurationVersion);
  if (!record(raw.configuration)
    || !raw.supportedFactorKeys.includes("CRYPTO.ETF_NET_FLOW")
    || !raw.supportedRelationshipTypes.includes(raw.configuration.relationshipType)) {
    throw error("INVALID_CONFIGURATION_CONTENT", raw.configurationId, raw.configurationVersion);
  }
  if (raw.compileEligible) {
    if (raw.supportedFactorKeys.length !== 1
      || raw.supportedFactorKeys[0] !== "CRYPTO.ETF_NET_FLOW"
      || raw.supportedRelationshipTypes.some((relationship) =>
        classifyGenericFactorRelationship(relationship)?.supportState !== "SINGLE_FACTOR_EXECUTABLE")
      || !validateGenericRelationshipConfiguration(
        raw.configuration as unknown as GenericRelationshipEvaluatorConfiguration,
        "CRYPTO.ETF_NET_FLOW",
      ).valid) {
      throw error("CONFIGURATION_NOT_COMPILE_ELIGIBLE", raw.configurationId, raw.configurationVersion);
    }
  }
  return raw as unknown as EvaluatorConfigurationDefinition;
};

const cloneDefinition = (definition: EvaluatorConfigurationDefinition): EvaluatorConfigurationDefinition => ({
  configurationType: "GENERIC_RELATIONSHIP",
  configurationId: definition.configurationId,
  configurationVersion: definition.configurationVersion,
  evaluatorId: definition.evaluatorId,
  evaluatorVersion: definition.evaluatorVersion,
  supportedFactorKeys: [...definition.supportedFactorKeys],
  supportedRelationshipTypes: [...definition.supportedRelationshipTypes],
  compileEligible: definition.compileEligible,
  configuration: {
    relationshipType: definition.configuration.relationshipType,
    expectedUnit: definition.configuration.expectedUnit,
    thresholds: { ...definition.configuration.thresholds },
    contributions: { ...definition.configuration.contributions },
    minimumPoints: definition.configuration.minimumPoints,
    maximumPoints: definition.configuration.maximumPoints,
  },
});

const freezeDefinition = (definition: EvaluatorConfigurationDefinition): EvaluatorConfigurationDefinition => {
  Object.freeze(definition.supportedFactorKeys);
  Object.freeze(definition.supportedRelationshipTypes);
  Object.freeze(definition.configuration.thresholds);
  Object.freeze(definition.configuration.contributions);
  Object.freeze(definition.configuration);
  return Object.freeze(definition);
};

const error = (
  code: ConstructorParameters<typeof EvaluatorConfigurationRegistryError>[0]["code"],
  configurationId: string | null = null,
  configurationVersion: number | null = null,
) => new EvaluatorConfigurationRegistryError({ code, configurationId, configurationVersion });
const identityKey = (id: string, version: number) => `${id}:${version}`;
const identifier = (value: unknown): value is string => typeof value === "string"
  && value.length > 0 && value.length <= MAX_EVALUATOR_CONFIGURATION_IDENTIFIER_LENGTH
  && value.trim() === value && IDENTIFIER_PATTERN.test(value);
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const dense = (values: readonly unknown[]) => values.every((_, index) => index in values);
const safeId = (value: unknown) => record(value) && typeof value.configurationId === "string" ? value.configurationId : null;
const safeVersion = (value: unknown) => record(value) && typeof value.configurationVersion === "number" ? value.configurationVersion : null;
