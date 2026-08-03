import { createHash } from "node:crypto";
import { cloneAndFreeze } from "../registries/historical-authority.internal.js";
import type { CanonicalTemplateCompilationSnapshot, CanonicalTemplateSnapshotResult, TemplateCompilationSnapshotInput } from "../types/canonical-template-snapshot.types.js";

export class CanonicalTemplateSnapshotService {
  public create(input: TemplateCompilationSnapshotInput): CanonicalTemplateSnapshotResult {
    try {
      const snapshot: CanonicalTemplateCompilationSnapshot = {
        templateId: input.templateId,
        templateVersion: input.templateVersion,
        templateKind: input.templateKind,
        status: input.status,
        visibility: input.visibility,
        scope: {
          marketType: input.scope.marketType,
          tradeStyle: input.scope.tradeStyle,
          instrumentType: input.scope.instrumentType,
          allowedTradableSymbols: [...input.scope.allowedTradableSymbols],
        },
        aggregationMode: input.aggregationMode,
        sections: input.sections.map((section, sectionIndex) => ({
          sectionIndex,
          sectionKey: section.sectionKey,
          weight: normalizeNumber(section.weight),
          enabled: section.enabled,
          missingDataPolicy: section.missingDataPolicy,
          evaluators: section.evaluators.map((evaluator, evaluatorIndex) => ({
            evaluatorIndex,
            evaluatorKey: evaluator.evaluatorKey,
            label: evaluator.label,
            weight: normalizeNumber(evaluator.weight),
            enabled: evaluator.enabled,
            evaluatorMissingDataPolicy: evaluator.missingDataPolicy ?? null,
            config: evaluator.config === undefined ? null : canonicalValue(evaluator.config, `sections[${sectionIndex}].evaluators[${evaluatorIndex}].config`, new Set()) as Readonly<Record<string, unknown>>,
          })),
        })),
      };
      const canonical = canonicalValue(snapshot, "templateSnapshot", new Set());
      const serialized = JSON.stringify(canonical);
      const hash = createHash("sha256").update(serialized, "utf8").digest("hex");
      return cloneAndFreeze({ valid: true, snapshot, serialized, hash });
    } catch (error) {
      if (error instanceof CanonicalValueError) return Object.freeze({ valid: false, code: "INVALID_TEMPLATE_SNAPSHOT_VALUE", path: error.path });
      return Object.freeze({ valid: false, code: "TEMPLATE_SNAPSHOT_HASH_FAILED", path: "templateSnapshot" });
    }
  }
}

class CanonicalValueError extends Error { public constructor(public readonly path: string) { super(path); } }
const normalizeNumber = (value: number) => Object.is(value, -0) ? 0 : value;
const canonicalValue = (value: unknown, path: string, ancestors: Set<object>): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new CanonicalValueError(path);
    return normalizeNumber(value);
  }
  if (typeof value !== "object" || value instanceof Date) throw new CanonicalValueError(path);
  if (ancestors.has(value)) throw new CanonicalValueError(path);
  ancestors.add(value);
  let result: unknown;
  if (Array.isArray(value)) result = value.map((item, index) => canonicalValue(item, `${path}[${index}]`, ancestors));
  else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new CanonicalValueError(path);
    result = Object.fromEntries(Object.keys(value as object).sort().map((key) => {
      const nested = (value as Record<string, unknown>)[key];
      if (nested === undefined) throw new CanonicalValueError(`${path}.${key}`);
      return [key, canonicalValue(nested, `${path}.${key}`, ancestors)];
    }));
  }
  ancestors.delete(value);
  return result;
};
