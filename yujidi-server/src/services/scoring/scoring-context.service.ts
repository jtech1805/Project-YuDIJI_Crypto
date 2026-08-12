import type { ScoringTemplateKey } from "../../types/scoring.types.js";
import {
  ScoringContextBuilderService,
  type ScoringContextBuildInput,
} from "./scoring-context-builder.service.js";

export type ScoringContextInput = {
  userId: string;
  symbolId?: string;
  symbol?: string;
  provider?: string;
  exchange?: string;
  instrumentToken?: string;
  indexSymbolId?: string;
  sectorSymbolId?: string;
  vixSymbolId?: string;
  templateKey?: ScoringTemplateKey;
  includeBuffers?: boolean;
  bufferLimit?: number;
};

export class ScoringContextService {
  private readonly builder: ScoringContextBuilderService;

  public constructor(
    dependencies: ConstructorParameters<typeof ScoringContextBuilderService>[0] = {},
  ) {
    this.builder = new ScoringContextBuilderService(dependencies);
  }

  public async getRealtimeContext(input: ScoringContextInput): Promise<Record<string, unknown>> {
    const builderInput: ScoringContextBuildInput = {
      userId: input.userId,
      ...(input.symbolId ? { symbolId: input.symbolId } : {}),
      ...(input.symbol ? { symbol: input.symbol } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.exchange ? { exchange: input.exchange } : {}),
      ...(input.instrumentToken ? { instrumentToken: input.instrumentToken } : {}),
      ...(input.templateKey ? { templateKey: input.templateKey } : {}),
      ...(input.includeBuffers !== undefined ? { includeBuffers: input.includeBuffers } : {}),
      ...(input.bufferLimit !== undefined ? { bufferLimit: input.bufferLimit } : {}),
      contextSymbolIds: {
        ...(input.indexSymbolId ? { indexSymbolId: input.indexSymbolId } : {}),
        ...(input.sectorSymbolId ? { sectorSymbolId: input.sectorSymbolId } : {}),
        ...(input.vixSymbolId ? { vixSymbolId: input.vixSymbolId } : {}),
      },
    };
    const built = await this.builder.build(builderInput);
    return built.response;
  }
}
