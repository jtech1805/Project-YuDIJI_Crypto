import type {
  AiProviderExecutionObserver,
  AiProviderExecutionOutcome,
} from "../../types/ai-provider-execution.types.js";
import type { AiProviderExecutionStage } from "../../types/ai-provider-stage.types.js";
import type { AiProviderCircuitPolicy } from "../../types/ai-runtime-circuit.types.js";
import type { AiRuntimeCircuitBreakerService } from "./ai-runtime-circuit-breaker.service.js";

export class AiProviderCircuitAttributionService
  implements AiProviderExecutionObserver
{
  public constructor(
    private readonly circuits: AiRuntimeCircuitBreakerService,
    private readonly policy: AiProviderCircuitPolicy,
    private readonly now: () => number = Date.now,
  ) {}

  public record(
    _stage: AiProviderExecutionStage,
    outcome: AiProviderExecutionOutcome,
  ): void {
    if (outcome.completed) {
      this.circuits.success(outcome.success.providerClass);
      return;
    }
    if (outcome.failure.failureCode === "CALLER_ABORTED") return;
    if (
      this.policy.eligibleFailureCodes.includes(outcome.failure.failureCode)
    ) {
      this.circuits.failure(
        outcome.failure.providerClass,
        outcome.failure.failureCode,
        this.now(),
      );
    }
  }
}
