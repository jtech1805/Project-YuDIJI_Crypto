import type { KnowledgeChunkingStrategy } from "../types/knowledge-chunking.types.js";
import type { PlatformKnowledgeDocumentType } from "../types/knowledge-document.types.js";
export class KnowledgeChunkingStrategyRegistry {
  private readonly entries: ReadonlyMap<string, KnowledgeChunkingStrategy>;
  public constructor(strategies: readonly KnowledgeChunkingStrategy[]) {
    const map = new Map<string, KnowledgeChunkingStrategy>();
    for (const s of strategies) { const key = `${s.strategyId}:${s.strategyVersion}`; if (map.has(key)) throw new Error("DUPLICATE_KNOWLEDGE_CHUNKING_STRATEGY"); map.set(key, freezeStrategy(s)); }
    this.entries = map;
  }
  public getExact(strategyId: string, strategyVersion: number): KnowledgeChunkingStrategy | null { return this.entries.get(`${strategyId}:${strategyVersion}`) ?? null; }
  public supports(strategyId: string, strategyVersion: number, type: PlatformKnowledgeDocumentType): boolean { return this.getExact(strategyId, strategyVersion)?.supportedDocumentTypes.includes(type) ?? false; }
  public list(): readonly KnowledgeChunkingStrategy[] { return Object.freeze([...this.entries.values()].sort((a, b) => a.strategyId.localeCompare(b.strategyId) || a.strategyVersion - b.strategyVersion)); }
}
const freezeStrategy = (s: KnowledgeChunkingStrategy): KnowledgeChunkingStrategy => Object.freeze({ strategyId: s.strategyId, strategyVersion: s.strategyVersion, supportedDocumentTypes: Object.freeze([...s.supportedDocumentTypes]), chunk: s.chunk.bind(s) });
