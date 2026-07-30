import type { EvidenceFactorCompatibilityService } from "./evidence-factor-compatibility.service.js";
import type { FactorRegistry } from "../types/factor-registry.types.js";
import type {
  EvidenceSourceAuthorityRegistry,
  EvidenceSourceCandidateDisposition,
  EvidenceSourceCandidateTrace,
  EvidenceSourceResolutionFailureCode,
  EvidenceSourceResolutionRequest,
  EvidenceSourceResolutionResult,
} from "../types/evidence-source-resolution.types.js";
import { MAX_EVIDENCE_SOURCE_CANDIDATES } from "../types/evidence-source-resolution.types.js";

export type EvidenceSourceResolutionDependencies = {
  compatibilityService: Pick<EvidenceFactorCompatibilityService, "evaluate">;
  factorRegistry: Pick<FactorRegistry, "get">;
  sourceAuthorityRegistry: Pick<EvidenceSourceAuthorityRegistry, "getPriority">;
};

type Candidate = {
  raw: unknown;
  evidenceId: string;
  factorKey: string;
  subjectType: string;
  subjectKey: string;
  sourceType: string;
  provider: string;
  sourceId: string;
  observedAt: Date;
  confidence: number | null;
  priority: number | null;
  compatibility: ReturnType<EvidenceFactorCompatibilityService["evaluate"]>;
};

export class EvidenceSourceResolutionService {
  public constructor(private readonly dependencies: EvidenceSourceResolutionDependencies) {}

  public resolve(request: EvidenceSourceResolutionRequest): EvidenceSourceResolutionResult {
    const validRequest = validateRequest(request);
    if (!validRequest) return noSelection(null, null, null, "INVALID_REQUEST", []);
    const asOf = validDate(request.asOf) ? structuredClone(request.asOf) : null;
    if (!asOf) return noSelection(request.factorKey, request.subject, null, "INVALID_AS_OF", []);
    if (!request.completeness.complete
      || request.completeness.baseTruncated
      || request.completeness.relationshipTruncated) {
      return noSelection(request.factorKey, request.subject, asOf, "INCOMPLETE_EVIDENCE_HISTORY", []);
    }
    if (request.observations.length > MAX_EVIDENCE_SOURCE_CANDIDATES) {
      return noSelection(request.factorKey, request.subject, asOf, "TOO_MANY_CANDIDATES", []);
    }
    if (request.factorKey !== "MARKET.PRICE"
      || !this.dependencies.factorRegistry.get(request.factorKey)) {
      return noSelection(request.factorKey, request.subject, asOf, "UNSUPPORTED_FACTOR", []);
    }

    const extracted: Omit<Candidate, "priority" | "compatibility">[] = [];
    const ids = new Set<string>();
    for (const raw of request.observations) {
      const candidate = extractCandidate(raw);
      if (!candidate || ids.has(candidate.evidenceId)) {
        return noSelection(request.factorKey, request.subject, asOf, "INVALID_REQUEST", []);
      }
      ids.add(candidate.evidenceId);
      if (candidate.factorKey !== request.factorKey) {
        return noSelection(request.factorKey, request.subject, asOf, "MIXED_FACTOR_KEYS", []);
      }
      if (candidate.subjectType !== request.subject.type || candidate.subjectKey !== request.subject.key) {
        return noSelection(request.factorKey, request.subject, asOf, "MIXED_SUBJECTS", []);
      }
      extracted.push(candidate);
    }

    const candidates: Candidate[] = extracted.map((candidate) => ({
      ...candidate,
      priority: this.dependencies.sourceAuthorityRegistry.getPriority({
        factorKey: candidate.factorKey,
        sourceType: candidate.sourceType,
        provider: candidate.provider,
      }),
      compatibility: this.dependencies.compatibilityService.evaluate({
        evidence: candidate.raw,
        asOf,
        ...(request.allowDeprecatedFactor === undefined
          ? {} : { allowDeprecatedFactor: request.allowDeprecatedFactor }),
      }),
    }));
    const compatible = candidates.filter((candidate) => candidate.compatibility.compatible);
    compatible.sort(rank);
    if (compatible.length === 0) {
      return noSelection(request.factorKey, request.subject, asOf, "NO_COMPATIBLE_EVIDENCE",
        freezeTrace(candidates.sort((a, b) => compare(a.evidenceId, b.evidenceId))
          .map((candidate) => trace(candidate, "INCOMPATIBLE"))));
    }
    const winner = compatible[0]!;
    if (compatible[1] && rank(winner, compatible[1]) === 0) {
      return noSelection(request.factorKey, request.subject, asOf, "UNRESOLVED_CONFLICT", []);
    }
    const compatibleTraces = compatible.map((candidate, index) =>
      trace(candidate, index === 0 ? "SELECTED" : disposition(candidate, winner)));
    const incompatibleTraces = candidates
      .filter((candidate) => !candidate.compatibility.compatible)
      .sort((a, b) => compare(a.evidenceId, b.evidenceId))
      .map((candidate) => trace(candidate, "INCOMPATIBLE"));
    const selectedCompatibility = winner.compatibility;
    if (!selectedCompatibility.compatible) throw new TypeError("unreachable");
    return {
      resolved: true,
      factorKey: selectedCompatibility.factorKey,
      subject: Object.freeze({ type: winner.subjectType, key: winner.subjectKey }),
      asOf: structuredClone(asOf),
      factorDefinitionVersion: selectedCompatibility.factorDefinitionVersion,
      selectedEvidenceId: winner.evidenceId,
      selectedSource: Object.freeze({
        sourceType: winner.sourceType,
        provider: winner.provider,
        sourceId: winner.sourceId,
        priority: winner.priority,
      }),
      selectedObservedAt: structuredClone(winner.observedAt),
      selectedConfidence: winner.confidence,
      trace: freezeTrace([...compatibleTraces, ...incompatibleTraces]),
    };
  }
}

const validateRequest = (request: unknown): request is EvidenceSourceResolutionRequest => {
  if (!record(request) || !trimmed(request.factorKey) || !record(request.subject)
    || !trimmed(request.subject.type) || !trimmed(request.subject.key)
    || !Array.isArray(request.observations) || !record(request.completeness)
    || (request.allowDeprecatedFactor !== undefined
      && typeof request.allowDeprecatedFactor !== "boolean")) return false;
  return ["complete", "baseTruncated", "relationshipTruncated"]
    .every((key) => typeof request.completeness[key] === "boolean");
};
const extractCandidate = (raw: unknown): Omit<Candidate, "priority" | "compatibility"> | null => {
  if (!record(raw) || !trimmed(raw.evidenceId) || !trimmed(raw.factorKey)
    || !record(raw.subject) || !trimmed(raw.subject.type) || !trimmed(raw.subject.key)
    || !record(raw.provenance) || !trimmed(raw.provenance.sourceType)
    || !trimmed(raw.provenance.provider) || !validDate(raw.observedAt)) return null;
  if (raw.provenance.sourceName !== undefined && !trimmed(raw.provenance.sourceName)) return null;
  if (raw.confidence !== undefined
    && (typeof raw.confidence !== "number" || !Number.isFinite(raw.confidence)
      || raw.confidence < 0 || raw.confidence > 1)) return null;
  return {
    raw,
    evidenceId: raw.evidenceId,
    factorKey: raw.factorKey,
    subjectType: raw.subject.type,
    subjectKey: raw.subject.key,
    sourceType: raw.provenance.sourceType,
    provider: raw.provenance.provider,
    sourceId: raw.provenance.sourceName ?? raw.provenance.provider,
    observedAt: raw.observedAt,
    confidence: raw.confidence ?? null,
  };
};
const rank = (a: Candidate, b: Candidate) =>
  (a.priority === null ? 1 : 0) - (b.priority === null ? 1 : 0)
  || (a.priority ?? 0) - (b.priority ?? 0)
  || b.observedAt.getTime() - a.observedAt.getTime()
  || compareConfidence(b.confidence, a.confidence)
  || compare(a.provider, b.provider)
  || compare(a.sourceId, b.sourceId)
  || compare(a.evidenceId, b.evidenceId);
const compareConfidence = (a: number | null, b: number | null) =>
  a === null ? (b === null ? 0 : -1) : b === null ? 1 : a - b;
const disposition = (candidate: Candidate, winner: Candidate): EvidenceSourceCandidateDisposition => {
  if ((candidate.priority === null) !== (winner.priority === null)
    || candidate.priority !== winner.priority) return "LOWER_SOURCE_PRIORITY";
  if (candidate.observedAt.getTime() !== winner.observedAt.getTime()) return "OLDER_OBSERVATION";
  if (candidate.confidence !== winner.confidence) return "LOWER_CONFIDENCE";
  return "TIE_BREAK_LOST";
};
const trace = (candidate: Candidate, dispositionValue: EvidenceSourceCandidateDisposition):
EvidenceSourceCandidateTrace => Object.freeze({
  evidenceId: candidate.evidenceId,
  factorKey: candidate.factorKey,
  subjectType: candidate.subjectType,
  subjectKey: candidate.subjectKey,
  sourceType: candidate.sourceType,
  provider: candidate.provider,
  sourceId: candidate.sourceId,
  observedAt: structuredClone(candidate.observedAt),
  confidence: candidate.confidence,
  compatibility: candidate.compatibility.compatible
    ? Object.freeze({
        compatible: true,
        factorDefinitionVersion: candidate.compatibility.factorDefinitionVersion,
        freshnessStatus: candidate.compatibility.freshness.status,
      })
    : Object.freeze({ compatible: false, code: candidate.compatibility.code }),
  sourcePriority: candidate.priority,
  disposition: dispositionValue,
});
const freezeTrace = (items: EvidenceSourceCandidateTrace[]) => Object.freeze(items);
const noSelection = (
  factorKey: string | null,
  subject: { type: string; key: string } | null,
  asOf: Date | null,
  code: EvidenceSourceResolutionFailureCode,
  traceItems: readonly EvidenceSourceCandidateTrace[],
): EvidenceSourceResolutionResult => ({
  resolved: false,
  factorKey,
  subject: subject ? Object.freeze({ ...subject }) : null,
  asOf: asOf ? structuredClone(asOf) : null,
  code,
  trace: Object.freeze([...traceItems]),
});
const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const trimmed = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const validDate = (value: unknown): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
