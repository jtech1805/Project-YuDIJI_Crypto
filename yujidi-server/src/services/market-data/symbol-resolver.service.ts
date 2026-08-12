import type { Types } from "mongoose";

import { SymbolModel } from "../../models/Symbol.js";
import type {
  Exchange,
  InstrumentType,
  MarketProvider,
} from "../../types/market-data.types.js";

const ACTIVE_SYMBOL_STATUSES = ["ACTIVE", "TRADING"];

export type SymbolResolverConfidence = "HIGH" | "MEDIUM" | "LOW";

export type SymbolResolverReasonCode =
  | "MATCHED_BY_INSTRUMENT_TOKEN"
  | "MATCHED_BY_PROVIDER_SYMBOL"
  | "NO_MAPPING_FOUND"
  | "AMBIGUOUS_MAPPING"
  | "INSTRUMENT_TYPE_MISMATCH"
  | "SYMBOL_INACTIVE";

export type ResolveCanonicalSymbolInput = {
  provider: MarketProvider;
  exchange: Exchange;
  providerSymbol?: string;
  instrumentToken?: string;
  instrumentType?: InstrumentType;
};

export type ResolveCanonicalSymbolResult = {
  resolved: boolean;
  symbolId?: string;
  confidence: SymbolResolverConfidence;
  reasonCode: SymbolResolverReasonCode;
};

type SymbolResolverDocument = {
  _id?: Types.ObjectId | { toString(): string };
  status?: string;
  instrumentType?: string;
};

type SymbolResolverRepository = {
  find: (filter: Record<string, unknown>) => {
    lean: () => {
      exec: () => Promise<SymbolResolverDocument[]>;
    };
  };
};

type SymbolResolverDependencies = {
  symbolRepository: SymbolResolverRepository;
};

export class SymbolResolverService {
  public constructor(private readonly dependencies: Partial<SymbolResolverDependencies> = {}) {}

  public async resolveCanonicalSymbol(
    input: ResolveCanonicalSymbolInput,
  ): Promise<ResolveCanonicalSymbolResult> {
    const instrumentToken = input.instrumentToken?.trim();
    if (instrumentToken) {
      const tokenResult = await this.resolveByQuery(
        {
          provider: input.provider,
          exchange: input.exchange,
          instrumentToken,
        },
        input.instrumentType,
        "MATCHED_BY_INSTRUMENT_TOKEN",
        "HIGH",
      );
      if (tokenResult.resolved || tokenResult.reasonCode !== "NO_MAPPING_FOUND") {
        return tokenResult;
      }
    }

    const providerSymbol = input.providerSymbol?.trim().toUpperCase();
    if (providerSymbol) {
      return this.resolveByQuery(
        {
          provider: input.provider,
          exchange: input.exchange,
          providerSymbol,
        },
        input.instrumentType,
        "MATCHED_BY_PROVIDER_SYMBOL",
        "MEDIUM",
      );
    }

    return {
      resolved: false,
      confidence: "LOW",
      reasonCode: "NO_MAPPING_FOUND",
    };
  }

  private async resolveByQuery(
    query: Record<string, unknown>,
    requestedInstrumentType: InstrumentType | undefined,
    matchedReasonCode: Extract<SymbolResolverReasonCode, "MATCHED_BY_INSTRUMENT_TOKEN" | "MATCHED_BY_PROVIDER_SYMBOL">,
    confidence: SymbolResolverConfidence,
  ): Promise<ResolveCanonicalSymbolResult> {
    const candidates = await this.getSymbolRepository().find(query).lean().exec();
    if (candidates.length === 0) {
      return {
        resolved: false,
        confidence: "LOW",
        reasonCode: "NO_MAPPING_FOUND",
      };
    }

    const activeCandidates = candidates.filter((candidate) => (
      typeof candidate.status === "string" && ACTIVE_SYMBOL_STATUSES.includes(candidate.status)
    ));
    if (activeCandidates.length === 0) {
      return {
        resolved: false,
        confidence: "LOW",
        reasonCode: "SYMBOL_INACTIVE",
      };
    }

    const typeMatchedCandidates = requestedInstrumentType
      ? activeCandidates.filter((candidate) => candidate.instrumentType === requestedInstrumentType)
      : activeCandidates;

    if (typeMatchedCandidates.length === 0) {
      return {
        resolved: false,
        confidence: "LOW",
        reasonCode: "INSTRUMENT_TYPE_MISMATCH",
      };
    }

    if (typeMatchedCandidates.length > 1) {
      return {
        resolved: false,
        confidence: "LOW",
        reasonCode: "AMBIGUOUS_MAPPING",
      };
    }

    const [symbol] = typeMatchedCandidates;
    const symbolId = symbol?._id?.toString();
    if (!symbolId) {
      return {
        resolved: false,
        confidence: "LOW",
        reasonCode: "NO_MAPPING_FOUND",
      };
    }

    return {
      resolved: true,
      symbolId,
      confidence,
      reasonCode: matchedReasonCode,
    };
  }

  private getSymbolRepository(): SymbolResolverRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }
}
