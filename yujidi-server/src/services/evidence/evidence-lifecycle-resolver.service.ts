import type {
  EvidenceLifecycleBatchResolution,
  EvidenceLifecycleDiagnostic,
  EvidenceLifecycleResolution,
  EvidenceLifecycleInputRecord,
} from "../../types/evidence-lifecycle.types.js";
import type {
  CreateEvidenceObservationInput,
  CreateEvidenceRevocationInput,
} from "../../types/evidence.types.js";

type CanonicalHistory = {
  records: Map<string, EvidenceLifecycleInputRecord>;
  observations: CreateEvidenceObservationInput[];
  diagnostics: EvidenceLifecycleDiagnostic[];
  cycleEvidenceIds: Set<string>;
};

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const compareRelationship = (
  left: EvidenceLifecycleInputRecord,
  right: EvidenceLifecycleInputRecord,
): number =>
  left.observedAt.getTime() - right.observedAt.getTime()
  || compareText(left.evidenceId, right.evidenceId);

const compareDiagnostic = (
  left: EvidenceLifecycleDiagnostic,
  right: EvidenceLifecycleDiagnostic,
): number =>
  compareText(left.code, right.code)
  || compareText(left.evidenceId, right.evidenceId)
  || compareText(left.relatedEvidenceId ?? "", right.relatedEvidenceId ?? "");

const diagnosticKey = (diagnostic: EvidenceLifecycleDiagnostic): string =>
  `${diagnostic.code}\u0000${diagnostic.evidenceId}\u0000${diagnostic.relatedEvidenceId ?? ""}`;

const sortAndDedupeDiagnostics = (
  diagnostics: readonly EvidenceLifecycleDiagnostic[],
): EvidenceLifecycleDiagnostic[] => {
  const unique = new Map<string, EvidenceLifecycleDiagnostic>();
  for (const diagnostic of diagnostics) {
    unique.set(diagnosticKey(diagnostic), diagnostic);
  }
  return [...unique.values()].sort(compareDiagnostic);
};

const validateRecord = (record: EvidenceLifecycleInputRecord): void => {
  if (
    typeof record !== "object"
    || record === null
    || typeof record.evidenceId !== "string"
    || record.evidenceId.length === 0
    || !(record.observedAt instanceof Date)
    || !Number.isFinite(record.observedAt.getTime())
    || (record.recordType !== "OBSERVATION" && record.recordType !== "REVOCATION")
  ) {
    throw new TypeError("Invalid Evidence read record");
  }
};

const validateAsOf = (asOf: Date): void => {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) {
    throw new TypeError("asOf must be a valid Date");
  }
};

const buildCanonicalHistory = (
  evidence: readonly EvidenceLifecycleInputRecord[],
): CanonicalHistory => {
  const records = new Map<string, EvidenceLifecycleInputRecord>();
  const diagnostics: EvidenceLifecycleDiagnostic[] = [];

  for (const record of evidence) {
    validateRecord(record);
    if (records.has(record.evidenceId)) {
      diagnostics.push({
        code: "DUPLICATE_EVIDENCE_ID",
        evidenceId: record.evidenceId,
      });
      continue;
    }
    records.set(record.evidenceId, record);
  }

  const observations = [...records.values()]
    .filter((record): record is CreateEvidenceObservationInput =>
      record.recordType === "OBSERVATION");

  const validSupersessionEdges = new Map<string, string>();
  for (const record of records.values()) {
    if (record.recordType === "OBSERVATION" && record.supersedesEvidenceId) {
      if (record.supersedesEvidenceId === record.evidenceId) {
        diagnostics.push({
          code: "SELF_SUPERSESSION",
          evidenceId: record.evidenceId,
          relatedEvidenceId: record.supersedesEvidenceId,
        });
      } else if (!records.has(record.supersedesEvidenceId)) {
        diagnostics.push({
          code: "MISSING_SUPERSEDES_TARGET",
          evidenceId: record.evidenceId,
          relatedEvidenceId: record.supersedesEvidenceId,
        });
      } else {
        validSupersessionEdges.set(record.evidenceId, record.supersedesEvidenceId);
      }
    }

    if (record.recordType === "REVOCATION") {
      if (record.revokesEvidenceId === record.evidenceId) {
        diagnostics.push({
          code: "SELF_REVOCATION",
          evidenceId: record.evidenceId,
          relatedEvidenceId: record.revokesEvidenceId,
        });
      } else if (!records.has(record.revokesEvidenceId)) {
        diagnostics.push({
          code: "MISSING_REVOCATION_TARGET",
          evidenceId: record.evidenceId,
          relatedEvidenceId: record.revokesEvidenceId,
        });
      }
    }
  }

  const cycleEvidenceIds = findCycleEvidenceIds(validSupersessionEdges);
  for (const evidenceId of cycleEvidenceIds) {
    const relatedEvidenceId = validSupersessionEdges.get(evidenceId);
    diagnostics.push({
      code: "SUPERSESSION_CYCLE",
      evidenceId,
      ...(relatedEvidenceId === undefined ? {} : { relatedEvidenceId }),
    });
  }

  return {
    records,
    observations,
    diagnostics: sortAndDedupeDiagnostics(diagnostics),
    cycleEvidenceIds,
  };
};

const findCycleEvidenceIds = (edges: ReadonlyMap<string, string>): Set<string> => {
  const cycles = new Set<string>();
  const fullyVisited = new Set<string>();

  for (const start of [...edges.keys()].sort(compareText)) {
    if (fullyVisited.has(start)) continue;
    const path: string[] = [];
    const pathIndexes = new Map<string, number>();
    let current: string | undefined = start;

    while (current !== undefined && !fullyVisited.has(current)) {
      const cycleStart = pathIndexes.get(current);
      if (cycleStart !== undefined) {
        for (const evidenceId of path.slice(cycleStart)) cycles.add(evidenceId);
        break;
      }
      pathIndexes.set(current, path.length);
      path.push(current);
      current = edges.get(current);
    }
    for (const evidenceId of path) fullyVisited.add(evidenceId);
  }

  return cycles;
};

const diagnosticsFor = (
  evidenceId: string,
  diagnostics: readonly EvidenceLifecycleDiagnostic[],
): EvidenceLifecycleDiagnostic[] =>
  diagnostics.filter((diagnostic) => diagnostic.evidenceId === evidenceId);

const applicableRevoker = (
  evidenceId: string,
  history: CanonicalHistory,
  asOf: Date,
): CreateEvidenceRevocationInput | undefined =>
  [...history.records.values()]
    .filter((record): record is CreateEvidenceRevocationInput =>
      record.recordType === "REVOCATION"
      && record.revokesEvidenceId === evidenceId
      && record.evidenceId !== evidenceId
      && record.observedAt.getTime() <= asOf.getTime())
    .sort(compareRelationship)[0];

const applicableSuperseder = (
  evidenceId: string,
  history: CanonicalHistory,
  asOf: Date,
): CreateEvidenceObservationInput | undefined =>
  history.observations
    .filter((record) =>
      record.supersedesEvidenceId === evidenceId
      && record.evidenceId !== evidenceId
      && !history.cycleEvidenceIds.has(record.evidenceId)
      && record.observedAt.getTime() <= asOf.getTime())
    .sort(compareRelationship)[0];

const resolveObservation = (
  observation: CreateEvidenceObservationInput,
  history: CanonicalHistory,
  asOf: Date,
): EvidenceLifecycleResolution => {
  const diagnostics = diagnosticsFor(observation.evidenceId, history.diagnostics);
  const revoker = applicableRevoker(observation.evidenceId, history, asOf);
  if (revoker) {
    return {
      evidenceId: observation.evidenceId,
      state: "REVOKED",
      revokedByEvidenceId: revoker.evidenceId,
      diagnostics,
    };
  }

  const superseder = applicableSuperseder(observation.evidenceId, history, asOf);
  if (superseder) {
    return {
      evidenceId: observation.evidenceId,
      state: "SUPERSEDED",
      supersededByEvidenceId: superseder.evidenceId,
      diagnostics,
    };
  }

  if (observation.validFrom && asOf.getTime() < observation.validFrom.getTime()) {
    return { evidenceId: observation.evidenceId, state: "NOT_YET_VALID", diagnostics };
  }
  if (observation.validUntil && asOf.getTime() > observation.validUntil.getTime()) {
    return { evidenceId: observation.evidenceId, state: "EXPIRED", diagnostics };
  }
  return { evidenceId: observation.evidenceId, state: "ACTIVE", diagnostics };
};

export class EvidenceLifecycleResolverService {
  public resolveOne(params: {
    evidence: EvidenceLifecycleInputRecord;
    allEvidence: readonly EvidenceLifecycleInputRecord[];
    asOf: Date;
  }): EvidenceLifecycleResolution {
    validateAsOf(params.asOf);
    validateRecord(params.evidence);
    if (params.evidence.recordType !== "OBSERVATION") {
      throw new TypeError("Lifecycle resolutions are available only for observations");
    }
    const history = buildCanonicalHistory(params.allEvidence);
    return resolveObservation(params.evidence, history, params.asOf);
  }

  public resolveAll(params: {
    evidence: readonly EvidenceLifecycleInputRecord[];
    asOf: Date;
  }): EvidenceLifecycleBatchResolution {
    validateAsOf(params.asOf);
    const history = buildCanonicalHistory(params.evidence);
    const resolutions = history.observations
      .map((observation) => resolveObservation(observation, history, params.asOf))
      .sort((left, right) => compareText(left.evidenceId, right.evidenceId));
    const activeIds = new Set(
      resolutions
        .filter((resolution) => resolution.state === "ACTIVE")
        .map((resolution) => resolution.evidenceId),
    );
    const activeObservations = history.observations
      .filter((observation) => activeIds.has(observation.evidenceId))
      .sort(compareRelationship);

    return {
      resolutions,
      activeObservations,
      diagnostics: history.diagnostics,
    };
  }
}

export const evidenceLifecycleResolverService =
  new EvidenceLifecycleResolverService();
