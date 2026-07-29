import {
  EvidenceModel,
  type EvidenceDocument,
} from "../models/evidence.model.js";
import type { CreateEvidenceInput } from "../types/evidence.types.js";
import type { EvidenceSubjectType } from "../types/evidence.types.js";
import type { EvidenceReadRecord } from "../types/evidence-lifecycle.types.js";

type EvidenceQuery = {
  exec(): Promise<EvidenceDocument | null>;
};

type EvidenceReadQuery = {
  sort(sort: Record<string, 1 | -1>): EvidenceReadQuery;
  limit(limit: number): EvidenceReadQuery;
  lean(): { exec(): Promise<EvidenceReadRecord[]> };
};

type EvidenceCountQuery = {
  exec(): Promise<number>;
};

export type EvidenceModelContract = {
  create(input: CreateEvidenceInput): Promise<EvidenceDocument>;
  findOne(filter: Record<string, unknown>): EvidenceQuery;
  find?(filter: Record<string, unknown>): EvidenceReadQuery;
  countDocuments?(filter: Record<string, unknown>): EvidenceCountQuery;
};

export type EvidenceHistoryRepositoryParams = {
  factorKey: string;
  subjectType: EvidenceSubjectType;
  subjectKey: string;
  observedAtLte: Date;
};

export type EvidenceRelationshipRepositoryParams = {
  evidenceIds: readonly string[];
  observedAtLte: Date;
};

export type EvidenceRepositoryContract = {
  create(input: CreateEvidenceInput): Promise<EvidenceDocument>;
  findByEvidenceId(evidenceId: string): Promise<EvidenceDocument | null>;
  findByDeduplicationKey(deduplicationKey: string): Promise<EvidenceDocument | null>;
  findHistory?(
    params: EvidenceHistoryRepositoryParams & { limit: number },
  ): Promise<EvidenceReadRecord[]>;
  countHistory?(params: EvidenceHistoryRepositoryParams): Promise<number>;
  findRelationshipsTargeting?(
    params: EvidenceRelationshipRepositoryParams & { limit: number },
  ): Promise<EvidenceReadRecord[]>;
  countRelationshipsTargeting?(
    params: EvidenceRelationshipRepositoryParams,
  ): Promise<number>;
};

export class EvidenceRepository implements EvidenceRepositoryContract {
  public constructor(
    private readonly evidenceModel: EvidenceModelContract =
      EvidenceModel as unknown as EvidenceModelContract,
  ) {}

  public create(input: CreateEvidenceInput): Promise<EvidenceDocument> {
    return this.evidenceModel.create(input);
  }

  public findByEvidenceId(evidenceId: string): Promise<EvidenceDocument | null> {
    return this.evidenceModel.findOne({ evidenceId }).exec();
  }

  public findByDeduplicationKey(
    deduplicationKey: string,
  ): Promise<EvidenceDocument | null> {
    return this.evidenceModel.findOne({ deduplicationKey }).exec();
  }

  public findHistory(
    params: EvidenceHistoryRepositoryParams & { limit: number },
  ): Promise<EvidenceReadRecord[]> {
    return this.evidenceModel
      .find!(historyFilter(params))
      .sort({ observedAt: 1, evidenceId: 1 })
      .limit(params.limit)
      .lean()
      .exec();
  }

  public countHistory(params: EvidenceHistoryRepositoryParams): Promise<number> {
    return this.evidenceModel.countDocuments!(historyFilter(params)).exec();
  }

  public findRelationshipsTargeting(
    params: EvidenceRelationshipRepositoryParams & { limit: number },
  ): Promise<EvidenceReadRecord[]> {
    const evidenceIds = [...new Set(params.evidenceIds)];
    if (evidenceIds.length === 0) return Promise.resolve([]);
    return this.evidenceModel
      .find!(relationshipFilter(evidenceIds, params.observedAtLte))
      .sort({ observedAt: 1, evidenceId: 1 })
      .limit(params.limit)
      .lean()
      .exec();
  }

  public countRelationshipsTargeting(
    params: EvidenceRelationshipRepositoryParams,
  ): Promise<number> {
    const evidenceIds = [...new Set(params.evidenceIds)];
    if (evidenceIds.length === 0) return Promise.resolve(0);
    return this.evidenceModel
      .countDocuments!(relationshipFilter(evidenceIds, params.observedAtLte))
      .exec();
  }
}

const historyFilter = (
  params: EvidenceHistoryRepositoryParams,
): Record<string, unknown> => ({
  factorKey: params.factorKey,
  "subject.type": params.subjectType,
  "subject.key": params.subjectKey,
  observedAt: { $lte: params.observedAtLte },
});

const relationshipFilter = (
  evidenceIds: readonly string[],
  observedAtLte: Date,
): Record<string, unknown> => ({
  observedAt: { $lte: observedAtLte },
  $or: [
    { revokesEvidenceId: { $in: evidenceIds } },
    { supersedesEvidenceId: { $in: evidenceIds } },
  ],
});

export const evidenceRepository = new EvidenceRepository();
