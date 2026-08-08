import { ApiError, GoogleGenAI, type ContentEmbedding, type EmbedContentResponse } from "@google/genai";
import type { GeminiEmbeddingAdapterConfig } from "../../config/gemini-embedding.config.js";
import type { KnowledgeEmbeddingPort } from "../../ports/knowledge-embedding.port.js";
import { freezeClone } from "../../services/knowledge-document-admission.service.js";
import type { KnowledgeEmbeddingProviderRequest, KnowledgeEmbeddingProviderResult, KnowledgeEmbeddingPurpose } from "../../types/knowledge-embedding.types.js";
import { GEMINI_EMBEDDING_ADAPTER_VERSION, GEMINI_EMBEDDING_API_VERSION, GEMINI_EMBEDDING_DIMENSION, GEMINI_EMBEDDING_MODEL, GEMINI_EMBEDDING_PROVIDER, GEMINI_EMBEDDING_PROVIDER_VERSION, GEMINI_EMBEDDING_SDK_VERSION, type GeminiEmbeddingDiagnostic, type GeminiEmbeddingFailureCode } from "../../types/gemini-embedding-adapter.types.js";

type GeminiEmbeddingResponse = Pick<EmbedContentResponse, "embeddings" | "metadata"> & Readonly<{ modelVersion?: string; responseId?: string; usageMetadata?: Readonly<{ promptTokenCount?: number; totalTokenCount?: number }> }>;
type GeminiEmbeddingClient = Readonly<{ embed(input: Readonly<{ model: string; contents: readonly string[]; config: Readonly<Record<string, unknown>> }>): Promise<GeminiEmbeddingResponse> }>;
type Sink = Readonly<{ record(value: GeminiEmbeddingDiagnostic): void | Promise<void> }>;
type Clock = Readonly<{ now(): Date }>;
const TRANSIENT = new Set<GeminiEmbeddingFailureCode>(["RATE_LIMITED", "REQUEST_TIMEOUT", "NETWORK_FAILED", "PROVIDER_UNAVAILABLE"]);

/** Development-only Gemini transport adapter. Inputs must be synthetic or approved non-sensitive PLATFORM_KNOWLEDGE. */
export class GeminiKnowledgeEmbeddingAdapter implements KnowledgeEmbeddingPort {
  readonly #client: GeminiEmbeddingClient; readonly #diagnostics: Sink | undefined; readonly #clock: Clock;
  public constructor(private readonly config: GeminiEmbeddingAdapterConfig, dependencies: Readonly<{ client?: GeminiEmbeddingClient; diagnostics?: Sink; clock?: Clock }> = {}) { this.#client = dependencies.client ?? sdkClient(config); this.#diagnostics = dependencies.diagnostics; this.#clock = dependencies.clock ?? { now: () => new Date() }; }
  public async embed(request: KnowledgeEmbeddingProviderRequest): Promise<KnowledgeEmbeddingProviderResult> {
    const validation = validateRequest(request, this.config); if (validation) return this.fail(request, validation, 0, this.#clock.now(), 0);
    const started = this.#clock.now(); const contents = request.inputs.map((item) => item.text); const totalCharacters = contents.reduce((sum, text) => sum + text.length, 0); let attempts = 0; let last: GeminiEmbeddingFailureCode = "UNKNOWN_PROVIDER_FAILURE";
    while (attempts < this.config.maxAttempts && this.#clock.now().getTime() - started.getTime() < this.config.totalDeadlineMs) {
      attempts += 1; const controller = new AbortController(); const timer = setTimeout(() => controller.abort("REQUEST_TIMEOUT"), this.config.requestTimeoutMs);
      try {
        const response = await this.#client.embed({ model: GEMINI_EMBEDDING_MODEL, contents, config: { taskType: taskType(request.purpose), outputDimensionality: GEMINI_EMBEDDING_DIMENSION, abortSignal: controller.signal } }); clearTimeout(timer);
        const failure = responseFailure(response, request.inputs.length); if (failure) return this.fail(request, failure, attempts, started, totalCharacters);
        const reported = response.modelVersion ?? null; if (reported && !sameModel(reported)) return this.fail(request, "MODEL_IDENTITY_MISMATCH", attempts, started, totalCharacters, reported);
        const vectors = response.embeddings!.map((embedding, index) => ({ inputId: request.inputs[index]!.inputId, values: [...embedding.values!] }));
        await this.trace(diag(request, started, this.#clock.now(), attempts, totalCharacters, "COMPLETED", null, reported, usage(response)));
        return freezeClone({ status: "COMPLETED", providerId: GEMINI_EMBEDDING_PROVIDER, providerVersion: GEMINI_EMBEDDING_PROVIDER_VERSION, modelId: GEMINI_EMBEDDING_MODEL, modelVersion: GEMINI_EMBEDDING_MODEL, vectors, usage: { inputCount: request.inputs.length, totalCharacters } });
      } catch (error: unknown) { clearTimeout(timer); last = classify(error, controller.signal); if (!TRANSIENT.has(last) || attempts >= this.config.maxAttempts) break; }
    }
    return this.fail(request, last, attempts, started, totalCharacters);
  }
  private async fail(request: KnowledgeEmbeddingProviderRequest, code: GeminiEmbeddingFailureCode, attempts: number, started: Date, totalCharacters: number, reported: string | null = null): Promise<KnowledgeEmbeddingProviderResult> { await this.trace(diag(request, started, this.#clock.now(), attempts, totalCharacters, "FAILED", code, reported, {})); return Object.freeze({ status: "FAILED", failureCode: code }); }
  private async trace(value: GeminiEmbeddingDiagnostic): Promise<void> { try { await this.#diagnostics?.record(value); } catch { /* metadata-only diagnostics are failure-isolated */ } }
}
const sdkClient = (config: GeminiEmbeddingAdapterConfig): GeminiEmbeddingClient => { const sdk = new GoogleGenAI({ apiKey: config.apiKey(), httpOptions: { apiVersion: GEMINI_EMBEDDING_API_VERSION } }); return { embed: (input) => sdk.models.embedContent(input as Parameters<typeof sdk.models.embedContent>[0]) }; };
const taskType = (purpose: KnowledgeEmbeddingPurpose) => purpose === "RETRIEVAL_DOCUMENT" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY";
const validateRequest = (r: KnowledgeEmbeddingProviderRequest, c: GeminiEmbeddingAdapterConfig): GeminiEmbeddingFailureCode | null => {
  if (!r || !["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"].includes(r.purpose) || r.providerIdentity?.providerId !== GEMINI_EMBEDDING_PROVIDER || r.providerIdentity.providerVersion !== GEMINI_EMBEDDING_PROVIDER_VERSION || r.modelIdentity?.modelId !== GEMINI_EMBEDDING_MODEL || r.modelIdentity.modelVersion !== GEMINI_EMBEDDING_MODEL || r.schemaIdentity?.embeddingSchemaId !== "YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING" || r.schemaIdentity.embeddingSchemaVersion !== 1) return "MODEL_IDENTITY_MISMATCH";
  if (!Array.isArray(r.inputs) || r.inputs.length === 0) return "EMPTY_RESPONSE"; if (r.inputs.length > c.maxBatchSize) return "INPUT_TOO_LARGE";
  const ids = new Set<string>(); let total = 0; for (const input of r.inputs) { if (!input || typeof input.inputId !== "string" || !input.inputId || ids.has(input.inputId) || typeof input.text !== "string" || !input.text.length) return "MALFORMED_VECTOR_RESPONSE"; ids.add(input.inputId); total += input.text.length; if (input.text.length > c.maxCharactersPerInput || total > c.maxCharactersPerBatch) return "INPUT_TOO_LARGE"; }
  return null;
};
const responseFailure = (r: GeminiEmbeddingResponse, count: number): GeminiEmbeddingFailureCode | null => !Array.isArray(r.embeddings) || r.embeddings.length === 0 ? "EMPTY_RESPONSE" : r.embeddings.length !== count ? "VECTOR_COUNT_MISMATCH" : r.embeddings.some((item: ContentEmbedding) => !Array.isArray(item?.values) || item.values.length === 0 || item.values.some((value) => typeof value !== "number")) ? "MALFORMED_VECTOR_RESPONSE" : null;
const classify = (error: unknown, signal: AbortSignal): GeminiEmbeddingFailureCode => { if (signal.aborted) return "REQUEST_TIMEOUT"; if (error instanceof ApiError) { if (error.status === 401) return "AUTHENTICATION_FAILED"; if (error.status === 403) return "PERMISSION_DENIED"; if (error.status === 404) return "MODEL_NOT_FOUND"; if (error.status === 408 || error.status === 504) return "REQUEST_TIMEOUT"; if (error.status === 429) return "RATE_LIMITED"; if (error.status >= 500) return "PROVIDER_UNAVAILABLE"; return "UNKNOWN_PROVIDER_FAILURE"; } return error instanceof TypeError ? "NETWORK_FAILED" : "UNKNOWN_PROVIDER_FAILURE"; };
const sameModel = (reported: string) => reported === GEMINI_EMBEDDING_MODEL || reported === `models/${GEMINI_EMBEDDING_MODEL}` || reported.startsWith(`${GEMINI_EMBEDDING_MODEL}-`);
const usage = (r: GeminiEmbeddingResponse): GeminiEmbeddingDiagnostic["usage"] => freezeClone({ ...(r.usageMetadata?.promptTokenCount !== undefined ? { inputTokens: r.usageMetadata.promptTokenCount } : {}), ...(r.usageMetadata?.totalTokenCount !== undefined ? { totalTokens: r.usageMetadata.totalTokenCount } : {}) });
const diag = (r: KnowledgeEmbeddingProviderRequest, start: Date, end: Date, attempts: number, chars: number, status: "COMPLETED" | "FAILED", failureCode: GeminiEmbeddingFailureCode | null, providerReportedModel: string | null, usageValue: GeminiEmbeddingDiagnostic["usage"]): GeminiEmbeddingDiagnostic => freezeClone({ requestId: r?.requestId ?? "INVALID_REQUEST", schemaId: r?.schemaIdentity?.embeddingSchemaId ?? "INVALID_SCHEMA", schemaVersion: r?.schemaIdentity?.embeddingSchemaVersion ?? 0, providerId: GEMINI_EMBEDDING_PROVIDER, requestedModel: GEMINI_EMBEDDING_MODEL, providerReportedModel, adapterVersion: GEMINI_EMBEDDING_ADAPTER_VERSION, sdkVersion: GEMINI_EMBEDDING_SDK_VERSION, apiVersion: GEMINI_EMBEDDING_API_VERSION, requestedDimension: GEMINI_EMBEDDING_DIMENSION, purpose: r?.purpose ?? "RETRIEVAL_DOCUMENT", inputCount: Array.isArray(r?.inputs) ? r.inputs.length : 0, totalCharacters: chars, attempts, latencyMs: Math.max(0, end.getTime() - start.getTime()), status, failureCode, usage: usageValue });
