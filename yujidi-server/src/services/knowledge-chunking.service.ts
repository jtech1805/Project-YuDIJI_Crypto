import type { PersistedKnowledgeDocument } from "../types/knowledge-document.types.js";
import type { KnowledgeChunkingServiceResult } from "../types/knowledge-chunking.types.js";
import { KnowledgeChunkingStrategyRegistry } from "../registries/knowledge-chunking-strategy.registry.js";
import { KnowledgeChunkValidationService } from "./knowledge-chunk-validation.service.js";
import { KnowledgeChunkRepository } from "../repositories/knowledge-chunk.repository.js";
export class KnowledgeChunkingService {
  public constructor(private readonly registry: KnowledgeChunkingStrategyRegistry, private readonly validator = new KnowledgeChunkValidationService(), private readonly repository = new KnowledgeChunkRepository()) {}
  public async chunkAndPersist(document: PersistedKnowledgeDocument, strategyIdentity: { strategyId: string; strategyVersion: number }): Promise<KnowledgeChunkingServiceResult> {
    const strategy = this.registry.getExact(strategyIdentity.strategyId, strategyIdentity.strategyVersion); if (!strategy) return Object.freeze({ status: "STRATEGY_NOT_FOUND" }); if (!strategy.supportedDocumentTypes.includes(document.documentType)) return Object.freeze({ status: "STRATEGY_INCOMPATIBLE" });
    let candidates; try { candidates = strategy.chunk(document); } catch { return Object.freeze({ status: "CHUNKING_FAILED" }); }
    const validated = this.validator.validate({ chunks: candidates, documentIdentity: document.identity, strategy: strategyIdentity }); if (!validated.valid) return Object.freeze({ status: "VALIDATION_FAILED", code: validated.code });
    const inserted = await this.repository.insertSet(validated.chunks); if (inserted.inserted) return Object.freeze({ status: "CREATED", chunks: inserted.chunks }); if (inserted.code === "ALREADY_EXISTS" && inserted.chunks) return Object.freeze({ status: "ALREADY_EXISTS", chunks: inserted.chunks }); return Object.freeze({ status: inserted.code === "ALREADY_EXISTS" ? "INVARIANT_VIOLATION" : inserted.code });
  }
}
