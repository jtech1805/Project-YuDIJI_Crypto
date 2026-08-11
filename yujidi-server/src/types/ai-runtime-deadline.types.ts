export const AI_RUNTIME_STAGES = [
  "PRE_EXECUTION",
  "EMBEDDING",
  "RETRIEVAL",
  "CONTEXT_ASSEMBLY",
  "GENERATION",
  "VALIDATION",
] as const;

export type AiRuntimeStage = (typeof AI_RUNTIME_STAGES)[number];

export type AiRuntimeStageLatencies = Readonly<{
  embeddingLatencyMs: number | null;
  retrievalLatencyMs: number | null;
  contextAssemblyLatencyMs: number | null;
  generationLatencyMs: number | null;
}>;

export interface AiRuntimeDeadlineContext {
  readonly startedAt: Date;
  readonly deadlineAt: Date;
  readonly signal: AbortSignal;
  remainingMs(): number;
  throwIfExpired(stage: AiRuntimeStage): void;
  enter(stage: AiRuntimeStage): void;
  complete(stage: AiRuntimeStage): void;
  latencies(): AiRuntimeStageLatencies;
  failureStage(): AiRuntimeStage | null;
  dispose(): void;
}

export class AiRuntimeDeadlineExceededError extends Error {
  public constructor(public readonly stage: AiRuntimeStage) {
    super("DEADLINE_EXCEEDED");
    this.name = "AiRuntimeDeadlineExceededError";
  }
}

export class AiRuntimeCallerCancelledError extends Error {
  public constructor(public readonly stage: AiRuntimeStage) {
    super("CALLER_CANCELLED");
    this.name = "AiRuntimeCallerCancelledError";
  }
}
