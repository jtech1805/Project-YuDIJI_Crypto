import { COMPILED_BINDING_INPUT_STATES, type CompiledBindingDispositionResult, type CompiledBindingInputState } from "../types/compiled-rulebook-runtime.types.js";
import type { CompiledFactorBinding } from "../types/compiled-rulebook.types.js";
export class CompiledBindingDispositionService {
  public derive(binding: unknown, inputState: unknown): CompiledBindingDispositionResult {
    if (!validBinding(binding) || !COMPILED_BINDING_INPUT_STATES.includes(inputState as CompiledBindingInputState)) return failure();
    if (inputState === "AVAILABLE") return Object.freeze({ derived: true, disposition: "INCLUDED" });
    if (binding.requirementLevel === "MANDATORY") return Object.freeze({ derived: true, disposition: "BLOCKING" });
    return Object.freeze({ derived: true, disposition: binding.optionalBehavior === "PARTIAL" ? "PARTIAL" : "OMITTED" });
  }
}
const validBinding = (value: unknown): value is CompiledFactorBinding => typeof value === "object" && value !== null && !Array.isArray(value) && ((value as any).requirementLevel === "MANDATORY" ? (value as any).optionalBehavior === null : (value as any).requirementLevel === "OPTIONAL" && ((value as any).optionalBehavior === "PARTIAL" || (value as any).optionalBehavior === "OMIT"));
const failure = (): CompiledBindingDispositionResult => Object.freeze({ derived: false, code: "INVALID_COMPILED_BINDING_OUTCOME" });
