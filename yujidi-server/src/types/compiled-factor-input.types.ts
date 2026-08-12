import type { CompiledFixedSubject, CompiledFactorDefinitionLineage } from "./compiled-rulebook.types.js";
import type { CompiledShadowObservation } from "./compiled-shadow-observation.types.js";

export type CompiledInputFreshness =
  | Readonly<{ status: "FRESH"; ageMs: number; maxAgeMs: number }>
  | Readonly<{ status: "NOT_APPLICABLE"; policy: "VALIDITY_INTERVAL" | "NON_EXPIRING" }>;

export type CompiledFactorInput = Readonly<{
  factor: CompiledFactorDefinitionLineage;
  subject: CompiledFixedSubject;
  value: Readonly<{ type: "NUMBER"; value: number; unit: string }>;
  observedAt: Date;
  evaluatedAt: Date;
  confidence: number | null;
  freshness: CompiledInputFreshness;
  providerAttestation: CompiledShadowObservation["providerAttestation"];
}>;

