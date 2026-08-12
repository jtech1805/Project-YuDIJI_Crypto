import {
  AiRuntimeCallerCancelledError,
  AiRuntimeDeadlineExceededError,
  type AiRuntimeDeadlineContext,
  type AiRuntimeStage,
  type AiRuntimeStageLatencies,
} from "../../types/ai-runtime-deadline.types.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";

type Clock = Readonly<{ now(): number }>;
type Timer = Readonly<{
  set(callback: () => void, milliseconds: number): unknown;
  clear(handle: unknown): void;
}>;

export class AiRuntimeDeadlineContextService
  implements AiRuntimeDeadlineContext
{
  public readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly startedAtEpochMs: number;
  private readonly deadlineAtEpochMs: number;
  private readonly starts = new Map<AiRuntimeStage, number>();
  private readonly durations = new Map<AiRuntimeStage, number>();
  private readonly timerHandle: unknown;
  private observedFailureStage: AiRuntimeStage | null = null;
  private activeStage: AiRuntimeStage = "PRE_EXECUTION";
  private disposed = false;
  private readonly cancelCallerListener: () => void;

  public constructor(
    deadlineMs: number,
    private readonly clock: Clock = { now: Date.now },
    private readonly timer: Timer = {
      set: (callback, milliseconds) => setTimeout(callback, milliseconds),
      clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    callerSignal?: AbortSignal,
  ) {
    const started = clock.now();
    this.startedAtEpochMs = started;
    this.deadlineAtEpochMs = started + Math.max(0, deadlineMs);
    this.signal = this.controller.signal;
    const cancelFromCaller = (): void => {
      if (!this.signal.aborted) {
        this.observedFailureStage = this.activeStage;
        this.controller.abort("CALLER_CANCELLED");
      }
    };
    if (callerSignal?.aborted) cancelFromCaller();
    else
      callerSignal?.addEventListener("abort", cancelFromCaller, {
        once: true,
      });
    this.cancelCallerListener = () =>
      callerSignal?.removeEventListener("abort", cancelFromCaller);
    this.timerHandle = timer.set(
      () => {
        if (!this.signal.aborted) {
          this.observedFailureStage = this.activeStage;
          this.controller.abort("RUNTIME_DEADLINE_EXCEEDED");
        }
      },
      Math.max(0, deadlineMs),
    );
  }

  public get startedAt(): Date {
    return new Date(this.startedAtEpochMs);
  }

  public get deadlineAt(): Date {
    return new Date(this.deadlineAtEpochMs);
  }

  public remainingMs(): number {
    return Math.max(0, this.deadlineAtEpochMs - this.clock.now());
  }

  public throwIfExpired(stage: AiRuntimeStage): void {
    if (this.signal.aborted) {
      this.observedFailureStage = stage;
      if (this.signal.reason === "CALLER_CANCELLED") {
        throw new AiRuntimeCallerCancelledError(stage);
      }
      throw new AiRuntimeDeadlineExceededError(stage);
    }
    if (this.remainingMs() === 0) {
      this.observedFailureStage = stage;
      this.controller.abort("RUNTIME_DEADLINE_EXCEEDED");
      throw new AiRuntimeDeadlineExceededError(stage);
    }
  }

  public enter(stage: AiRuntimeStage): void {
    this.throwIfExpired(stage);
    this.activeStage = stage;
    this.starts.set(stage, this.clock.now());
  }

  public complete(stage: AiRuntimeStage): void {
    const started = this.starts.get(stage);
    if (started !== undefined) {
      this.durations.set(stage, Math.max(0, this.clock.now() - started));
    }
  }

  public latencies(): AiRuntimeStageLatencies {
    return freezeClone({
      embeddingLatencyMs: this.durations.get("EMBEDDING") ?? null,
      retrievalLatencyMs: this.durations.get("RETRIEVAL") ?? null,
      contextAssemblyLatencyMs: this.durations.get("CONTEXT_ASSEMBLY") ?? null,
      generationLatencyMs: this.durations.get("GENERATION") ?? null,
    });
  }

  public failureStage(): AiRuntimeStage | null {
    return this.observedFailureStage;
  }

  public dispose(): void {
    if (!this.disposed) {
      this.timer.clear(this.timerHandle);
      this.cancelCallerListener();
      this.disposed = true;
    }
  }
}
