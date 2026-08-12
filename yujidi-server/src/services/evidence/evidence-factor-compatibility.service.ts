import {
  EVIDENCE_SUBJECT_TYPES,
  EVIDENCE_VALUE_TYPES,
  type CreateEvidenceObservationInput,
  type EvidenceSubjectType,
  type EvidenceValueType,
} from "../../types/evidence.types.js";
import type {
  EvidenceFactorCompatibilityFailureCode,
  EvidenceFactorCompatibilityResult,
  EvidenceFreshnessResult,
} from "../../types/evidence-factor-compatibility.types.js";
import type {
  FactorDefinition,
  FactorKey,
  FactorRegistry,
} from "../../types/factor-registry.types.js";

export type EvidenceFactorCompatibilityDependencies = {
  factorRegistry: Pick<FactorRegistry, "get" | "validateCompatibility">;
};

type SafeEvidenceIdentity = {
  evidenceId: string | null;
  factorKey: string | null;
};

type CommonEvidence = SafeEvidenceIdentity & {
  recordType: "OBSERVATION" | "REVOCATION";
  observedAt: Date;
  subjectType: EvidenceSubjectType;
};

type EvaluationObservation = CommonEvidence & {
  recordType: "OBSERVATION";
  evidenceId: string;
  factorKey: string;
  valueType: EvidenceValueType;
  unit: string | null;
  validFrom?: Date;
  validUntil?: Date;
};

export class EvidenceFactorCompatibilityService {
  public constructor(
    private readonly dependencies: EvidenceFactorCompatibilityDependencies,
  ) {}

  public evaluate(params: {
    evidence: unknown;
    asOf: Date;
    allowDeprecatedFactor?: boolean;
  }): EvidenceFactorCompatibilityResult {
    const identity = safeIdentity(params.evidence);
    const common = extractCommonEvidence(params.evidence);
    const evaluatedAt = cloneValidDate(params.asOf);

    if (!common) {
      return incompatible(
        identity,
        "INVALID_EVIDENCE",
        null,
        evaluatedAt,
      );
    }
    if (!evaluatedAt) {
      return incompatible(common, "INVALID_AS_OF", null, null);
    }
    if (common.recordType === "REVOCATION") {
      return incompatible(
        common,
        "REVOCATION_NOT_SUPPORTED",
        null,
        evaluatedAt,
      );
    }

    const observation = extractObservation(params.evidence, common);
    if (!observation) {
      return incompatible(
        common,
        "INVALID_EVIDENCE",
        null,
        evaluatedAt,
      );
    }

    const lookedUpDefinition =
      this.dependencies.factorRegistry.get(observation.factorKey);
    const structural = this.dependencies.factorRegistry.validateCompatibility({
      factorKey: observation.factorKey,
      valueType: observation.valueType,
      subjectType: observation.subjectType,
      unit: observation.unit,
      ...(params.allowDeprecatedFactor === undefined
        ? {}
        : { allowDeprecated: params.allowDeprecatedFactor }),
    });
    if (!structural.valid) {
      return incompatible(
        observation,
        structural.code,
        structural.code === "UNKNOWN_FACTOR"
          ? null
          : safeVersion(lookedUpDefinition),
        evaluatedAt,
      );
    }

    const definition = structural.definition;
    const version = safeVersion(definition);
    if (version === null) {
      return incompatible(
        observation,
        "INVALID_FRESHNESS_POLICY",
        null,
        evaluatedAt,
      );
    }

    const asOfMs = evaluatedAt.getTime();
    if (
      observation.validFrom
      && asOfMs < observation.validFrom.getTime()
    ) {
      return incompatible(
        observation,
        "NOT_YET_VALID",
        version,
        evaluatedAt,
      );
    }
    if (
      observation.validUntil
      && asOfMs > observation.validUntil.getTime()
    ) {
      return incompatible(observation, "EXPIRED", version, evaluatedAt);
    }

    const ageMs = asOfMs - observation.observedAt.getTime();
    if (ageMs < 0) {
      return incompatible(
        observation,
        "OBSERVED_IN_FUTURE",
        version,
        evaluatedAt,
      );
    }

    const freshness = evaluateFreshness(definition, ageMs);
    if (!freshness) {
      return incompatible(
        observation,
        "INVALID_FRESHNESS_POLICY",
        version,
        evaluatedAt,
      );
    }
    if (freshness.status === "STALE") {
      return {
        ...incompatible(
          observation,
          "STALE_EVIDENCE",
          version,
          evaluatedAt,
        ),
        freshness,
      };
    }

    return {
      compatible: true,
      evidenceId: observation.evidenceId,
      factorKey: definition.factorKey as FactorKey,
      factorDefinitionVersion: version,
      scoringEligibility: definition.scoringEligibility,
      evaluatedAt: structuredClone(evaluatedAt),
      freshness,
    };
  }
}

const extractCommonEvidence = (evidence: unknown): CommonEvidence | null => {
  if (!isRecord(evidence)) return null;
  if (
    evidence.recordType !== "OBSERVATION"
    && evidence.recordType !== "REVOCATION"
  ) {
    return null;
  }
  if (
    !isTrimmedText(evidence.evidenceId)
    || !isTrimmedText(evidence.factorKey)
    || !isValidDate(evidence.observedAt)
    || !isRecord(evidence.subject)
    || !EVIDENCE_SUBJECT_TYPES.includes(evidence.subject.type as never)
  ) {
    return null;
  }
  return {
    recordType: evidence.recordType,
    evidenceId: evidence.evidenceId,
    factorKey: evidence.factorKey,
    observedAt: evidence.observedAt,
    subjectType: evidence.subject.type as EvidenceSubjectType,
  };
};

const extractObservation = (
  evidence: unknown,
  common: CommonEvidence,
): EvaluationObservation | null => {
  if (
    common.recordType !== "OBSERVATION"
    || !isRecord(evidence)
    || !isRecord(evidence.value)
    || !EVIDENCE_VALUE_TYPES.includes(evidence.value.type as never)
  ) {
    return null;
  }
  const valueType = evidence.value.type as EvidenceValueType;
  let unit: string | null = null;
  if (valueType === "NUMBER") {
    if (
      evidence.value.unit !== undefined
      && typeof evidence.value.unit !== "string"
    ) {
      return null;
    }
    unit = evidence.value.unit as string | undefined ?? null;
  } else if (evidence.value.unit !== undefined) {
    return null;
  }

  const validFrom = optionalValidDate(evidence.validFrom);
  const validUntil = optionalValidDate(evidence.validUntil);
  if (
    validFrom === false
    || validUntil === false
    || (
      validFrom
      && validUntil
      && validUntil.getTime() < validFrom.getTime()
    )
  ) {
    return null;
  }
  return {
    ...common,
    recordType: "OBSERVATION",
    evidenceId: common.evidenceId as string,
    factorKey: common.factorKey as string,
    valueType,
    unit,
    ...(validFrom ? { validFrom } : {}),
    ...(validUntil ? { validUntil } : {}),
  };
};

const evaluateFreshness = (
  definition: FactorDefinition,
  ageMs: number,
): EvidenceFreshnessResult | null => {
  const freshness = (definition as unknown as {
    freshness?: unknown;
  }).freshness;
  if (!isRecord(freshness)) return null;
  if (freshness.kind === "VALIDITY_INTERVAL") {
    return {
      status: "NOT_APPLICABLE",
      policy: "VALIDITY_INTERVAL",
    };
  }
  if (freshness.kind === "NON_EXPIRING") {
    return {
      status: "NOT_APPLICABLE",
      policy: "NON_EXPIRING",
    };
  }
  if (
    freshness.kind !== "MAX_AGE"
    || !Number.isInteger(freshness.maxAgeMs)
    || (freshness.maxAgeMs as number) <= 0
  ) {
    return null;
  }
  const maxAgeMs = freshness.maxAgeMs as number;
  return ageMs <= maxAgeMs
    ? { status: "FRESH", ageMs, maxAgeMs }
    : { status: "STALE", ageMs, maxAgeMs };
};

const incompatible = (
  identity: SafeEvidenceIdentity,
  code: EvidenceFactorCompatibilityFailureCode,
  factorDefinitionVersion: number | null,
  evaluatedAt: Date | null,
): Extract<EvidenceFactorCompatibilityResult, { compatible: false }> => ({
  compatible: false,
  evidenceId: identity.evidenceId,
  factorKey: identity.factorKey,
  code,
  factorDefinitionVersion,
  evaluatedAt: evaluatedAt ? structuredClone(evaluatedAt) : null,
});

const safeIdentity = (evidence: unknown): SafeEvidenceIdentity => {
  if (!isRecord(evidence)) return { evidenceId: null, factorKey: null };
  return {
    evidenceId: isTrimmedText(evidence.evidenceId)
      ? evidence.evidenceId
      : null,
    factorKey: isTrimmedText(evidence.factorKey)
      ? evidence.factorKey
      : null,
  };
};

const safeVersion = (definition: FactorDefinition | null): number | null =>
  definition
  && Number.isInteger(definition.version)
  && definition.version > 0
    ? definition.version
    : null;

const optionalValidDate = (
  value: unknown,
): Date | undefined | false =>
  value === undefined
    ? undefined
    : isValidDate(value) ? value : false;

const cloneValidDate = (value: unknown): Date | null =>
  isValidDate(value) ? structuredClone(value) : null;

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTrimmedText = (value: unknown): value is string =>
  typeof value === "string"
  && value.length > 0
  && value.trim() === value;
