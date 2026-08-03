import { createHash } from "node:crypto";
import { cloneAndFreeze } from "../registries/historical-authority.internal.js";
import type { CanonicalCompilationHashResult } from "../types/canonical-compilation-input.types.js";

export class CanonicalCompilationInputService {
  public hash(value: unknown): CanonicalCompilationHashResult {
    try {
      const canonical = canonicalize(value, "compilationInput", new Set());
      const serialized = JSON.stringify(canonical);
      const hash = createHash("sha256").update(serialized, "utf8").digest("hex");
      return cloneAndFreeze({ hashed: true, canonical, serialized, hash });
    } catch (error) {
      if (error instanceof CanonicalCompilationValueError) return Object.freeze({ hashed: false, code: "COMPILATION_INPUT_CANONICALIZATION_FAILED", path: error.path });
      return Object.freeze({ hashed: false, code: "COMPILATION_INPUT_HASH_FAILED", path: "compilationInput" });
    }
  }
}

class CanonicalCompilationValueError extends Error { public constructor(public readonly path: string) { super(path); } }
const canonicalize = (value: unknown, path: string, ancestors: Set<object>): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new CanonicalCompilationValueError(path);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object" || value instanceof Date) throw new CanonicalCompilationValueError(path);
  if (ancestors.has(value)) throw new CanonicalCompilationValueError(path);
  ancestors.add(value);
  let result: unknown;
  if (Array.isArray(value)) result = value.map((item, index) => canonicalize(item, `${path}[${index}]`, ancestors));
  else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new CanonicalCompilationValueError(path);
    result = Object.fromEntries(Object.keys(value as object).sort().map((key) => {
      const nested = (value as Record<string, unknown>)[key];
      if (nested === undefined) throw new CanonicalCompilationValueError(`${path}.${key}`);
      return [key, canonicalize(nested, `${path}.${key}`, ancestors)];
    }));
  }
  ancestors.delete(value);
  return result;
};
