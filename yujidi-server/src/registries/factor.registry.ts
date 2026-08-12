import { DEFAULT_FACTOR_DEFINITIONS } from "./default-factor-definitions.js";
import {
  EVIDENCE_SUBJECT_TYPES,
  EVIDENCE_VALUE_TYPES,
  type EvidenceSubjectType,
  type EvidenceValueType,
} from "../types/evidence.types.js";
import {
  FACTOR_KEYS,
  FACTOR_SCORING_ELIGIBILITIES,
  FACTOR_STATUSES,
  FACTOR_UNIT_POLICIES,
  FactorRegistryError,
  type FactorDefinition,
  type FactorFreshnessPolicy,
  type FactorRegistry,
  type FactorRegistryValidationResult,
  type FactorUnitDefinition,
} from "../types/factor-registry.types.js";

export class StaticFactorRegistry implements FactorRegistry {
  private readonly definitions: ReadonlyMap<string, FactorDefinition>;

  public constructor(definitions: readonly FactorDefinition[]) {
    if (!Array.isArray(definitions) || definitions.length === 0) {
      throw new FactorRegistryError("EMPTY_REGISTRY");
    }
    const entries: Array<readonly [string, FactorDefinition]> = [];
    const factorKeys = new Set<string>();
    for (const definition of definitions as readonly unknown[]) {
      validateDefinition(definition);
      const typedDefinition = definition as FactorDefinition;
      if (factorKeys.has(typedDefinition.factorKey)) {
        throw new FactorRegistryError("DUPLICATE_FACTOR_KEY");
      }
      factorKeys.add(typedDefinition.factorKey);
      entries.push([
        typedDefinition.factorKey,
        freezeDefinition(cloneDefinition(typedDefinition)),
      ]);
    }
    this.definitions = new Map(entries);
  }

  public get(factorKey: string): FactorDefinition | null {
    const definition = this.definitions.get(factorKey);
    return definition ? freezeDefinition(cloneDefinition(definition)) : null;
  }

  public require(factorKey: string): FactorDefinition {
    const definition = this.get(factorKey);
    if (!definition) throw new FactorRegistryError("UNKNOWN_FACTOR");
    return definition;
  }

  public list(): readonly FactorDefinition[] {
    return Object.freeze(
      [...this.definitions.values()]
        .sort((left, right) => left.factorKey.localeCompare(right.factorKey))
        .map((definition) => freezeDefinition(cloneDefinition(definition))),
    );
  }

  public validateCompatibility(params: {
    factorKey: string;
    valueType: EvidenceValueType;
    subjectType: EvidenceSubjectType;
    unit: string | null;
    allowDeprecated?: boolean;
  }): FactorRegistryValidationResult {
    const definition = this.definitions.get(params.factorKey);
    if (!definition) return invalid("UNKNOWN_FACTOR", params.factorKey);
    if (
      definition.status === "DISABLED"
      || (definition.status === "DEPRECATED" && params.allowDeprecated !== true)
    ) {
      return invalid("INACTIVE_FACTOR", params.factorKey);
    }
    if (!definition.valueTypes.includes(params.valueType)) {
      return invalid("VALUE_TYPE_NOT_ALLOWED", params.factorKey);
    }
    if (!definition.subjectTypes.includes(params.subjectType)) {
      return invalid("SUBJECT_TYPE_NOT_ALLOWED", params.factorKey);
    }
    const unitFailure = validateUnitCompatibility(definition.unit, params.unit);
    if (unitFailure) return invalid(unitFailure, params.factorKey);
    return {
      valid: true,
      definition: freezeDefinition(cloneDefinition(definition)),
    };
  }
}

const invalid = (
  code: Exclude<
    FactorRegistryValidationResult,
    { valid: true }
  >["code"],
  factorKey: string,
): FactorRegistryValidationResult => ({
  valid: false,
  code,
  factorKey,
});

function validateDefinition(
  definition: unknown,
): asserts definition is FactorDefinition {
  if (!isRecord(definition)) {
    throw new FactorRegistryError("INVALID_DEFINITION");
  }
  if (
    !FACTOR_KEYS.includes(definition.factorKey as never)
    || !Number.isInteger(definition.version)
    || (definition.version as number) <= 0
    || !isTrimmedText(definition.displayName)
    || !isTrimmedText(definition.description)
    || !FACTOR_STATUSES.includes(definition.status as never)
    || !FACTOR_SCORING_ELIGIBILITIES.includes(
      definition.scoringEligibility as never,
    )
    || !isUniqueEnumArray(definition.valueTypes, EVIDENCE_VALUE_TYPES)
    || !isUniqueEnumArray(definition.subjectTypes, EVIDENCE_SUBJECT_TYPES)
    || !isValidUnitDefinition(definition.unit)
    || !isValidFreshnessPolicy(definition.freshness)
  ) {
    invalidDefinition();
  }
}

const isValidUnitDefinition = (
  unit: unknown,
): unit is FactorUnitDefinition => {
  if (!isRecord(unit) || !FACTOR_UNIT_POLICIES.includes(unit.policy as never)) {
    return false;
  }
  if (unit.policy !== "ALLOW_LIST") return true;
  return (
    Array.isArray(unit.allowedUnits)
    && unit.allowedUnits.length > 0
    && unit.allowedUnits.every(isTrimmedText)
    && new Set(unit.allowedUnits).size === unit.allowedUnits.length
  );
};

const isValidFreshnessPolicy = (
  freshness: unknown,
): freshness is FactorFreshnessPolicy => {
  if (!isRecord(freshness)) return false;
  if (
    freshness.kind === "VALIDITY_INTERVAL"
    || freshness.kind === "NON_EXPIRING"
  ) {
    return true;
  }
  return (
    freshness.kind === "MAX_AGE"
    && Number.isInteger(freshness.maxAgeMs)
    && (freshness.maxAgeMs as number) > 0
  );
};

const isUniqueEnumArray = (
  value: unknown,
  allowed: readonly string[],
): value is readonly string[] =>
  Array.isArray(value)
  && value.length > 0
  && value.every((entry) => allowed.includes(entry))
  && new Set(value).size === value.length;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTrimmedText = (value: unknown): value is string =>
  typeof value === "string"
  && value.length > 0
  && value.trim() === value;

const invalidDefinition = (): never => {
  throw new FactorRegistryError("INVALID_DEFINITION");
};

const validateUnitCompatibility = (
  unitDefinition: FactorUnitDefinition,
  unit: string | null,
): "UNIT_REQUIRED" | "UNIT_FORBIDDEN" | "UNIT_NOT_ALLOWED" | null => {
  const validUnit = isTrimmedText(unit);
  switch (unitDefinition.policy) {
    case "REQUIRED":
      return validUnit ? null : "UNIT_REQUIRED";
    case "OPTIONAL":
      return unit === null || validUnit ? null : "UNIT_NOT_ALLOWED";
    case "FORBIDDEN":
      return unit === null ? null : "UNIT_FORBIDDEN";
    case "ALLOW_LIST":
      return validUnit && unitDefinition.allowedUnits.includes(unit)
        ? null
        : "UNIT_NOT_ALLOWED";
  }
};

const cloneDefinition = (definition: FactorDefinition): FactorDefinition => ({
  factorKey: definition.factorKey,
  version: definition.version,
  displayName: definition.displayName,
  description: definition.description,
  status: definition.status,
  valueTypes: [...definition.valueTypes],
  subjectTypes: [...definition.subjectTypes],
  unit: definition.unit.policy === "ALLOW_LIST"
    ? {
        policy: "ALLOW_LIST",
        allowedUnits: [...definition.unit.allowedUnits],
      }
    : { policy: definition.unit.policy },
  freshness: definition.freshness.kind === "MAX_AGE"
    ? {
        kind: "MAX_AGE",
        maxAgeMs: definition.freshness.maxAgeMs,
      }
    : { kind: definition.freshness.kind },
  scoringEligibility: definition.scoringEligibility,
});

const freezeDefinition = (definition: FactorDefinition): FactorDefinition => {
  Object.freeze(definition.valueTypes);
  Object.freeze(definition.subjectTypes);
  if (definition.unit.policy === "ALLOW_LIST") {
    Object.freeze(definition.unit.allowedUnits);
  }
  Object.freeze(definition.unit);
  Object.freeze(definition.freshness);
  return Object.freeze(definition);
};

export const factorRegistry = new StaticFactorRegistry(
  DEFAULT_FACTOR_DEFINITIONS,
);
