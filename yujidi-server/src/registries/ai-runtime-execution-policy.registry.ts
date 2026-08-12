import { freezeClone } from "../services/knowledge/knowledge-document-admission.service.js";
import type { AiRuntimeExecutionPolicy } from "../types/ai-runtime-execution-policy.types.js";
import type { AiProviderCircuitPolicy } from "../types/ai-runtime-circuit.types.js";
export const TEMPLATE_DRAFT_RAG_EXECUTION_POLICY: AiRuntimeExecutionPolicy =
  Object.freeze({
    policyId: "TEMPLATE_DRAFT_RAG_EXECUTION_POLICY",
    policyVersion: 1,
    requestDeadlineMs: 60000,
    providerAttemptTimeoutMs: 30000,
    maxRetries: 1,
    maxConcurrentExecutions: 2,
    perUserDailyRequests: 20,
    globalDailyRequests: 200,
    monthlyCostUsd: 25,
    maxPromptCharacters: 10000,
    maxContextCharacters: 10000,
    maxRetrievedPassages: 5,
    maxGenerationOutputTokens: 4096,
    circuitPolicyId: "AI_PROVIDER_CIRCUIT_POLICY",
    circuitPolicyVersion: 1,
  });
export const AI_PROVIDER_CIRCUIT_POLICY: AiProviderCircuitPolicy =
  Object.freeze({
    policyId: "AI_PROVIDER_CIRCUIT_POLICY",
    policyVersion: 1,
    failureThreshold: 3,
    rollingWindowMs: 60000,
    openDurationMs: 30000,
    halfOpenProbeCount: 1,
    eligibleFailureCodes: Object.freeze([
      "REQUEST_TIMEOUT",
      "NETWORK_FAILED",
      "PROVIDER_UNAVAILABLE",
    ]),
  });
export class AiRuntimeExecutionPolicyRegistry {
  getExact(id: string, v: number) {
    return id === TEMPLATE_DRAFT_RAG_EXECUTION_POLICY.policyId && v === 1
      ? freezeClone(TEMPLATE_DRAFT_RAG_EXECUTION_POLICY)
      : null;
  }
}
