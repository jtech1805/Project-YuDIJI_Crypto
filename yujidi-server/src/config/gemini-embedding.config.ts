import { GEMINI_EMBEDDING_ADAPTER_VERSION, GEMINI_EMBEDDING_API_VERSION, GEMINI_EMBEDDING_DIMENSION, GEMINI_EMBEDDING_MODEL, GEMINI_EMBEDDING_PROVIDER } from "../types/gemini-embedding-adapter.types.js";

export class GeminiEmbeddingAdapterConfig {
  readonly providerId = GEMINI_EMBEDDING_PROVIDER; readonly adapterVersion = GEMINI_EMBEDDING_ADAPTER_VERSION; readonly apiVersion = GEMINI_EMBEDDING_API_VERSION;
  readonly modelId = GEMINI_EMBEDDING_MODEL; readonly outputDimension = GEMINI_EMBEDDING_DIMENSION;
  readonly requestTimeoutMs: number; readonly totalDeadlineMs: number; readonly maxAttempts: number; readonly maxBatchSize: number; readonly maxCharactersPerInput: number; readonly maxCharactersPerBatch: number;
  readonly #apiKey: string;
  public constructor(input: Readonly<{ apiKey: string; modelId: string; outputDimension: number; apiVersion?: string; requestTimeoutMs: number; totalDeadlineMs: number; maxAttempts: number; maxBatchSize: number; maxCharactersPerInput: number; maxCharactersPerBatch: number }>) {
    if (typeof input.apiKey !== "string" || !input.apiKey.trim()) throw new Error("GEMINI_EMBEDDING_API_KEY_REQUIRED");
    if (input.modelId !== GEMINI_EMBEDDING_MODEL) throw new Error("GEMINI_EMBEDDING_MODEL_NOT_APPROVED");
    if (input.outputDimension !== GEMINI_EMBEDDING_DIMENSION) throw new Error("GEMINI_EMBEDDING_DIMENSION_NOT_APPROVED");
    if ((input.apiVersion ?? GEMINI_EMBEDDING_API_VERSION) !== GEMINI_EMBEDDING_API_VERSION) throw new Error("GEMINI_EMBEDDING_API_VERSION_NOT_APPROVED");
    if (!integer(input.requestTimeoutMs, 100, 120_000) || !integer(input.totalDeadlineMs, input.requestTimeoutMs, 240_000) || !integer(input.maxAttempts, 1, 2)
      || !integer(input.maxBatchSize, 1, 100) || !integer(input.maxCharactersPerInput, 1, 100_000) || !integer(input.maxCharactersPerBatch, input.maxCharactersPerInput, 500_000)) throw new Error("INVALID_GEMINI_EMBEDDING_CONFIG");
    this.#apiKey = input.apiKey.trim(); this.requestTimeoutMs = input.requestTimeoutMs; this.totalDeadlineMs = input.totalDeadlineMs; this.maxAttempts = input.maxAttempts; this.maxBatchSize = input.maxBatchSize; this.maxCharactersPerInput = input.maxCharactersPerInput; this.maxCharactersPerBatch = input.maxCharactersPerBatch; Object.freeze(this);
  }
  public apiKey(): string { return this.#apiKey; }
  public toJSON(): Readonly<Record<string, unknown>> { return Object.freeze({ providerId: this.providerId, adapterVersion: this.adapterVersion, apiVersion: this.apiVersion, modelId: this.modelId, outputDimension: this.outputDimension, requestTimeoutMs: this.requestTimeoutMs, totalDeadlineMs: this.totalDeadlineMs, maxAttempts: this.maxAttempts, maxBatchSize: this.maxBatchSize, maxCharactersPerInput: this.maxCharactersPerInput, maxCharactersPerBatch: this.maxCharactersPerBatch }); }
}
export const createGeminiEmbeddingAdapterConfig = (environment: NodeJS.ProcessEnv): GeminiEmbeddingAdapterConfig => new GeminiEmbeddingAdapterConfig({ apiKey: environment.YUDIJI_GEMINI_API_KEY ?? "", modelId: environment.YUDIJI_GEMINI_EMBEDDING_MODEL ?? GEMINI_EMBEDDING_MODEL, outputDimension: numeric(environment.YUDIJI_GEMINI_EMBEDDING_DIMENSION, GEMINI_EMBEDDING_DIMENSION), apiVersion: environment.YUDIJI_GEMINI_EMBEDDING_API_VERSION ?? GEMINI_EMBEDDING_API_VERSION, requestTimeoutMs: numeric(environment.YUDIJI_GEMINI_EMBEDDING_REQUEST_TIMEOUT_MS, 30_000), totalDeadlineMs: numeric(environment.YUDIJI_GEMINI_EMBEDDING_TOTAL_DEADLINE_MS, 60_000), maxAttempts: numeric(environment.YUDIJI_GEMINI_EMBEDDING_MAX_ATTEMPTS, 2), maxBatchSize: numeric(environment.YUDIJI_GEMINI_EMBEDDING_MAX_BATCH_SIZE, 20), maxCharactersPerInput: numeric(environment.YUDIJI_GEMINI_EMBEDDING_MAX_CHARACTERS_PER_INPUT, 30_000), maxCharactersPerBatch: numeric(environment.YUDIJI_GEMINI_EMBEDDING_MAX_CHARACTERS_PER_BATCH, 100_000) });
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const numeric = (value: string | undefined, fallback: number) => value === undefined || !value.trim() ? fallback : Number(value);
