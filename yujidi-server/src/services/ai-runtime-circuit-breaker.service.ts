import type {
  AiCircuitState,
  AiProviderClass,
  AiProviderCircuitPolicy,
} from "../types/ai-runtime-circuit.types.js";
export class AiRuntimeCircuitBreakerService {
  private values = new Map<
    AiProviderClass,
    { failures: number; openedAt: number; probes: number }
  >();
  constructor(private p: AiProviderCircuitPolicy) {}
  state(c: AiProviderClass, now: number): AiCircuitState {
    const x = this.values.get(c);
    if (!x) return "CLOSED";
    if (x.openedAt && now - x.openedAt >= this.p.openDurationMs)
      return "HALF_OPEN";
    return x.openedAt ? "OPEN" : "CLOSED";
  }
  allow(c: AiProviderClass, now: number) {
    const s = this.state(c, now),
      x = this.values.get(c);
    if (s === "OPEN") return false;
    if (s === "HALF_OPEN" && x && x.probes >= this.p.halfOpenProbeCount)
      return false;
    if (s === "HALF_OPEN" && x) x.probes++;
    return true;
  }
  success(c: AiProviderClass) {
    this.values.delete(c);
  }
  failure(c: AiProviderClass, code: string, now: number) {
    if (!this.p.eligibleFailureCodes.includes(code)) return;
    const x = this.values.get(c) ?? { failures: 0, openedAt: 0, probes: 0 };
    x.failures++;
    if (x.failures >= this.p.failureThreshold) x.openedAt = now;
    this.values.set(c, x);
  }
}
