export type AiRuntimeExecutionPolicy = Readonly<{
  policyId: string;
  policyVersion: number;
  requestDeadlineMs: number;
  providerAttemptTimeoutMs: number;
  maxRetries: number;
  maxConcurrentExecutions: number;
  perUserDailyRequests: number;
  globalDailyRequests: number;
  monthlyCostUsd: number;
  maxPromptCharacters: number;
  maxContextCharacters: number;
  maxRetrievedPassages: number;
  maxGenerationOutputTokens: number;
  circuitPolicyId: string;
  circuitPolicyVersion: number;
}>;
