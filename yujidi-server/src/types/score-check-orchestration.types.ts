import type { InstrumentType, MarketType } from "./market-data.types.js";
import type { TradeDirection } from "./trade.types.js";

export const SCORE_CHECK_EXECUTION_MODES = Object.freeze([
  "LEGACY",
  "SHADOW",
  "COMPILED",
] as const);
export type ScoreCheckExecutionMode = (typeof SCORE_CHECK_EXECUTION_MODES)[number];

export const SCORE_CHECK_EXECUTION_STAGES = Object.freeze([
  "REQUEST_VALIDATION",
  "TEMPLATE_RESOLUTION",
  "RULEBOOK_RESOLUTION",
  "INSTRUMENT_VALIDATION",
  "TRADE_GEOMETRY_VALIDATION",
  "SUBJECT_RESOLUTION",
  "PROVIDER_RESOLUTION",
  "EVIDENCE_COLLECTION",
  "EVIDENCE_SELECTION",
  "FACTOR_EVALUATION",
  "CROSS_FACTOR_PROCESSING",
  "DECISION_DERIVATION",
  "LEGACY_SCORING",
  "PERSISTENCE",
  "AUDIT",
  "SNAPSHOT_CREATION",
  "RESPONSE_PROJECTION",
] as const);
export type ScoreCheckExecutionStage = (typeof SCORE_CHECK_EXECUTION_STAGES)[number];

export const SCORE_CHECK_STAGE_STATES = Object.freeze([
  "PENDING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "SKIPPED",
] as const);
export type ScoreCheckStageState = (typeof SCORE_CHECK_STAGE_STATES)[number];

export const FACTOR_REQUIREMENT_LEVELS = Object.freeze([
  "MANDATORY",
  "OPTIONAL",
] as const);
export type FactorRequirementLevel = (typeof FACTOR_REQUIREMENT_LEVELS)[number];

export const SCORE_CHECK_EXECUTION_STATUSES = Object.freeze([
  "COMPLETED",
  "PARTIAL",
  "FAILED",
] as const);
export type ScoreCheckExecutionStatus = (typeof SCORE_CHECK_EXECUTION_STATUSES)[number];

export type ScoreCheckStageReport = Readonly<{
  stage: ScoreCheckExecutionStage;
  state: ScoreCheckStageState;
  code: string | null;
}>;

export type ScoreCheckTemplateSelection =
  | Readonly<{ templateId: string; templateKey: null; requestedTemplateVersion: number | null }>
  | Readonly<{ templateId: null; templateKey: string; requestedTemplateVersion: number | null }>;

export type ScoreCheckTradeGeometry = Readonly<{
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number | null;
}>;

export type ScoreCheckExecutionRequest = Readonly<{
  requestId: string;
  idempotencyKey: string;
  userId: string;
  template: ScoreCheckTemplateSelection;
  instrumentId: string;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  tradeDirection: TradeDirection;
  tradeGeometry: ScoreCheckTradeGeometry;
  executionMode: ScoreCheckExecutionMode;
  asOf: Date;
}>;

export type ScoreCheckTemplateLineage = Readonly<{
  templateId: string;
  templateKey: string;
  templateVersion: number;
  templateScope: "SYSTEM" | "USER";
}>;

export type ScoreCheckRulebookLineage = Readonly<{
  rulebookId: string;
  rulebookVersion: number;
  sourceTemplateId: string;
  sourceTemplateVersion: number;
}>;

export type ScoreCheckProviderResolutionProjection = Readonly<{
  factorKey: string;
  requestedProviderKey: string;
  selectedProviderKey: string | null;
  resolutionStatus: string;
  confidenceAdjustment: number;
  warningCodes: readonly string[];
}>;

export type ScoreCheckFactorResultProjection = Readonly<{
  factorKey: string;
  subjectKey: string;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  rawAggregate: number;
  normalizedScore: number;
  classification: string;
}>;

export type ScoreCheckCompiledResult = Readonly<{
  providerResolutions: readonly ScoreCheckProviderResolutionProjection[];
  evidenceIds: readonly string[];
  factorResults: readonly ScoreCheckFactorResultProjection[];
  crossFactorResult: Readonly<Record<string, unknown>> | null;
  decision: Readonly<Record<string, unknown>> | null;
}>;

export type ScoreCheckExecutionResult = Readonly<{
  scoreCheckId: string | null;
  requestId: string;
  executionMode: ScoreCheckExecutionMode;
  status: ScoreCheckExecutionStatus;
  templateLineage: ScoreCheckTemplateLineage;
  rulebookLineage: ScoreCheckRulebookLineage | null;
  instrumentId: string;
  asOf: Date;
  legacyResult: Readonly<Record<string, unknown>> | null;
  compiledResult: ScoreCheckCompiledResult | null;
  stages: readonly ScoreCheckStageReport[];
}>;

export type ResolvedFactorSubject = Readonly<{
  factorKey: string;
  subjectType: string;
  subjectKey: string;
  requirementLevel: FactorRequirementLevel;
}>;

export type FactorEvidenceCoordinationResult = Readonly<{
  factorKey: string;
  subjectKey: string;
  providerResolution: ScoreCheckProviderResolutionProjection;
  evidenceId: string | null;
  status: "AVAILABLE" | "UNAVAILABLE" | "FAILED";
}>;

export interface ScoreCheckTemplateResolverPort {
  resolve(request: ScoreCheckExecutionRequest): Promise<ScoreCheckTemplateLineage>;
}

export interface CompiledRulebookResolverPort {
  resolve(template: ScoreCheckTemplateLineage): Promise<ScoreCheckRulebookLineage | null>;
}

export interface FactorSubjectResolverPort {
  resolve(input: Readonly<{
    rulebook: ScoreCheckRulebookLineage;
    instrumentId: string;
    asOf: Date;
  }>): Promise<readonly ResolvedFactorSubject[]>;
}

export interface FactorEvidenceCoordinatorPort {
  collect(input: Readonly<{
    subject: ResolvedFactorSubject;
    asOf: Date;
  }>): Promise<FactorEvidenceCoordinationResult>;
}

export interface FactorPipelineCoordinatorPort {
  evaluate(input: Readonly<{
    subject: ResolvedFactorSubject;
    evidenceId: string;
    asOf: Date;
  }>): Promise<ScoreCheckFactorResultProjection>;
}

export interface CrossFactorCoordinatorPort {
  process(factors: readonly ScoreCheckFactorResultProjection[]): Promise<Readonly<Record<string, unknown>>>;
}

export interface DecisionCoordinatorPort {
  derive(input: Readonly<{
    factors: readonly ScoreCheckFactorResultProjection[];
    crossFactorResult: Readonly<Record<string, unknown>>;
  }>): Promise<Readonly<Record<string, unknown>>>;
}

export interface LegacyScoreCheckExecutorPort {
  execute(request: ScoreCheckExecutionRequest): Promise<Readonly<Record<string, unknown>>>;
}

export interface ScoreCheckPersistencePort {
  persist(result: ScoreCheckExecutionResult): Promise<Readonly<{ scoreCheckId: string }>>;
}

export interface ScoreCheckAuditPort {
  record(input: Readonly<{
    scoreCheckId: string;
    result: ScoreCheckExecutionResult;
  }>): Promise<void>;
}

export interface ScoreCheckSnapshotPort {
  create(input: Readonly<{
    scoreCheckId: string;
    result: ScoreCheckExecutionResult;
  }>): Promise<Readonly<{ snapshotId: string; expiresAt: Date }>>;
}
