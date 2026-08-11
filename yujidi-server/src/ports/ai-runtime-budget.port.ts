import type {
  AiRuntimeBudgetDecision,
  AiRuntimeBudgetUsage,
} from "../types/ai-runtime-budget.types.js";
export interface AiRuntimeBudgetPort {
  reserve(
    input: Readonly<{
      userId: string;
      day: string;
      month: string;
      usage: AiRuntimeBudgetUsage;
    }>,
  ): Promise<AiRuntimeBudgetDecision>;
}
