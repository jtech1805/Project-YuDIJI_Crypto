import type { InstrumentType, MarketType } from "./market-data.types.js";
import type { MissingDataPolicy, ScoringTemplateStatus, ScoringTemplateVisibility } from "./scoring.types.js";

export type TemplateCompilationEvaluatorSnapshotInput = Readonly<{
  evaluatorKey: string;
  label: string;
  weight: number;
  enabled: boolean;
  missingDataPolicy?: MissingDataPolicy;
  config?: Readonly<Record<string, unknown>>;
}>;

export type TemplateCompilationSectionSnapshotInput = Readonly<{
  sectionKey: string;
  weight: number;
  enabled: boolean;
  missingDataPolicy: MissingDataPolicy;
  evaluators: readonly TemplateCompilationEvaluatorSnapshotInput[];
}>;

export type TemplateCompilationSnapshotInput = Readonly<{
  templateId: string;
  templateVersion: number;
  templateKind: "SYSTEM" | "USER";
  status: ScoringTemplateStatus;
  visibility: ScoringTemplateVisibility | null;
  scope: Readonly<{
    marketType: MarketType;
    tradeStyle: string;
    instrumentType: InstrumentType;
    allowedTradableSymbols: readonly string[];
  }>;
  aggregationMode: "NORMALIZE_EXECUTED" | "WEIGHTED_SUM" | null;
  sections: readonly TemplateCompilationSectionSnapshotInput[];
}>;

export type CanonicalTemplateCompilationSnapshot = Readonly<{
  templateId: string;
  templateVersion: number;
  templateKind: "SYSTEM" | "USER";
  status: ScoringTemplateStatus;
  visibility: ScoringTemplateVisibility | null;
  scope: Readonly<{
    marketType: MarketType;
    tradeStyle: string;
    instrumentType: InstrumentType;
    allowedTradableSymbols: readonly string[];
  }>;
  aggregationMode: "NORMALIZE_EXECUTED" | "WEIGHTED_SUM" | null;
  sections: readonly Readonly<{
    sectionIndex: number;
    sectionKey: string;
    weight: number;
    enabled: boolean;
    missingDataPolicy: MissingDataPolicy;
    evaluators: readonly Readonly<{
      evaluatorIndex: number;
      evaluatorKey: string;
      label: string;
      weight: number;
      enabled: boolean;
      evaluatorMissingDataPolicy: MissingDataPolicy | null;
      config: Readonly<Record<string, unknown>> | null;
    }>[];
  }>[];
}>;

export type CanonicalTemplateSnapshotResult =
  | Readonly<{ valid: true; snapshot: CanonicalTemplateCompilationSnapshot; serialized: string; hash: string }>
  | Readonly<{ valid: false; code: "INVALID_TEMPLATE_SNAPSHOT_VALUE" | "TEMPLATE_SNAPSHOT_HASH_FAILED"; path: string }>;
