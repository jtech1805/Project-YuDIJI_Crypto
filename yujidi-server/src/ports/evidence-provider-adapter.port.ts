import type { EvidenceCandidate } from "../types/evidence-ingestion.types.js";

export interface EvidenceProviderAdapter {
  readonly adapterId: string;
  readCandidates(): Promise<readonly EvidenceCandidate[]>;
}
