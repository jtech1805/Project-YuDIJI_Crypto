import type { EvidenceReadService } from "./evidence-read.service.js";
import type { EvidenceSourceResolutionService } from "./evidence-source-resolution.service.js";
import {
  EVIDENCE_SUBJECT_TYPES,
  EVIDENCE_VALUE_TYPES,
  type CreateEvidenceObservationInput,
  type EvidenceSubjectType,
} from "../types/evidence.types.js";
import { MAX_EVIDENCE_HISTORY_LIMIT } from "../types/evidence-read.types.js";
import type {
  EvidenceSourceResolutionFailureCode,
  EvidenceSourceResolutionSelectedResult,
} from "../types/evidence-source-resolution.types.js";
import type {
  FactorFreshnessPolicy,
  FactorRegistry,
} from "../types/factor-registry.types.js";
import type {
  AssembledFactorInput,
  FactorInputAssemblyFailureCode,
  FactorInputAssemblyRequest,
  FactorInputAssemblyResult,
} from "../types/factor-input-assembly.types.js";

export type FactorInputAssemblyDependencies = {
  evidenceReadService: Pick<EvidenceReadService, "read">;
  sourceResolutionService: Pick<EvidenceSourceResolutionService, "resolve">;
  factorRegistry: Pick<FactorRegistry, "get">;
};

export class FactorInputAssemblyService {
  public constructor(
    private readonly dependencies: FactorInputAssemblyDependencies,
  ) {}

  public async assemble(
    request: FactorInputAssemblyRequest,
  ): Promise<FactorInputAssemblyResult> {
    if (!validRequestShape(request)) {
      return failure(null, null, null, "INVALID_REQUEST");
    }
    if (!validDate(request.asOf)) {
      return failure(request.factorKey, request.subject, null, "INVALID_AS_OF");
    }
    const evaluatedAt = structuredClone(request.asOf);
    if (!EVIDENCE_SUBJECT_TYPES.includes(request.subject.type as EvidenceSubjectType)) {
      return failure(request.factorKey, request.subject, evaluatedAt, "INVALID_REQUEST");
    }

    const definition = this.dependencies.factorRegistry.get(request.factorKey);
    if (!definition) {
      return failure(request.factorKey, request.subject, evaluatedAt, "UNSUPPORTED_FACTOR");
    }

    let readResult: Awaited<ReturnType<EvidenceReadService["read"]>>;
    try {
      readResult = await this.dependencies.evidenceReadService.read({
        factorKey: request.factorKey,
        subjectType: request.subject.type as EvidenceSubjectType,
        subjectKey: request.subject.key,
        asOf: structuredClone(evaluatedAt),
        limit: MAX_EVIDENCE_HISTORY_LIMIT,
      });
    } catch {
      return failure(request.factorKey, request.subject, evaluatedAt, "EVIDENCE_READ_FAILED");
    }

    if (!readResult.complete
      || readResult.baseTruncated
      || readResult.relationshipTruncated) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "INCOMPLETE_EVIDENCE_HISTORY",
      );
    }

    let resolution: ReturnType<EvidenceSourceResolutionService["resolve"]>;
    try {
      resolution = this.dependencies.sourceResolutionService.resolve({
        factorKey: request.factorKey,
        subject: {
          type: request.subject.type,
          key: request.subject.key,
        },
        observations: readResult.activeObservations,
        completeness: {
          complete: readResult.complete,
          baseTruncated: readResult.baseTruncated,
          relationshipTruncated: readResult.relationshipTruncated,
        },
        asOf: structuredClone(evaluatedAt),
        ...(request.allowDeprecatedFactor === undefined
          ? {}
          : { allowDeprecatedFactor: request.allowDeprecatedFactor }),
      });
    } catch {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "SOURCE_RESOLUTION_FAILED",
      );
    }

    if (!resolution.resolved) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        mapResolutionFailure(resolution.code),
        resolution.code,
      );
    }
    if (resolution.factorDefinitionVersion !== definition.version
      || resolution.factorKey !== request.factorKey
      || resolution.subject.type !== request.subject.type
      || resolution.subject.key !== request.subject.key) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "SOURCE_RESOLUTION_FAILED",
      );
    }

    const selectedMatches = readResult.activeObservations.filter(
      (candidate) => candidate.evidenceId === resolution.selectedEvidenceId,
    );
    if (selectedMatches.length === 0) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "SELECTED_EVIDENCE_NOT_FOUND",
      );
    }
    if (selectedMatches.length !== 1) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "INVALID_SELECTED_EVIDENCE",
      );
    }
    const selected = selectedMatches[0]!;
    const selectedFailure = validateSelected(selected, request, resolution);
    if (selectedFailure) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        selectedFailure,
      );
    }
    const validSelected = selected as CreateEvidenceObservationInput;
    if (validSelected.value.type !== "NUMBER") {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        EVIDENCE_VALUE_TYPES.includes(validSelected.value.type)
          ? "UNSUPPORTED_VALUE_TYPE"
          : "INVALID_SELECTED_EVIDENCE",
      );
    }
    if (!Number.isFinite(validSelected.value.numberValue)
      || !trimmed(validSelected.value.unit)) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "INVALID_SELECTED_EVIDENCE",
      );
    }

    const counts = aggregateCounts(resolution);
    if (!counts) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "SOURCE_RESOLUTION_FAILED",
      );
    }
    const freshness = projectFreshness(
      definition.freshness,
      evaluatedAt,
      validSelected.observedAt,
    );
    if (!freshness) {
      return failure(
        request.factorKey,
        request.subject,
        evaluatedAt,
        "SOURCE_RESOLUTION_FAILED",
      );
    }

    const input: AssembledFactorInput = {
      factorKey: resolution.factorKey,
      factorDefinitionVersion: resolution.factorDefinitionVersion,
      subject: Object.freeze({
        type: request.subject.type,
        key: request.subject.key,
      }),
      evidenceId: resolution.selectedEvidenceId,
      value: Object.freeze({
        type: "NUMBER",
        value: validSelected.value.numberValue,
        unit: validSelected.value.unit,
      }),
      source: Object.freeze({ ...resolution.selectedSource }),
      observedAt: structuredClone(validSelected.observedAt),
      evaluatedAt: structuredClone(evaluatedAt),
      confidence: validSelected.confidence ?? null,
      freshness: Object.freeze(freshness),
    };
    return Object.freeze({
      assembled: true,
      input: Object.freeze(input),
      resolution: Object.freeze({
        selectedEvidenceId: resolution.selectedEvidenceId,
        ...counts,
      }),
    });
  }
}

const validRequestShape = (
  request: unknown,
): request is FactorInputAssemblyRequest => record(request)
  && trimmed(request.factorKey)
  && record(request.subject)
  && trimmed(request.subject.type)
  && trimmed(request.subject.key)
  && (request.allowDeprecatedFactor === undefined
    || typeof request.allowDeprecatedFactor === "boolean");

const validateSelected = (
  selected: unknown,
  request: FactorInputAssemblyRequest,
  resolution: EvidenceSourceResolutionSelectedResult,
): FactorInputAssemblyFailureCode | null => {
  if (!record(selected)
    || selected.recordType !== "OBSERVATION"
    || selected.evidenceId !== resolution.selectedEvidenceId
    || selected.factorKey !== request.factorKey
    || !record(selected.subject)
    || selected.subject.type !== request.subject.type
    || selected.subject.key !== request.subject.key
    || !record(selected.value)
    || !validDate(selected.observedAt)
    || !record(selected.provenance)
    || !trimmed(selected.provenance.sourceType)
    || !trimmed(selected.provenance.provider)
    || (selected.provenance.sourceName !== undefined
      && !trimmed(selected.provenance.sourceName))) {
    return "INVALID_SELECTED_EVIDENCE";
  }
  const confidence = selected.confidence ?? null;
  if (confidence !== null
    && (typeof confidence !== "number"
      || !Number.isFinite(confidence)
      || confidence < 0
      || confidence > 1)) {
    return "INVALID_SELECTED_EVIDENCE";
  }
  const sourceId = selected.provenance.sourceName ?? selected.provenance.provider;
  if (!validSelectedSource(resolution)
    || resolution.selectedSource.sourceType !== selected.provenance.sourceType
    || resolution.selectedSource.provider !== selected.provenance.provider
    || resolution.selectedSource.sourceId !== sourceId
    || resolution.selectedObservedAt.getTime() !== selected.observedAt.getTime()
    || resolution.selectedConfidence !== confidence) {
    return "SOURCE_RESOLUTION_FAILED";
  }
  return null;
};

const validSelectedSource = (
  resolution: EvidenceSourceResolutionSelectedResult,
): boolean => trimmed(resolution.selectedSource.sourceType)
  && trimmed(resolution.selectedSource.provider)
  && trimmed(resolution.selectedSource.sourceId)
  && (resolution.selectedSource.priority === null
    || (Number.isInteger(resolution.selectedSource.priority)
      && resolution.selectedSource.priority >= 0))
  && validDate(resolution.selectedObservedAt)
  && (resolution.selectedConfidence === null
    || (typeof resolution.selectedConfidence === "number"
      && Number.isFinite(resolution.selectedConfidence)
      && resolution.selectedConfidence >= 0
      && resolution.selectedConfidence <= 1));

const aggregateCounts = (
  resolution: EvidenceSourceResolutionSelectedResult,
): {
  candidateCount: number;
  compatibleCandidateCount: number;
  incompatibleCandidateCount: number;
} | null => {
  const candidateCount = resolution.trace.length;
  const compatibleCandidateCount = resolution.trace.filter(
    ({ compatibility }) => compatibility.compatible,
  ).length;
  const incompatibleCandidateCount = candidateCount - compatibleCandidateCount;
  const selected = resolution.trace.filter(
    ({ evidenceId, disposition, compatibility }) =>
      evidenceId === resolution.selectedEvidenceId
      && disposition === "SELECTED"
      && compatibility.compatible,
  );
  if (selected.length !== 1
    || compatibleCandidateCount + incompatibleCandidateCount !== candidateCount) {
    return null;
  }
  return { candidateCount, compatibleCandidateCount, incompatibleCandidateCount };
};

const projectFreshness = (
  policy: FactorFreshnessPolicy,
  evaluatedAt: Date,
  observedAt: Date,
): AssembledFactorInput["freshness"] | null => {
  if (policy.kind === "MAX_AGE") {
    const ageMs = evaluatedAt.getTime() - observedAt.getTime();
    if (!Number.isInteger(policy.maxAgeMs)
      || policy.maxAgeMs <= 0
      || ageMs < 0
      || ageMs > policy.maxAgeMs) return null;
    return { status: "FRESH", ageMs, maxAgeMs: policy.maxAgeMs };
  }
  return {
    status: "NOT_APPLICABLE",
    policy: policy.kind,
  };
};

const mapResolutionFailure = (
  code: EvidenceSourceResolutionFailureCode,
): FactorInputAssemblyFailureCode => {
  switch (code) {
    case "INCOMPLETE_EVIDENCE_HISTORY":
      return "INCOMPLETE_EVIDENCE_HISTORY";
    case "UNSUPPORTED_FACTOR":
      return "UNSUPPORTED_FACTOR";
    case "NO_COMPATIBLE_EVIDENCE":
      return "NO_COMPATIBLE_EVIDENCE";
    default:
      return "SOURCE_RESOLUTION_FAILED";
  }
};

const failure = (
  factorKey: string | null,
  subject: { type: string; key: string } | null,
  evaluatedAt: Date | null,
  code: FactorInputAssemblyFailureCode,
  sourceResolutionCode?: EvidenceSourceResolutionFailureCode,
): FactorInputAssemblyResult => Object.freeze({
  assembled: false,
  factorKey,
  subject: subject ? Object.freeze({ ...subject }) : null,
  evaluatedAt: evaluatedAt ? structuredClone(evaluatedAt) : null,
  code,
  ...(sourceResolutionCode ? { sourceResolutionCode } : {}),
});

const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const trimmed = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const validDate = (value: unknown): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());
