import { createHash } from "node:crypto";
import type { KnowledgeEmbeddingPort } from "../../src/ports/knowledge-embedding.port.js";
import type { KnowledgeEmbeddingProviderRequest, KnowledgeEmbeddingProviderResult } from "../../src/types/knowledge-embedding.types.js";
import { freezeClone } from "../../src/services/knowledge/knowledge-document-admission.service.js";

export type DeterministicEmbeddingFailureMode =
  | "NONE"
  | "FAILED"
  | "COUNT_MISMATCH"
  | "DIMENSION_MISMATCH"
  | "INVALID_NUMBER"
  | "PROVIDER_MISMATCH"
  | "MODEL_MISMATCH"
  | "DUPLICATE_INPUT";

export class DeterministicKnowledgeEmbeddingPort implements KnowledgeEmbeddingPort {
  public calls = 0;
  public lastRequest: KnowledgeEmbeddingProviderRequest | null = null;

  public constructor(
    private readonly dimension: number,
    private readonly mode: DeterministicEmbeddingFailureMode = "NONE",
  ) {}

  public async embed(request: KnowledgeEmbeddingProviderRequest): Promise<KnowledgeEmbeddingProviderResult> {
    this.calls += 1;
    this.lastRequest = freezeClone(request);
    if (this.mode === "FAILED") return Object.freeze({ status: "FAILED", failureCode: "TEST_PROVIDER_FAILED" });
    let vectors: Array<{ inputId: string; values: readonly number[] }> = request.inputs.map((input) => ({ inputId: input.inputId, values: vector(input.text, this.dimension) }));
    if (this.mode === "COUNT_MISMATCH") vectors = vectors.slice(0, -1);
    if (this.mode === "DIMENSION_MISMATCH" && vectors[0]) vectors[0] = { ...vectors[0], values: vector(request.inputs[0]!.text, this.dimension + 1) };
    if (this.mode === "INVALID_NUMBER" && vectors[0]) vectors[0] = { ...vectors[0], values: [Number.NaN, ...vectors[0].values.slice(1)] };
    if (this.mode === "DUPLICATE_INPUT" && vectors.length > 1) vectors[1] = { inputId: vectors[0]!.inputId, values: vectors[1]!.values };
    return freezeClone({
      status: "COMPLETED" as const,
      providerId: this.mode === "PROVIDER_MISMATCH" ? "OTHER_PROVIDER" : request.providerIdentity.providerId,
      providerVersion: request.providerIdentity.providerVersion,
      modelId: this.mode === "MODEL_MISMATCH" ? "OTHER_MODEL" : request.modelIdentity.modelId,
      modelVersion: request.modelIdentity.modelVersion,
      vectors: [...vectors].reverse(),
      usage: { inputCount: request.inputs.length, totalCharacters: request.inputs.reduce((sum, input) => sum + input.text.length, 0) },
    });
  }
}

const vector = (text: string, dimension: number): readonly number[] => {
  const bytes = createHash("sha256").update(text, "utf8").digest();
  return Object.freeze(Array.from({ length: dimension }, (_, index) => (bytes[index]! - 127.5) / 127.5));
};
