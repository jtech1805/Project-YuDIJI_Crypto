import pino, { type Logger } from "pino";

export type InternalRagLifecycleEvent = Readonly<{
  event: string;
  executionId?: string;
  requestId: string;
  userId: string;
  stage?: string;
  outcome?: string;
  durationMs?: number | null;
  details?: Readonly<Record<string, unknown>>;
}>;

export interface InternalRagLifecycleLogger {
  info(event: InternalRagLifecycleEvent): void;
  warn(event: InternalRagLifecycleEvent): void;
}

export class PinoInternalRagLifecycleLogger
  implements InternalRagLifecycleLogger
{
  public constructor(
    private readonly logger: Logger = pino({ name: "internal-rag-runtime" }),
  ) {}

  public info(event: InternalRagLifecycleEvent): void {
    this.logger.info(event, "Internal RAG lifecycle");
  }

  public warn(event: InternalRagLifecycleEvent): void {
    this.logger.warn(event, "Internal RAG lifecycle failure");
  }
}

export const NOOP_INTERNAL_RAG_LIFECYCLE_LOGGER: InternalRagLifecycleLogger =
  Object.freeze({
    info: () => undefined,
    warn: () => undefined,
  });
