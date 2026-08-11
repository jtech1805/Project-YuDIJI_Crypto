import {
  ApiError,
  GoogleGenAI,
  type Content,
  type GenerateContentResponse,
} from "@google/genai";
import { z } from "zod";
import type { GeminiGenerationAdapterConfig } from "../../config/gemini-generation.config.js";
import type { TemplateDraftGenerationPort } from "../../ports/template-draft-generation.port.js";
import { templateDraftCandidateSchema } from "../../services/template-draft-generation.service.js";
import type {
  TemplateDraftModelRequest,
  TemplateDraftModelResult,
} from "../../types/template-draft-generation.types.js";
import {
  GEMINI_GENERATION_ADAPTER_VERSION,
  GEMINI_GENERATION_API_VERSION,
  GEMINI_GENERATION_MODEL,
  GEMINI_GENERATION_PROVIDER,
  type GeminiAdapterDiagnostic,
  type GeminiAdapterFailureCode,
} from "../../types/gemini-generation-adapter.types.js";

type GeminiResponse = Pick<
  GenerateContentResponse,
  | "text"
  | "modelVersion"
  | "responseId"
  | "usageMetadata"
  | "promptFeedback"
  | "candidates"
>;
type GeminiClient = Readonly<{
  generate(
    input: Readonly<{
      model: string;
      contents: readonly Content[];
      config: Readonly<Record<string, unknown>>;
    }>,
  ): Promise<GeminiResponse>;
}>;
type DiagnosticSink = Readonly<{
  record(diagnostic: GeminiAdapterDiagnostic): void | Promise<void>;
}>;
type Clock = Readonly<{ now(): Date }>;
const TRANSIENT = new Set<GeminiAdapterFailureCode>([
  "RATE_LIMITED",
  "REQUEST_TIMEOUT",
  "NETWORK_FAILED",
  "PROVIDER_UNAVAILABLE",
]);
const GEMINI_JSON_SCHEMA_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
]);

/** Gemini free-tier development adapter. Never send private, confidential, regulated, market-research, or production-user content. */
export class GeminiTemplateDraftGenerationAdapter
  implements TemplateDraftGenerationPort
{
  readonly #client: GeminiClient;
  readonly #schema: unknown;
  public constructor(
    private readonly config: GeminiGenerationAdapterConfig,
    dependencies: Readonly<{
      client?: GeminiClient;
      diagnostics?: DiagnosticSink;
      clock?: Clock;
    }> = {},
  ) {
    this.#client = dependencies.client ?? sdkClient(config);
    this.diagnostics = dependencies.diagnostics;
    this.clock = dependencies.clock ?? { now: () => new Date() };
    const projected = z.toJSONSchema(templateDraftCandidateSchema, {
      target: "draft-7",
    }) as Record<string, unknown>;
    this.#schema = deepFreeze(projectGeminiJsonSchema(projected));
  }
  readonly diagnostics: DiagnosticSink | undefined;
  readonly clock: Clock;

  public async generate(
    request: TemplateDraftModelRequest,
    execution?: Readonly<{ signal: AbortSignal }>,
  ): Promise<TemplateDraftModelResult> {
    const started = this.clock.now();
    const translated = this.translate(request);
    let attempts = 0;
    let last: GeminiAdapterFailureCode = "UNKNOWN_PROVIDER_FAILURE";
    while (
      attempts < this.config.maxAttempts &&
      this.clock.now().getTime() - started.getTime() <
        this.config.totalDeadlineMs
    ) {
      attempts += 1;
      const controller = new AbortController();
      const cancel = composeAbort(execution?.signal, controller);
      const timer = setTimeout(
        () => controller.abort("REQUEST_TIMEOUT"),
        this.config.requestTimeoutMs,
      );
      try {
        const response = await this.#client.generate({
          ...translated,
          config: { ...translated.config, abortSignal: controller.signal },
        });
        clearTimeout(timer);
        cancel();
        const handled = this.handleResponse(
          request,
          response,
          started,
          attempts,
        );
        await this.trace(handled.diagnostic);
        return handled.result;
      } catch (error: unknown) {
        clearTimeout(timer);
        cancel();
        last = classify(error, controller.signal);
        if (!TRANSIENT.has(last) || attempts >= this.config.maxAttempts) break;
      }
    }
    const completedAt = this.clock.now();
    await this.trace(
      diagnostic(
        request.correlationId,
        started,
        completedAt,
        attempts,
        "FAILED",
        last,
        null,
        null,
        {},
      ),
    );
    return frozen({
      completed: false,
      code: last === "EMPTY_RESPONSE" ? "EMPTY_RESPONSE" : "PROVIDER_FAILED",
      provider: GEMINI_GENERATION_PROVIDER,
      model: GEMINI_GENERATION_MODEL,
      completedAt,
    });
  }

  public requestSchema(): unknown {
    return frozen(this.#schema);
  }
  private translate(request: TemplateDraftModelRequest): Readonly<{
    model: string;
    contents: readonly Content[];
    config: Readonly<Record<string, unknown>>;
  }> {
    const systems = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content);
    const contents: Content[] = request.messages
      .filter((message) => message.role === "user")
      .map((message) => ({ role: "user", parts: [{ text: message.content }] }));
    return frozen({
      model: GEMINI_GENERATION_MODEL,
      contents,
      config: {
        systemInstruction: systems.join("\n\n"),
        responseMimeType: "application/json",
        responseJsonSchema: this.#schema,
        maxOutputTokens: this.config.maxOutputTokens,
        temperature: 0.1,
        candidateCount: 1,
      },
    });
  }
  private handleResponse(
    request: TemplateDraftModelRequest,
    response: GeminiResponse,
    started: Date,
    attempts: number,
  ): Readonly<{
    result: TemplateDraftModelResult;
    diagnostic: GeminiAdapterDiagnostic;
  }> {
    const completedAt = this.clock.now(),
      reported = response.modelVersion ?? null,
      responseId = response.responseId ?? null,
      usage = mapUsage(response.usageMetadata);
    const blocked =
      response.promptFeedback?.blockReason !== undefined ||
      response.candidates?.[0]?.finishReason === "SAFETY" ||
      response.candidates?.[0]?.finishReason === "BLOCKLIST" ||
      response.candidates?.[0]?.finishReason === "PROHIBITED_CONTENT";
    let failure: GeminiAdapterFailureCode | null = null;
    if (reported && !sameModel(reported, GEMINI_GENERATION_MODEL))
      failure = "MODEL_IDENTITY_MISMATCH";
    else if (blocked) failure = "CONTENT_REJECTED";
    else if (!response.text?.trim()) failure = "EMPTY_RESPONSE";
    if (failure)
      return frozen({
        result: {
          completed: false,
          code:
            failure === "EMPTY_RESPONSE" ? "EMPTY_RESPONSE" : "PROVIDER_FAILED",
          provider: GEMINI_GENERATION_PROVIDER,
          model: reported ?? GEMINI_GENERATION_MODEL,
          completedAt,
        },
        diagnostic: diagnostic(
          request.correlationId,
          started,
          completedAt,
          attempts,
          "FAILED",
          failure,
          reported,
          responseId,
          usage,
        ),
      });
    return frozen({
      result: {
        completed: true,
        output: response.text!,
        provider: GEMINI_GENERATION_PROVIDER,
        model: reported ?? GEMINI_GENERATION_MODEL,
        completedAt,
        ...representableUsage(usage),
      },
      diagnostic: diagnostic(
        request.correlationId,
        started,
        completedAt,
        attempts,
        "COMPLETED",
        null,
        reported,
        responseId,
        usage,
      ),
    });
  }
  private async trace(value: GeminiAdapterDiagnostic): Promise<void> {
    try {
      await this.diagnostics?.record(value);
    } catch {
      /* metadata tracing is failure-isolated */
    }
  }
}

const sdkClient = (config: GeminiGenerationAdapterConfig): GeminiClient => {
  const sdk = new GoogleGenAI({
    apiKey: config.apiKey(),
    httpOptions: { apiVersion: GEMINI_GENERATION_API_VERSION },
  });
  return {
    generate: (input) =>
      sdk.models.generateContent(
        input as Parameters<typeof sdk.models.generateContent>[0],
      ),
  };
};
const projectGeminiJsonSchema = (
  value: unknown,
  parentKey?: string,
): unknown => {
  if (Array.isArray(value))
    return value.map((item) => projectGeminiJsonSchema(item));
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  if (parentKey === "properties" || parentKey === "$defs")
    return Object.fromEntries(
      entries.map(([key, item]) => [key, projectGeminiJsonSchema(item)]),
    );
  return Object.fromEntries(
    entries
      .filter(([key]) => GEMINI_JSON_SCHEMA_KEYWORDS.has(key))
      .map(([key, item]) => [key, projectGeminiJsonSchema(item, key)]),
  );
};
const classify = (
  error: unknown,
  signal: AbortSignal,
): GeminiAdapterFailureCode => {
  if (signal.aborted)
    return signal.reason === "REQUEST_TIMEOUT"
      ? "REQUEST_TIMEOUT"
      : "CALLER_ABORTED";
  if (error instanceof ApiError) {
    if (error.status === 400)
      return /too large|size|token limit/i.test(error.message)
        ? "INPUT_TOO_LARGE"
        : "SCHEMA_VALIDATION_FAILED";
    if (error.status === 401) return "AUTHENTICATION_FAILED";
    if (error.status === 403) return "PERMISSION_DENIED";
    if (error.status === 404) return "MODEL_NOT_FOUND";
    if (error.status === 408 || error.status === 504) return "REQUEST_TIMEOUT";
    if (error.status === 429) return "RATE_LIMITED";
    if (error.status >= 500) return "PROVIDER_UNAVAILABLE";
    return "UNKNOWN_PROVIDER_FAILURE";
  }
  if (error instanceof TypeError) return "NETWORK_FAILED";
  return "UNKNOWN_PROVIDER_FAILURE";
};
const composeAbort = (
  caller: AbortSignal | undefined,
  controller: AbortController,
): (() => void) => {
  const abort = () => controller.abort(caller?.reason ?? "CALLER_ABORTED");
  if (caller?.aborted) abort();
  else caller?.addEventListener("abort", abort, { once: true });
  return () => caller?.removeEventListener("abort", abort);
};
const sameModel = (reported: string, requested: string) =>
  reported === requested ||
  reported === `models/${requested}` ||
  reported.startsWith(`${requested}-`);
const mapUsage = (
  usage: GeminiResponse["usageMetadata"],
): GeminiAdapterDiagnostic["usage"] =>
  frozen({
    ...(usage?.promptTokenCount !== undefined
      ? { promptTokens: usage.promptTokenCount }
      : {}),
    ...(usage?.candidatesTokenCount !== undefined
      ? { completionTokens: usage.candidatesTokenCount }
      : {}),
    ...(usage?.totalTokenCount !== undefined
      ? { totalTokens: usage.totalTokenCount }
      : {}),
    ...(usage?.cachedContentTokenCount !== undefined
      ? { cachedInputTokens: usage.cachedContentTokenCount }
      : {}),
    ...(usage?.thoughtsTokenCount !== undefined
      ? { reasoningTokens: usage.thoughtsTokenCount }
      : {}),
  });
const representableUsage = (
  usage: GeminiAdapterDiagnostic["usage"],
): Readonly<{
  tokenUsage?: Readonly<{
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }>;
}> => {
  const tokenUsage = {
    ...(usage.promptTokens !== undefined
      ? { promptTokens: usage.promptTokens }
      : {}),
    ...(usage.completionTokens !== undefined
      ? { completionTokens: usage.completionTokens }
      : {}),
    ...(usage.totalTokens !== undefined
      ? { totalTokens: usage.totalTokens }
      : {}),
  };
  return Object.keys(tokenUsage).length ? { tokenUsage } : {};
};
const diagnostic = (
  correlationId: string,
  start: Date,
  end: Date,
  attempts: number,
  status: GeminiAdapterDiagnostic["status"],
  failureCode: GeminiAdapterFailureCode | null,
  providerReportedModel: string | null,
  responseId: string | null,
  usage: GeminiAdapterDiagnostic["usage"],
): GeminiAdapterDiagnostic =>
  frozen({
    correlationId,
    provider: GEMINI_GENERATION_PROVIDER,
    requestedModel: GEMINI_GENERATION_MODEL,
    providerReportedModel,
    adapterVersion: GEMINI_GENERATION_ADAPTER_VERSION,
    apiVersion: GEMINI_GENERATION_API_VERSION,
    responseId,
    attempts,
    status,
    latencyMs: Math.max(0, end.getTime() - start.getTime()),
    failureCode,
    usage,
  });
const frozen = <T>(value: T): T => deepFreeze(structuredClone(value));
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};
