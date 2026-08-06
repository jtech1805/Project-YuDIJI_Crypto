import { GEMINI_GENERATION_ADAPTER_VERSION, GEMINI_GENERATION_API_VERSION, GEMINI_GENERATION_MODEL, GEMINI_GENERATION_PROVIDER } from "../types/gemini-generation-adapter.types.js";

export class GeminiGenerationAdapterConfig {
  readonly providerId = GEMINI_GENERATION_PROVIDER; readonly adapterVersion = GEMINI_GENERATION_ADAPTER_VERSION;
  readonly modelId = GEMINI_GENERATION_MODEL; readonly apiVersion = GEMINI_GENERATION_API_VERSION;
  readonly requestTimeoutMs: number; readonly totalDeadlineMs: number; readonly maxOutputTokens: number; readonly maxAttempts: number;
  readonly #apiKey: string;
  public constructor(input: Readonly<{ apiKey: string; modelId: string; requestTimeoutMs: number; totalDeadlineMs?: number; maxOutputTokens: number; maxAttempts: number }>) {
    if (typeof input.apiKey !== "string" || input.apiKey.trim().length === 0) throw new Error("GEMINI_API_KEY_REQUIRED");
    if (input.modelId !== GEMINI_GENERATION_MODEL) throw new Error("GEMINI_MODEL_NOT_APPROVED");
    if (!integer(input.requestTimeoutMs, 100, 120_000) || !integer(input.totalDeadlineMs ?? input.requestTimeoutMs * input.maxAttempts, input.requestTimeoutMs, 240_000)
      || !integer(input.maxOutputTokens, 128, 65_536) || !integer(input.maxAttempts, 1, 2)) throw new Error("INVALID_GEMINI_GENERATION_CONFIG");
    this.#apiKey = input.apiKey; this.requestTimeoutMs = input.requestTimeoutMs;
    this.totalDeadlineMs = input.totalDeadlineMs ?? input.requestTimeoutMs * input.maxAttempts;
    this.maxOutputTokens = input.maxOutputTokens; this.maxAttempts = input.maxAttempts; Object.freeze(this);
  }
  public apiKey(): string { return this.#apiKey; }
  public toJSON(): Readonly<Record<string, unknown>> { return Object.freeze({ providerId: this.providerId, adapterVersion: this.adapterVersion, modelId: this.modelId, apiVersion: this.apiVersion, requestTimeoutMs: this.requestTimeoutMs, totalDeadlineMs: this.totalDeadlineMs, maxOutputTokens: this.maxOutputTokens, maxAttempts: this.maxAttempts }); }
}
export const createGeminiGenerationAdapterConfig = (environment: NodeJS.ProcessEnv): GeminiGenerationAdapterConfig => new GeminiGenerationAdapterConfig({ apiKey: environment.YUDIJI_GEMINI_API_KEY ?? "", modelId: environment.YUDIJI_GEMINI_MODEL ?? GEMINI_GENERATION_MODEL, requestTimeoutMs: number(environment.YUDIJI_GEMINI_REQUEST_TIMEOUT_MS, 30_000), totalDeadlineMs: number(environment.YUDIJI_GEMINI_TOTAL_DEADLINE_MS, 60_000), maxOutputTokens: number(environment.YUDIJI_GEMINI_MAX_OUTPUT_TOKENS, 8_192), maxAttempts: number(environment.YUDIJI_GEMINI_MAX_ATTEMPTS, 2) });
const integer = (value: unknown, minimum: number, maximum: number): value is number => Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
const number = (value: string | undefined, fallback: number): number => value === undefined || value.trim() === "" ? fallback : Number(value);
