import type {
  AiProviderStageUsage,
  AiProviderUsage,
} from "../../types/ai-provider-usage.types.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";

export class AiProviderUsageAggregationService {
  public aggregate(stages: readonly AiProviderStageUsage[]): Readonly<{
    stages: readonly AiProviderStageUsage[];
    totals: AiProviderUsage;
  }> {
    const totals: Record<string, number> = {};
    for (const stage of stages) {
      for (const [key, value] of Object.entries(stage.usage)) {
        if (value !== undefined) totals[key] = (totals[key] ?? 0) + value;
      }
    }
    return freezeClone({ stages, totals });
  }
}
