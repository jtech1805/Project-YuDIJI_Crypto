import {
  evidenceRepository,
  type EvidenceRepositoryContract,
} from "../repositories/evidence.repository.js";
import {
  evidenceLifecycleResolverService,
  type EvidenceLifecycleResolverService,
} from "./evidence-lifecycle-resolver.service.js";
import {
  DEFAULT_EVIDENCE_HISTORY_LIMIT,
  EvidenceReadQueryError,
  MAX_EVIDENCE_HISTORY_LIMIT,
  MAX_EVIDENCE_RELATIONSHIP_LIMIT,
  type EvidenceHistoryQuery,
  type EvidenceReadResult,
  type NormalizedEvidenceHistoryQuery,
} from "../types/evidence-read.types.js";
import { EVIDENCE_SUBJECT_TYPES } from "../types/evidence.types.js";
import type { EvidenceReadRecord } from "../types/evidence-lifecycle.types.js";

type EvidenceReadRepository = Required<Pick<
  EvidenceRepositoryContract,
  | "findHistory"
  | "countHistory"
  | "findRelationshipsTargeting"
  | "countRelationshipsTargeting"
>>;

type EvidenceLifecycleResolver = Pick<
  EvidenceLifecycleResolverService,
  "resolveAll"
>;

export type EvidenceReadServiceDependencies = {
  repository: EvidenceReadRepository;
  resolver: EvidenceLifecycleResolver;
};

const compareRecords = (
  left: EvidenceReadRecord,
  right: EvidenceReadRecord,
): number =>
  left.observedAt.getTime() - right.observedAt.getTime()
  || (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0);

export class EvidenceReadService {
  private readonly repository: EvidenceReadRepository;
  private readonly resolver: EvidenceLifecycleResolver;

  public constructor(
    dependencies: Partial<EvidenceReadServiceDependencies> = {},
  ) {
    this.repository = dependencies.repository ?? evidenceRepository;
    this.resolver = dependencies.resolver ?? evidenceLifecycleResolverService;
  }

  public async read(query: EvidenceHistoryQuery): Promise<EvidenceReadResult> {
    const normalizedQuery = normalizeQuery(query);
    const historyParams = {
      factorKey: normalizedQuery.factorKey,
      subjectType: normalizedQuery.subjectType,
      subjectKey: normalizedQuery.subjectKey,
      observedAtLte: normalizedQuery.asOf,
    };
    const [baseHistory, historyCount] = await Promise.all([
      this.repository.findHistory({ ...historyParams, limit: normalizedQuery.limit }),
      this.repository.countHistory(historyParams),
    ]);
    const baseIds = [...new Set(baseHistory.map((record) => record.evidenceId))];
    const relationshipParams = {
      evidenceIds: baseIds,
      observedAtLte: normalizedQuery.asOf,
    };
    const [relationships, relationshipCount] = await Promise.all([
      this.repository.findRelationshipsTargeting({
        ...relationshipParams,
        limit: MAX_EVIDENCE_RELATIONSHIP_LIMIT,
      }),
      this.repository.countRelationshipsTargeting(relationshipParams),
    ]);

    const history = mergeHistory(baseHistory, relationships);
    const baseTruncated = historyCount > baseHistory.length;
    const relationshipTruncated = relationshipCount > relationships.length;
    const truncated = baseTruncated || relationshipTruncated;
    if (truncated) {
      return {
        query: normalizedQuery,
        history,
        activeObservations: [],
        resolutions: [],
        diagnostics: [],
        historyCount,
        relationshipCount,
        baseTruncated,
        relationshipTruncated,
        truncated: true,
        complete: false,
      };
    }

    const resolved = this.resolver.resolveAll({
      evidence: history,
      asOf: normalizedQuery.asOf,
    });
    const baseIdSet = new Set(baseIds);
    return {
      query: normalizedQuery,
      history,
      activeObservations: resolved.activeObservations
        .filter((record) => baseIdSet.has(record.evidenceId)),
      resolutions: resolved.resolutions
        .filter((resolution) => baseIdSet.has(resolution.evidenceId)),
      diagnostics: resolved.diagnostics,
      historyCount,
      relationshipCount,
      baseTruncated: false,
      relationshipTruncated: false,
      truncated: false,
      complete: true,
    };
  }
}

const normalizeQuery = (
  query: EvidenceHistoryQuery,
): NormalizedEvidenceHistoryQuery => {
  if (
    typeof query.factorKey !== "string"
    || query.factorKey.length === 0
    || query.factorKey.length > 160
    || query.factorKey.trim() !== query.factorKey
  ) {
    throw new EvidenceReadQueryError("INVALID_FACTOR_KEY", "factorKey is invalid");
  }
  if (
    typeof query.subjectKey !== "string"
    || query.subjectKey.length === 0
    || query.subjectKey.length > 256
    || query.subjectKey.trim() !== query.subjectKey
  ) {
    throw new EvidenceReadQueryError("INVALID_SUBJECT_KEY", "subjectKey is invalid");
  }
  if (!EVIDENCE_SUBJECT_TYPES.includes(query.subjectType)) {
    throw new EvidenceReadQueryError("INVALID_SUBJECT_TYPE", "subjectType is invalid");
  }
  if (!(query.asOf instanceof Date) || !Number.isFinite(query.asOf.getTime())) {
    throw new EvidenceReadQueryError("INVALID_AS_OF", "asOf is invalid");
  }
  const limit = query.limit ?? DEFAULT_EVIDENCE_HISTORY_LIMIT;
  if (
    !Number.isInteger(limit)
    || limit < 1
    || limit > MAX_EVIDENCE_HISTORY_LIMIT
  ) {
    throw new EvidenceReadQueryError("INVALID_LIMIT", "limit is invalid");
  }
  return { ...query, limit };
};

const mergeHistory = (
  baseHistory: readonly EvidenceReadRecord[],
  relationships: readonly EvidenceReadRecord[],
): EvidenceReadRecord[] => {
  const records = new Map<string, EvidenceReadRecord>();
  for (const record of [...baseHistory, ...relationships]) {
    if (!records.has(record.evidenceId)) records.set(record.evidenceId, record);
  }
  return [...records.values()].sort(compareRecords);
};

export const evidenceReadService = new EvidenceReadService();
