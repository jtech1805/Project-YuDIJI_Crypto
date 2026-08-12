import type { AiGovernedExecutionContext } from "../../types/ai-governed-execution-context.types.js";
import type { AiProviderExecutionObserver } from "../../types/ai-provider-execution.types.js";
import type {
  TemplateDraftGenerationRequest,
  TemplateDraftGenerationResult,
} from "../../types/template-draft-generation.types.js";
import type { AiRuntimeCircuitBreakerService } from "../ai-runtime/ai-runtime-circuit-breaker.service.js";
import type { TemplateDraftGenerationService } from "./template-draft-generation.service.js";

export class TemplateDraftRegistryOnlyBaselineService {
  public constructor(
    private readonly generation: TemplateDraftGenerationService,
    private readonly circuits: AiRuntimeCircuitBreakerService,
    private readonly now: () => number = Date.now,
  ) {}

  public async execute(
    context: AiGovernedExecutionContext,
    request: TemplateDraftGenerationRequest,
    observer: AiProviderExecutionObserver,
  ): Promise<
    Readonly<{
      result: TemplateDraftGenerationResult;
      generationLatencyMs: number;
    }>
  > {
    context.deadlineContext.throwIfExpired("GENERATION");
    if (!this.circuits.allow("GENERATION_PROVIDER", this.now())) {
      throw new Error("GENERATION_PROVIDER_CIRCUIT_OPEN");
    }
    const startedAt = this.now();
    const result = await this.generation.generate(request, {
      providerObserver: observer,
      signal: context.deadlineContext.signal,
    });
    return Object.freeze({
      result,
      generationLatencyMs: Math.max(0, this.now() - startedAt),
    });
  }
}
