import type { Types } from "mongoose";

import type { PnlBasis, RiskMode } from "../../types/risk.types.js";
import type { CapitalAdjustmentType, TradePlanStatus } from "../../types/trade.types.js";

export type DashboardTradeResult = {
  _id: Types.ObjectId | string;
  activeTradeId?: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  symbolSnapshot?: {
    symbol?: string;
    displayName?: string;
  };
  direction?: string;
  entryPrice?: number;
  exitPrice?: number;
  quantity?: number;
  grossPnl?: number;
  netPnl?: number;
  realizedR?: number;
  resultType?: "WIN" | "LOSS" | "BREAKEVEN";
  exitReason?: string;
  status?: string;
  closedAt?: Date;
  pnlBasis?: PnlBasis;
};

export type DashboardRiskState = {
  riskMode?: RiskMode;
  totalTrades?: number;
  winCount?: number;
  lossCount?: number;
  breakevenCount?: number;
  netPnl?: number;
  grossPnl?: number;
  realizedR?: number;
};

export type DashboardDailyRiskState = {
  _id?: Types.ObjectId | string;
  riskMode?: RiskMode;
  netPnl?: number;
  grossPnl?: number;
  realizedR?: number;
  stopTradingTriggered?: boolean;
  dailyLossLimitHit?: boolean;
};

export type DashboardCapitalAdjustment = {
  adjustmentType: CapitalAdjustmentType;
  amount: number;
};

export type DashboardActiveTrade = {
  actualRiskAmount?: number;
};

export const toSafeNumber = (value: unknown): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

export const calculateTradePlanDashboardTotals = (
  plan: { startingCapital: number; currentCapital?: number },
  capitalAdjustments: DashboardCapitalAdjustment[],
  tradeResults: DashboardTradeResult[],
  openActiveTrades: DashboardActiveTrade[],
): {
  startingCapital: number;
  capitalBase: number;
  totalDeposits: number;
  totalWithdrawals: number;
  realizedGrossPnl: number;
  realizedNetPnl: number;
  currentCapital: number;
  availableCapital: number;
  openRiskAmount: number;
  pnlBasis: PnlBasis;
} => {
  const totalDeposits = capitalAdjustments.reduce((sum, event) => {
    return event.adjustmentType === "DEPOSIT" || event.adjustmentType === "TRANSFER_IN"
      ? sum + Math.abs(event.amount)
      : sum;
  }, 0);
  const totalWithdrawals = capitalAdjustments.reduce((sum, event) => {
    return event.adjustmentType === "WITHDRAWAL" || event.adjustmentType === "TRANSFER_OUT"
      ? sum + Math.abs(event.amount)
      : sum;
  }, 0);
  const realizedGrossPnl = tradeResults.reduce((sum, result) => sum + toSafeNumber(result.grossPnl), 0);
  const realizedNetPnl = tradeResults.reduce((sum, result) => {
    return sum + toSafeNumber(result.netPnl ?? result.grossPnl);
  }, 0);
  const allResultsHaveNetPnl = tradeResults.every((result) => typeof result.netPnl === "number");
  const anyResultHasNetPnl = tradeResults.some((result) => typeof result.netPnl === "number");
  const pnlBasis: PnlBasis = tradeResults.length === 0 || allResultsHaveNetPnl
    ? "CONFIRMED_NET"
    : anyResultHasNetPnl
      ? "ESTIMATED_NET"
      : "GROSS_FALLBACK";
  const capitalBase = plan.currentCapital ?? plan.startingCapital;
  const currentCapital = capitalBase + realizedNetPnl;
  const openRiskAmount = openActiveTrades.reduce(
    (sum, trade) => sum + toSafeNumber(trade.actualRiskAmount),
    0,
  );

  return {
    startingCapital: plan.startingCapital,
    capitalBase,
    totalDeposits,
    totalWithdrawals,
    realizedGrossPnl,
    realizedNetPnl,
    currentCapital,
    availableCapital: Math.max(currentCapital - openRiskAmount, 0),
    openRiskAmount,
    pnlBasis,
  };
};

export const getTradePlanDashboardBlockReasons = (input: {
  planStatus: TradePlanStatus;
  remainingTrades: number | null;
  riskMode: RiskMode;
  dailyStopTradingTriggered: boolean;
}): string[] => {
  const blockReasons: string[] = [];
  if (input.planStatus !== "ACTIVE") blockReasons.push("TRADE_PLAN_NOT_ACTIVE");
  if (input.riskMode === "STOP_TRADING") blockReasons.push("STOP_TRADING_ACTIVE");
  if (input.dailyStopTradingTriggered) blockReasons.push("DAILY_STOP_TRADING_ACTIVE");
  if (input.remainingTrades !== null && input.remainingTrades <= 0) {
    blockReasons.push("MAX_TRADES_REACHED");
  }
  return blockReasons;
};

export const getTradePlanStopTradingReasons = (
  riskMode: RiskMode,
  dailyRiskState: DashboardDailyRiskState | null,
): string[] => {
  const reasons: string[] = [];
  if (riskMode === "STOP_TRADING") reasons.push("Plan risk limit reached.");
  if (dailyRiskState?.dailyLossLimitHit === true) reasons.push("Daily loss limit reached.");
  if (dailyRiskState?.stopTradingTriggered === true) {
    reasons.push("Daily stop trading lock is active.");
  }
  return reasons.length > 0
    ? reasons
    : riskMode === "STOP_TRADING"
      ? ["Plan risk limit reached."]
      : [];
};

export const projectTradePlanPerformance = (tradeResults: DashboardTradeResult[]) => {
  const wins = tradeResults.filter((result) => result.resultType === "WIN").length;
  const losses = tradeResults.filter((result) => result.resultType === "LOSS").length;
  const breakeven = tradeResults.filter((result) => result.resultType === "BREAKEVEN").length;
  const totalClosedTrades = tradeResults.length;
  const totalRealizedR = tradeResults.reduce((sum, result) => sum + toSafeNumber(result.realizedR), 0);
  return {
    totalClosedTrades,
    wins,
    losses,
    breakeven,
    winRate: totalClosedTrades > 0 ? (wins / totalClosedTrades) * 100 : 0,
    averageR: totalClosedTrades > 0 ? totalRealizedR / totalClosedTrades : 0,
    totalRealizedR,
  };
};

export const projectLatestTradeResults = (tradeResults: DashboardTradeResult[]) => {
  return tradeResults.slice(0, 10).map((result) => ({
    tradeResultId: String(result._id),
    activeTradeId: result.activeTradeId ? String(result.activeTradeId) : undefined,
    symbol: result.symbolSnapshot?.symbol,
    displayName: result.symbolSnapshot?.displayName,
    direction: result.direction,
    entryPrice: result.entryPrice,
    exitPrice: result.exitPrice,
    quantity: result.quantity,
    grossPnl: result.grossPnl,
    netPnl: result.netPnl,
    realizedR: result.realizedR,
    resultType: result.resultType,
    exitReason: result.exitReason,
    closedAt: result.closedAt,
  }));
};
