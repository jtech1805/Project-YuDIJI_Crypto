import type { AiRuntimeConcurrencyPort } from "../../ports/ai-runtime-concurrency.port.js";
export class ProcessLocalAiRuntimeConcurrencyService
  implements AiRuntimeConcurrencyPort
{
  private active = new Set<string>();
  constructor(private max: number) {}
  async acquire(scope: string) {
    if (this.active.size >= this.max) return { acquired: false as const };
    const permitId = `${scope}:${this.active.size + 1}`;
    this.active.add(permitId);
    return { acquired: true as const, permitId };
  }
  async release(id: string) {
    this.active.delete(id);
  }
}
