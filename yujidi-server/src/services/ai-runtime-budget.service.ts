import type { AiRuntimeBudgetPort } from "../ports/ai-runtime-budget.port.js";
import type { AiRuntimeExecutionPolicy } from "../types/ai-runtime-execution-policy.types.js";
export class InMemoryAiRuntimeBudgetService implements AiRuntimeBudgetPort {
  private users = new Map<string, number>();
  private days = new Map<string, number>();
  private months = new Map<string, number>();
  constructor(private p: AiRuntimeExecutionPolicy) {}
  async reserve(i: any) {
    const u = `${i.userId}:${i.day}`,
      uv = this.users.get(u) ?? 0,
      dv = this.days.get(i.day) ?? 0,
      mv = this.months.get(i.month) ?? 0;
    if (uv + i.usage.requestCount > this.p.perUserDailyRequests)
      return {
        allowed: false as const,
        code: "PER_USER_DAILY_EXCEEDED" as const,
      };
    if (dv + i.usage.requestCount > this.p.globalDailyRequests)
      return {
        allowed: false as const,
        code: "GLOBAL_DAILY_EXCEEDED" as const,
      };
    if (mv + i.usage.estimatedCostUsd > this.p.monthlyCostUsd)
      return {
        allowed: false as const,
        code: "GLOBAL_MONTHLY_COST_EXCEEDED" as const,
      };
    this.users.set(u, uv + i.usage.requestCount);
    this.days.set(i.day, dv + i.usage.requestCount);
    this.months.set(i.month, mv + i.usage.estimatedCostUsd);
    return { allowed: true as const, reservationId: `${u}:${uv + 1}` };
  }
}
