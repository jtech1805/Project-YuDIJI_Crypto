import type { CompiledDeterministicEvaluator } from "../ports/compiled-deterministic-evaluator.port.js";
import { CompiledEvaluatorImplementationRegistryError } from "../types/compiled-evaluator.types.js";

export interface CompiledEvaluatorImplementationRegistry {
  getExact(implementationKey: string, evaluatorVersion: number): CompiledDeterministicEvaluator | null;
}
export const DEFAULT_COMPILED_EVALUATOR_IMPLEMENTATIONS: readonly CompiledDeterministicEvaluator[] = Object.freeze([]);

export class StaticCompiledEvaluatorImplementationRegistry implements CompiledEvaluatorImplementationRegistry {
  private readonly values: ReadonlyMap<string, CompiledDeterministicEvaluator>;
  public constructor(implementations: readonly CompiledDeterministicEvaluator[]) {
    if (!Array.isArray(implementations) || !dense(implementations)) throw new CompiledEvaluatorImplementationRegistryError("INVALID_IMPLEMENTATION_COLLECTION");
    const values = new Map<string, CompiledDeterministicEvaluator>();
    for (const implementation of implementations as readonly unknown[]) {
      if (!valid(implementation)) throw new CompiledEvaluatorImplementationRegistryError("INVALID_IMPLEMENTATION");
      const key = identity(implementation.implementationKey, implementation.evaluatorVersion);
      if (values.has(key)) throw new CompiledEvaluatorImplementationRegistryError("DUPLICATE_IMPLEMENTATION");
      values.set(key, implementation);
    }
    this.values = values;
  }
  public getExact(implementationKey: string, evaluatorVersion: number): CompiledDeterministicEvaluator | null {
    if (!identifier(implementationKey) || !positive(evaluatorVersion)) return null;
    return this.values.get(identity(implementationKey, evaluatorVersion)) ?? null;
  }
}
const valid = (value: unknown): value is CompiledDeterministicEvaluator => record(value) && identifier(value.implementationKey)
  && identifier(value.evaluatorId) && positive(value.evaluatorVersion) && typeof value.evaluate === "function";
const identity = (key: string, version: number) => `${key}:${version}`;
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const dense = (values: readonly unknown[]): boolean => { for (let index = 0; index < values.length; index += 1) if (!(index in values)) return false; return true; };

