import { randomUUID } from "node:crypto";

import type { EvidenceDocument } from "../../models/evidence.model.js";
import type { EvidenceProviderAdapter } from "../../ports/evidence-provider-adapter.port.js";
import {
  evidenceRepository,
  type EvidenceRepositoryContract,
} from "../../repositories/evidence.repository.js";
import type {
  EvidenceCandidate,
  EvidenceIngestionResult,
} from "../../types/evidence-ingestion.types.js";
import type { CreateEvidenceInput } from "../../types/evidence.types.js";
import {
  evidenceCandidateNormalizer,
  EvidenceCandidateValidationError,
  type EvidenceCandidateNormalizer,
} from "./evidence-candidate-normalizer.service.js";
import {
  evidenceDeduplicationKeyBuilder,
  type EvidenceDeduplicationKeyBuilder,
} from "./evidence-deduplication-key.service.js";

export type EvidenceIngestionDependencies = {
  repository?: EvidenceRepositoryContract;
  normalizer?: EvidenceCandidateNormalizer;
  deduplicationKeyBuilder?: EvidenceDeduplicationKeyBuilder;
  createEvidenceId?: () => string;
};

export class EvidenceIngestionService {
  public constructor(
    private readonly dependencies: EvidenceIngestionDependencies = {},
  ) {}

  public async ingest(candidate: unknown): Promise<EvidenceIngestionResult> {
    let normalized: EvidenceCandidate;
    try {
      normalized = this.normalizer.normalize(candidate);
    } catch (error) {
      if (error instanceof EvidenceCandidateValidationError) {
        return { status: "REJECTED", code: "INVALID_CANDIDATE" };
      }
      throw error;
    }

    const deduplicationKey = this.keyBuilder.build(normalized);
    try {
      const existing = await this.repository.findByDeduplicationKey(deduplicationKey);
      if (existing) {
        return {
          status: "DUPLICATE",
          evidenceId: String(existing.evidenceId),
          deduplicationKey,
        };
      }

      const evidenceId = this.createEvidenceId();
      const input = {
        ...normalized,
        evidenceId,
        deduplicationKey,
      } as CreateEvidenceInput;
      const created = await this.repository.create(input);
      return {
        status: "CREATED",
        evidenceId: String(created.evidenceId),
        deduplicationKey,
      };
    } catch (error) {
      if (isDeduplicationKeyCollision(error)) {
        const duplicate = await this.findDuplicateAfterRace(deduplicationKey);
        if (duplicate) {
          return {
            status: "DUPLICATE",
            evidenceId: String(duplicate.evidenceId),
            deduplicationKey,
          };
        }
      }
      return { status: "FAILED", code: "PERSISTENCE_FAILED", deduplicationKey };
    }
  }

  public async ingestFrom(
    adapter: EvidenceProviderAdapter,
  ): Promise<readonly EvidenceIngestionResult[]> {
    let candidates: readonly EvidenceCandidate[];
    try {
      candidates = await adapter.readCandidates();
    } catch {
      return [{ status: "FAILED", code: "ADAPTER_FAILED" }];
    }
    return Promise.all(candidates.map((candidate) => this.ingest(candidate)));
  }

  private async findDuplicateAfterRace(
    deduplicationKey: string,
  ): Promise<EvidenceDocument | null> {
    try {
      return await this.repository.findByDeduplicationKey(deduplicationKey);
    } catch {
      return null;
    }
  }

  private get repository(): EvidenceRepositoryContract {
    return this.dependencies.repository ?? evidenceRepository;
  }

  private get normalizer(): EvidenceCandidateNormalizer {
    return this.dependencies.normalizer ?? evidenceCandidateNormalizer;
  }

  private get keyBuilder(): EvidenceDeduplicationKeyBuilder {
    return this.dependencies.deduplicationKeyBuilder
      ?? evidenceDeduplicationKeyBuilder;
  }

  private createEvidenceId(): string {
    return (this.dependencies.createEvidenceId ?? randomUUID)();
  }
}

const isDeduplicationKeyCollision = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const duplicate = error as {
    code?: unknown;
    index?: unknown;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
  };
  if (duplicate.code !== 11000) return false;
  return duplicate.index === "deduplicationKey_1"
    || duplicate.keyPattern?.deduplicationKey === 1
    || Object.hasOwn(duplicate.keyValue ?? {}, "deduplicationKey");
};

export const evidenceIngestionService = new EvidenceIngestionService();
