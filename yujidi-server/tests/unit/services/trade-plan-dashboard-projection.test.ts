import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTradePlanDashboardTotals,
  getTradePlanDashboardBlockReasons,
  getTradePlanStopTradingReasons,
  projectLatestTradeResults,
  projectTradePlanPerformance,
  toSafeNumber,
  type DashboardTradeResult,
} from "../../../src/services/trading/trade-plan-dashboard-projection.js";

const result = (
  id: string,
  overrides: Partial<DashboardTradeResult> = {},
): DashboardTradeResult => ({
  _id: id,
  tradePlanId: "plan-1",
  ...overrides,
});

test("dashboard totals preserve deposits, withdrawals, PnL basis and available capital arithmetic", () => {
  assert.deepEqual(
    calculateTradePlanDashboardTotals(
      { startingCapital: 1_000, currentCapital: 1_100 },
      [
        { adjustmentType: "DEPOSIT", amount: 200 },
        { adjustmentType: "TRANSFER_IN", amount: -50 },
        { adjustmentType: "WITHDRAWAL", amount: -75 },
        { adjustmentType: "TRANSFER_OUT", amount: 25 },
      ],
      [
        result("result-1", { grossPnl: 100, netPnl: 80 }),
        result("result-2", { grossPnl: -50 }),
      ],
      [{ actualRiskAmount: 120 }, { actualRiskAmount: Number.NaN }],
    ),
    {
      startingCapital: 1_000,
      capitalBase: 1_100,
      totalDeposits: 250,
      totalWithdrawals: 100,
      realizedGrossPnl: 50,
      realizedNetPnl: 30,
      currentCapital: 1_130,
      availableCapital: 1_010,
      openRiskAmount: 120,
      pnlBasis: "ESTIMATED_NET",
    },
  );
});

test("dashboard totals preserve confirmed, estimated and gross fallback classification", () => {
  const input = { startingCapital: 100 };
  assert.equal(calculateTradePlanDashboardTotals(input, [], [], []).pnlBasis, "CONFIRMED_NET");
  assert.equal(
    calculateTradePlanDashboardTotals(input, [], [result("a", { netPnl: 1 })], []).pnlBasis,
    "CONFIRMED_NET",
  );
  assert.equal(
    calculateTradePlanDashboardTotals(input, [], [result("a", { grossPnl: 1 })], []).pnlBasis,
    "GROSS_FALLBACK",
  );
});

test("dashboard block and stop-trading reasons retain their deterministic order", () => {
  assert.deepEqual(
    getTradePlanDashboardBlockReasons({
      planStatus: "PAUSED",
      remainingTrades: 0,
      riskMode: "STOP_TRADING",
      dailyStopTradingTriggered: true,
    }),
    [
      "TRADE_PLAN_NOT_ACTIVE",
      "STOP_TRADING_ACTIVE",
      "DAILY_STOP_TRADING_ACTIVE",
      "MAX_TRADES_REACHED",
    ],
  );
  assert.deepEqual(
    getTradePlanStopTradingReasons("STOP_TRADING", {
      dailyLossLimitHit: true,
      stopTradingTriggered: true,
    }),
    [
      "Plan risk limit reached.",
      "Daily loss limit reached.",
      "Daily stop trading lock is active.",
    ],
  );
  assert.deepEqual(getTradePlanStopTradingReasons("NORMAL_RISK", null), []);
});

test("performance and latest-trade projections preserve arithmetic, order and the ten-result bound", () => {
  const closedAt = new Date("2026-08-12T00:00:00.000Z");
  const results = Array.from({ length: 12 }, (_, index) => result(`result-${index}`, {
    activeTradeId: `active-${index}`,
    resultType: index === 0 ? "WIN" : index === 1 ? "LOSS" : "BREAKEVEN",
    ...(index === 0 ? { realizedR: 2 } : index === 1 ? { realizedR: -1 } : {}),
    closedAt,
  }));

  assert.deepEqual(projectTradePlanPerformance(results), {
    totalClosedTrades: 12,
    wins: 1,
    losses: 1,
    breakeven: 10,
    winRate: (1 / 12) * 100,
    averageR: 1 / 12,
    totalRealizedR: 1,
  });
  const latest = projectLatestTradeResults(results);
  assert.equal(latest.length, 10);
  assert.equal(latest[0]?.tradeResultId, "result-0");
  assert.equal(latest[9]?.tradeResultId, "result-9");
  assert.equal(latest[0]?.closedAt, closedAt);
});

test("safe numeric projection retains finite values and maps malformed values to zero", () => {
  assert.equal(toSafeNumber(-1.25), -1.25);
  assert.equal(toSafeNumber(Number.NaN), 0);
  assert.equal(toSafeNumber(Number.POSITIVE_INFINITY), 0);
  assert.equal(toSafeNumber("1"), 0);
});
