import type { AiRuntimeRecordedUsage } from "../types/ai-provider-usage.types.js";

export interface AiRuntimeUsagePort {
  recordUsage(usage: AiRuntimeRecordedUsage): Promise<void>;
}
