import { isDeepStrictEqual } from "node:util";
import type { KnowledgeVectorIndexWritePort } from "../../src/ports/knowledge-vector-index-write.port.js";
import type { KnowledgeVectorIndexEntry, KnowledgeVectorIndexWriteRequest, KnowledgeVectorIndexWriteResult } from "../../src/types/knowledge-vector-index-write.types.js";
import { freezeClone } from "../../src/services/knowledge-document-admission.service.js";

export class InMemoryKnowledgeVectorIndexWritePort implements KnowledgeVectorIndexWritePort {
  private readonly entries = new Map<string, KnowledgeVectorIndexEntry>();
  public calls = 0;

  public constructor(
    private readonly namespace: string,
    private readonly dimension: number,
    private readonly forceFailure = false,
  ) {}

  public async write(request: KnowledgeVectorIndexWriteRequest): Promise<KnowledgeVectorIndexWriteResult> {
    this.calls += 1;
    if (this.forceFailure) return Object.freeze({ status: "FAILED", failureCode: "TEST_WRITE_FAILED", acceptedEntryIds: [], rejectedEntryIds: request.entries.map((entry) => entry.identity.indexEntryId) });
    if (request.namespace !== this.namespace) return Object.freeze({ status: "FAILED", failureCode: "NAMESPACE_MISMATCH", acceptedEntryIds: [], rejectedEntryIds: request.entries.map((entry) => entry.identity.indexEntryId) });
    const accepted: string[] = [];
    const existing: string[] = [];
    for (const entry of request.entries) {
      if (entry.namespace !== request.namespace
        || entry.vector.length !== this.dimension
        || entry.vector.some((value) => !Number.isFinite(value))) {
        return Object.freeze({ status: "FAILED", failureCode: "INVALID_ENTRY", acceptedEntryIds: accepted, rejectedEntryIds: [entry.identity.indexEntryId] });
      }
      const key = `${request.indexDefinitionIdentity.indexId}:${request.indexDefinitionIdentity.indexVersion}:${request.namespace}:${entry.identity.indexEntryId}:${entry.identity.indexEntryVersion}`;
      const current = this.entries.get(key);
      if (current && !isDeepStrictEqual(current, entry)) {
        return Object.freeze({ status: "FAILED", failureCode: "ENTRY_CONTENT_CONFLICT", acceptedEntryIds: accepted, rejectedEntryIds: [entry.identity.indexEntryId] });
      }
      if (current) existing.push(entry.identity.indexEntryId);
      else {
        this.entries.set(key, freezeClone(entry));
        accepted.push(entry.identity.indexEntryId);
      }
    }
    return Object.freeze({ status: "COMPLETED", acceptedEntryIds: Object.freeze(accepted), existingEntryIds: Object.freeze(existing) });
  }

  public inspectExact(indexId: string, indexVersion: number, namespace: string): readonly KnowledgeVectorIndexEntry[] {
    const prefix = `${indexId}:${indexVersion}:${namespace}:`;
    return freezeClone([...this.entries.entries()].filter(([key]) => key.startsWith(prefix)).map(([, entry]) => entry).sort((a, b) => a.identity.indexEntryId.localeCompare(b.identity.indexEntryId)));
  }
}

