import { createHash } from "node:crypto";

export type AnalyzerTriggerRelationship = "drop" | "spike";
export type AnalyzerTriggerDirection = "down" | "up";

type AnalyzerMonitorProjection = {
  _id: unknown;
  user: unknown;
  displayName?: unknown;
  provider?: unknown;
  marketType?: unknown;
  exchange?: unknown;
  instrumentToken?: unknown;
  providerSymbol?: unknown;
  timeWindowMinutes: number;
};

type AnalyzerReportProjection = {
  catalyst: unknown;
  threatLevel: unknown;
  support: unknown;
  resistance: unknown;
  summary: unknown;
};

type AnalyzerStructuralProjection = {
  support: string;
  resistance: string;
};

export const buildAnalyzerLlmTraceBase = (input: {
  traceId: string;
  correlationId: string;
  promptVersion: string;
  startedAt: Date;
  providerName: string;
  modelName?: string;
  symbol: string;
  monitorId: string;
  monitor: AnalyzerMonitorProjection;
  triggerType: AnalyzerTriggerRelationship;
  direction: AnalyzerTriggerDirection;
  changePercentage: number;
  currentPrice: number;
  currentCvd: number;
  newsContext: string;
  walls: AnalyzerStructuralProjection;
}) => {
  const redactedSummary = {
    provider: input.monitor.provider,
    marketType: input.monitor.marketType,
    exchange: input.monitor.exchange,
    triggerType: input.triggerType,
    direction: input.direction,
    timeWindowMinutes: input.monitor.timeWindowMinutes,
    newsContextLength: input.newsContext.length,
    supportAvailable: input.walls.support !== "Unknown",
    resistanceAvailable: input.walls.resistance !== "Unknown",
  };
  const hash = createHash("sha256").update(JSON.stringify({
    symbol: input.symbol,
    monitorId: input.monitorId,
    provider: input.monitor.provider,
    marketType: input.monitor.marketType,
    exchange: input.monitor.exchange,
    instrumentToken: input.monitor.instrumentToken,
    triggerType: input.triggerType,
    direction: input.direction,
    changePercentage: input.changePercentage,
    timeWindowMinutes: input.monitor.timeWindowMinutes,
    triggerPrice: input.currentPrice,
    cvdAtTrigger: input.currentCvd,
    newsContextLength: input.newsContext.length,
    supportAvailable: redactedSummary.supportAvailable,
    resistanceAvailable: redactedSummary.resistanceAvailable,
  })).digest("hex");

  return {
    traceId: input.traceId,
    correlationId: input.correlationId,
    taskType: "ALERT_REPORT" as const,
    userId: String(input.monitor.user),
    source: {
      entityType: "TRIPWIRE_MONITOR" as const,
      entityId: input.monitorId,
    },
    provider: input.providerName,
    ...(input.modelName ? { model: input.modelName } : {}),
    promptVersion: input.promptVersion,
    startedAt: input.startedAt,
    inputReference: {
      hash,
      redactedSummary,
    },
    fallbackUsed: false,
  };
};

export const buildAnalyzerAlertPayload = (input: {
  monitor: AnalyzerMonitorProjection;
  metadata?: Record<string, unknown>;
  symbol: string;
  currentPrice: number;
  previousPrice: number;
  movementMagnitude: number;
  changePercentage: number;
  triggerType: AnalyzerTriggerRelationship;
  direction: AnalyzerTriggerDirection;
  report: AnalyzerReportProjection;
  currentCvd: number;
  currentTimestamp: number;
}): Record<string, unknown> => ({
  user: input.monitor.user,
  monitor: input.monitor._id,
  symbol: input.symbol,
  displayName: input.monitor.displayName,
  provider: input.monitor.provider,
  marketType: input.monitor.marketType,
  exchange: input.monitor.exchange,
  instrumentToken: input.monitor.instrumentToken,
  providerSymbol: input.monitor.providerSymbol,
  ...input.metadata,
  triggerPrice: input.currentPrice,
  currentPrice: input.currentPrice,
  previousPrice: input.previousPrice,
  dropPercentage: input.movementMagnitude,
  changePercentage: input.changePercentage,
  triggerType: input.triggerType,
  direction: input.direction,
  catalyst: input.report.catalyst,
  threatLevel: input.report.threatLevel,
  support: input.report.support,
  resistance: input.report.resistance,
  summary: input.report.summary,
  cvdAtTrigger: input.currentCvd,
  createdAt: new Date(input.currentTimestamp),
});
