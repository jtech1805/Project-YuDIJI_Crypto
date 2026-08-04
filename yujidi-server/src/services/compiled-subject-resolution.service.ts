import { MAX_COMPILED_SUBJECT_KEY_LENGTH, type CompiledFixedSubject } from "../types/compiled-rulebook.types.js";
import type { CompiledSubjectResolutionResult } from "../types/resolved-execution-input.types.js";

const SUBJECT_KEY = /^[A-Z0-9._:-]+$/;
const CANONICAL_SUBJECT_TYPES = Object.freeze(["INSTRUMENT", "ASSET", "MARKET", "ECONOMY", "EVENT", "PORTFOLIO"] as const);

export class CompiledSubjectResolutionService {
  public resolve(subjectBinding: unknown, context: unknown): CompiledSubjectResolutionResult {
    if (!record(subjectBinding) || typeof subjectBinding.type !== "string") return fail("INVALID_COMPILED_SUBJECT_BINDING");
    if (subjectBinding.type === "FIXED") {
      return canonical(subjectBinding.subject)
        ? success(subjectBinding.subject)
        : fail("INVALID_COMPILED_SUBJECT_BINDING");
    }
    if (subjectBinding.type === "TRADED_INSTRUMENT") {
      if (!record(context) || context.tradedInstrument === null || context.tradedInstrument === undefined) return fail("MISSING_TRADED_INSTRUMENT");
      return canonical(context.tradedInstrument) && context.tradedInstrument.type === "INSTRUMENT"
        ? success(context.tradedInstrument)
        : fail("INVALID_TRADED_INSTRUMENT");
    }
    if (subjectBinding.type === "UNDERLYING_ASSET") {
      if (!record(context) || context.underlyingAsset === null || context.underlyingAsset === undefined) return fail("MISSING_UNDERLYING_ASSET");
      return canonical(context.underlyingAsset) && context.underlyingAsset.type === "ASSET"
        ? success(context.underlyingAsset)
        : fail("INVALID_UNDERLYING_ASSET");
    }
    return fail("INVALID_COMPILED_SUBJECT_BINDING");
  }
}

const canonical = (value: unknown): value is CompiledFixedSubject => record(value)
  && CANONICAL_SUBJECT_TYPES.includes(value.type)
  && typeof value.key === "string" && value.key.length > 0
  && value.key.length <= MAX_COMPILED_SUBJECT_KEY_LENGTH
  && value.key.trim() === value.key && SUBJECT_KEY.test(value.key);
const success = (subject: CompiledFixedSubject): CompiledSubjectResolutionResult => Object.freeze({ resolved: true, subject: Object.freeze({ type: subject.type, key: subject.key }) });
const fail = (code: Extract<CompiledSubjectResolutionResult, { resolved: false }>["code"]): CompiledSubjectResolutionResult => Object.freeze({ resolved: false, code });
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
