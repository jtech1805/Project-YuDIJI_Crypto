import { createHash } from "node:crypto";

export type TradeJournalAiContext = {
  source: {
    tradeJournalId: string;
    tradePlanId: string;
    tradeSetupId: string;
    activeTradeId: string;
    tradeResultId: string;
  };
  instrument: {
    symbol: string;
    displayName: string;
    provider?: string;
    exchange?: string;
    marketType: string;
    instrumentType: string;
    tradeStyle: string;
    direction: string;
  };
  plannedTrade: {
    entry: number;
    stopLoss: number;
    target1: number;
    target2?: number;
    rewardRiskRatio: number;
  };
  actualTrade: {
    entry: number;
    quantity: number;
    initialStopLoss: number;
    finalStopLoss?: number;
    exitPrice: number;
    exitReason: string;
  };
  finalizedResult: {
    grossPnl: number;
    netPnl?: number;
    realizedPnlUsedForRisk: number;
    pnlBasis: string;
    realizedR: number;
    resultType: string;
    openedAt: Date | string;
    closedAt: Date | string;
  };
  processEvidence: {
    ruleViolations: string[];
    tradeEventCount: number;
    setupType?: string;
    entryQuality?: string;
    exitQuality?: string;
    outcomeQuality?: string;
    followedPlan?: boolean;
    mistakeTags: string[];
    emotionalStateBefore?: string;
    emotionalStateDuring?: string;
    emotionalStateAfter?: string;
    selfRating?: number;
    userNotes?: string;
    lessonLearned?: string;
    whatWentWell?: string;
    whatWentWrong?: string;
    nextTimeFocus?: string;
  };
};

type JournalRecord = Record<string, any>;

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const optionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const textArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export class AiTradeReviewContextService {
  public build(journal: JournalRecord): TradeJournalAiContext {
    const symbolSnapshot =
      journal.symbolSnapshot && typeof journal.symbolSnapshot === "object"
        ? journal.symbolSnapshot as Record<string, unknown>
        : {};

    const instrument: TradeJournalAiContext["instrument"] = {
      symbol: String(symbolSnapshot.symbol ?? ""),
      displayName: String(symbolSnapshot.displayName ?? symbolSnapshot.symbol ?? ""),
      marketType: String(journal.marketType),
      instrumentType: String(journal.instrumentType),
      tradeStyle: String(journal.tradeStyle),
      direction: String(journal.direction),
    };
    const provider = optionalText(symbolSnapshot.provider);
    const exchange = optionalText(symbolSnapshot.exchange);
    if (provider) instrument.provider = provider;
    if (exchange) instrument.exchange = exchange;

    const plannedTrade: TradeJournalAiContext["plannedTrade"] = {
      entry: Number(journal.plannedEntry),
      stopLoss: Number(journal.plannedStopLoss),
      target1: Number(journal.plannedTarget1),
      rewardRiskRatio: Number(journal.plannedRewardRiskRatio),
    };
    const target2 = optionalNumber(journal.plannedTarget2);
    if (target2 !== undefined) plannedTrade.target2 = target2;

    const actualTrade: TradeJournalAiContext["actualTrade"] = {
      entry: Number(journal.actualEntry),
      quantity: Number(journal.actualQuantity),
      initialStopLoss: Number(journal.initialStopLoss),
      exitPrice: Number(journal.exitPrice),
      exitReason: String(journal.exitReason),
    };
    const finalStopLoss = optionalNumber(journal.finalStopLoss);
    if (finalStopLoss !== undefined) actualTrade.finalStopLoss = finalStopLoss;

    const finalizedResult: TradeJournalAiContext["finalizedResult"] = {
      grossPnl: Number(journal.grossPnl),
      realizedPnlUsedForRisk: Number(journal.realizedPnlUsedForRisk),
      pnlBasis: String(journal.pnlBasis),
      realizedR: Number(journal.realizedR),
      resultType: String(journal.resultType),
      openedAt: journal.openedAt,
      closedAt: journal.closedAt,
    };
    const netPnl = optionalNumber(journal.netPnl);
    if (netPnl !== undefined) finalizedResult.netPnl = netPnl;

    const processEvidence: TradeJournalAiContext["processEvidence"] = {
      ruleViolations: textArray(journal.ruleViolations),
      tradeEventCount: Array.isArray(journal.tradeEventIds) ? journal.tradeEventIds.length : 0,
      mistakeTags: textArray(journal.mistakeTags),
    };
    const optionalTextFields = [
      "setupType",
      "entryQuality",
      "exitQuality",
      "outcomeQuality",
      "emotionalStateBefore",
      "emotionalStateDuring",
      "emotionalStateAfter",
      "userNotes",
      "lessonLearned",
      "whatWentWell",
      "whatWentWrong",
      "nextTimeFocus",
    ] as const;
    for (const field of optionalTextFields) {
      const value = optionalText(journal[field]);
      if (value) processEvidence[field] = value;
    }
    const followedPlan = optionalBoolean(journal.followedPlan);
    if (followedPlan !== undefined) processEvidence.followedPlan = followedPlan;
    const selfRating = optionalNumber(journal.selfRating);
    if (selfRating !== undefined) processEvidence.selfRating = selfRating;

    return {
      source: {
        tradeJournalId: String(journal._id),
        tradePlanId: String(journal.tradePlanId),
        tradeSetupId: String(journal.tradeSetupId),
        activeTradeId: String(journal.activeTradeId),
        tradeResultId: String(journal.tradeResultId),
      },
      instrument,
      plannedTrade,
      actualTrade,
      finalizedResult,
      processEvidence,
    };
  }

  public hash(context: TradeJournalAiContext): string {
    return createHash("sha256").update(JSON.stringify(context)).digest("hex");
  }
}
