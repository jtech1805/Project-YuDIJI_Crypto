export const AI_PROVIDER_CLASSES = [
  "GENERATION_PROVIDER",
  "EMBEDDING_PROVIDER",
  "VECTOR_INDEX_PROVIDER",
] as const;
export type AiProviderClass = (typeof AI_PROVIDER_CLASSES)[number];
export type AiCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export type AiProviderCircuitPolicy = Readonly<{
  policyId: string;
  policyVersion: number;
  failureThreshold: number;
  rollingWindowMs: number;
  openDurationMs: number;
  halfOpenProbeCount: number;
  eligibleFailureCodes: readonly string[];
}>;
