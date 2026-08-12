import { KnowledgeChunkingStrategyRegistry } from "../../registries/knowledge-chunking-strategy.registry.js";
import { KnowledgeChunkRepository } from "../../repositories/knowledge-chunk.repository.js";
import { KnowledgeChunkSetManifestRepository } from "../../repositories/knowledge-chunk-set-manifest.repository.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import type {
  KnowledgeChunkingServiceResult,
  KnowledgeChunkPublicationRequest,
} from "../../types/knowledge-chunking.types.js";
import { KnowledgeChunkSetManifestService } from "./knowledge-chunk-set-manifest.service.js";
import { KnowledgeChunkSetVerificationService } from "./knowledge-chunk-set-verification.service.js";
import { KnowledgeChunkValidationService } from "./knowledge-chunk-validation.service.js";

export class KnowledgeChunkingService {
  public constructor(
    private readonly registry: KnowledgeChunkingStrategyRegistry,
    private readonly validator = new KnowledgeChunkValidationService(),
    private readonly chunkRepository = new KnowledgeChunkRepository(),
    private readonly manifestBuilder = new KnowledgeChunkSetManifestService(),
    private readonly manifestRepository = new KnowledgeChunkSetManifestRepository(),
    private readonly verifier = new KnowledgeChunkSetVerificationService(chunkRepository, manifestRepository),
  ) {}

  public async chunkAndPersist(
    document: PersistedKnowledgeDocument,
    request: KnowledgeChunkPublicationRequest,
  ): Promise<KnowledgeChunkingServiceResult> {
    const strategy = this.registry.getExact(request.strategyId, request.strategyVersion);
    if (!strategy) return Object.freeze({ status: "STRATEGY_NOT_FOUND" });
    if (!strategy.supportedDocumentTypes.includes(document.documentType)) {
      return Object.freeze({ status: "STRATEGY_INCOMPATIBLE" });
    }

    let candidates;
    try {
      candidates = strategy.chunk(document);
    } catch {
      return Object.freeze({ status: "CHUNKING_FAILED" });
    }

    const strategyIdentity = {
      strategyId: request.strategyId,
      strategyVersion: request.strategyVersion,
    };
    const validated = this.validator.validate({
      chunks: candidates,
      documentIdentity: document.identity,
      strategy: strategyIdentity,
    });
    if (!validated.valid) {
      return Object.freeze({ status: "VALIDATION_FAILED", code: validated.code });
    }

    const built = this.manifestBuilder.build({
      identity: request.manifestIdentity,
      documentIdentity: document.identity,
      strategy: strategyIdentity,
      chunks: validated.chunks,
    });
    if (!built.built) {
      return Object.freeze({ status: "MANIFEST_BUILD_FAILED", code: built.code });
    }

    const chunkWrite = await this.chunkRepository.insertSet(validated.chunks);
    if (!chunkWrite.inserted && chunkWrite.code !== "ALREADY_EXISTS") {
      return Object.freeze({ status: chunkWrite.code });
    }

    const stored = await this.chunkRepository.findStoredSetForVerification(
      document.identity,
      strategyIdentity,
    );
    if (!stored.found) {
      return Object.freeze({
        status: "COMPLETENESS_VERIFICATION_FAILED",
        code: stored.code === "NOT_FOUND" ? "CHUNK_MISSING" : stored.code,
      });
    }
    const prePublication = this.verifier.verify(built.manifest, stored.chunks);
    if (!prePublication.verified) {
      return Object.freeze({
        status: "COMPLETENESS_VERIFICATION_FAILED",
        code: prePublication.code,
      });
    }

    const manifestWrite = await this.manifestRepository.insert(built.manifest);
    if (!manifestWrite.inserted && manifestWrite.code !== "ALREADY_EXISTS") {
      return Object.freeze({
        status: manifestWrite.code === "SET_IDENTITY_CONFLICT"
          ? "SET_IDENTITY_CONFLICT"
          : manifestWrite.code === "CONTENT_CONFLICT" || manifestWrite.code === "IDENTITY_CONFLICT"
            ? "CONTENT_CONFLICT"
            : manifestWrite.code,
      });
    }

    const finalRead = await this.verifier.readExactCompleteSet(document.identity, strategyIdentity);
    if (!finalRead.verified) {
      return Object.freeze({
        status: "COMPLETENESS_VERIFICATION_FAILED",
        code: finalRead.code,
      });
    }

    return Object.freeze({
      status: chunkWrite.inserted && manifestWrite.inserted ? "CREATED" : "ALREADY_EXISTS",
      manifest: finalRead.set.manifest,
      chunks: finalRead.set.chunks,
      completenessVerified: true,
    });
  }
}
