import {
  EvidenceModel,
  type EvidenceDocument,
} from "../models/evidence.model.js";
import type { CreateEvidenceInput } from "../types/evidence.types.js";

type EvidenceQuery = {
  exec(): Promise<EvidenceDocument | null>;
};

export type EvidenceModelContract = {
  create(input: CreateEvidenceInput): Promise<EvidenceDocument>;
  findOne(filter: Record<string, unknown>): EvidenceQuery;
};

export type EvidenceRepositoryContract = {
  create(input: CreateEvidenceInput): Promise<EvidenceDocument>;
  findByEvidenceId(evidenceId: string): Promise<EvidenceDocument | null>;
  findByDeduplicationKey(deduplicationKey: string): Promise<EvidenceDocument | null>;
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
}

export const evidenceRepository = new EvidenceRepository();
