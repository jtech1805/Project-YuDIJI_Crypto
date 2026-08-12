export type AiRuntimeBudgetUsage = Readonly<{
  requestCount: number;
  generationInputTokens: number;
  generationOutputTokens: number;
  embeddingInputs: number;
  estimatedCostUsd: number;
}>;
export type AiRuntimeBudgetDecision =
  | Readonly<{ allowed: true; reservationId: string }>
  | Readonly<{
      allowed: false;
      code:
        | "PER_USER_DAILY_EXCEEDED"
        | "GLOBAL_DAILY_EXCEEDED"
        | "GLOBAL_MONTHLY_COST_EXCEEDED";
    }>;
