import type { AiProviderClass } from "./ai-runtime-circuit.types.js";
import type { AiProviderExecutionStage } from "./ai-provider-stage.types.js";

export type AiProviderUsage = Readonly<{
  providerCalls?: number;
  generationCalls?: number;
  embeddingInputs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}>;

export type AiProviderStageUsage = Readonly<{
  stage: AiProviderExecutionStage;
  providerClass: AiProviderClass;
  provider?: string;
  model?: string;
  usage: AiProviderUsage;
}>;

export type AiRuntimeRecordedUsage = Readonly<{
  executionId: string;
  userId: string;
  stages: readonly AiProviderStageUsage[];
}>;
