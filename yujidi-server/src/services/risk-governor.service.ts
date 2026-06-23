import type { RiskMode } from "../types/risk.types.js";
import type { TradePermission, TradePlanStatus } from "../types/trade.types.js";

export type RiskGovernorInput = {
  tradePlan: {
    status: TradePlanStatus;
    maxTrades?: number;
    maxConsecutiveLosses?: number;
  };
  tradePlanRiskState?: {
    riskMode?: RiskMode;
    totalTrades?: number;
    consecutiveLosses?: number;
  } | null;
  userDailyRiskState?: {
    stopTradingTriggered?: boolean;
  } | null;
  scorePermission: TradePermission;
  plannedRewardRiskRatio: number;
  evaluatedAt?: Date;
};

export type RiskGovernorDecision = {
  permission: TradePermission;
  riskMode: RiskMode;
  reasonCodes: string[];
  warnings: string[];
  evaluatedAt: Date;
};

const capToSmallRisk = (permission: TradePermission): TradePermission => {
  return permission === "TAKE_TRADE" ? "TAKE_SMALL_RISK" : permission;
};

export class RiskGovernorService {
  public evaluate(input: RiskGovernorInput): RiskGovernorDecision {
    const evaluatedAt = input.evaluatedAt ?? new Date();
    const riskMode = input.tradePlanRiskState?.riskMode ?? "NORMAL_RISK";
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    if (input.tradePlan.status !== "ACTIVE") {
      return {
        permission: "REJECT",
        riskMode,
        reasonCodes: ["TRADE_PLAN_NOT_ACTIVE", "FINAL_PERMISSION_REJECT"],
        warnings,
        evaluatedAt,
      };
    }

    if (riskMode === "STOP_TRADING") {
      return {
        permission: "STOP_TRADING",
        riskMode,
        reasonCodes: ["STOP_TRADING_ACTIVE"],
        warnings,
        evaluatedAt,
      };
    }

    if (input.userDailyRiskState?.stopTradingTriggered === true) {
      return {
        permission: "STOP_TRADING",
        riskMode,
        reasonCodes: ["DAILY_STOP_TRADING_ACTIVE"],
        warnings,
        evaluatedAt,
      };
    }

    if (
      input.tradePlan.maxConsecutiveLosses !== undefined
      && (input.tradePlanRiskState?.consecutiveLosses ?? 0) >= input.tradePlan.maxConsecutiveLosses
    ) {
      return {
        permission: "STOP_TRADING",
        riskMode,
        reasonCodes: ["CONSECUTIVE_LOSS_LIMIT_REACHED"],
        warnings,
        evaluatedAt,
      };
    }

    if (
      input.tradePlan.maxTrades !== undefined
      && (input.tradePlanRiskState?.totalTrades ?? 0) >= input.tradePlan.maxTrades
    ) {
      return {
        permission: "REJECT",
        riskMode,
        reasonCodes: ["MAX_TRADES_REACHED", "FINAL_PERMISSION_REJECT"],
        warnings,
        evaluatedAt,
      };
    }

    if (input.scorePermission === "REJECT") {
      return {
        permission: "REJECT",
        riskMode,
        reasonCodes: ["SCORE_PERMISSION_REJECTED", "FINAL_PERMISSION_REJECT"],
        warnings,
        evaluatedAt,
      };
    }

    if (input.plannedRewardRiskRatio < 1) {
      return {
        permission: "REJECT",
        riskMode,
        reasonCodes: ["RR_BELOW_MINIMUM", "FINAL_PERMISSION_REJECT"],
        warnings,
        evaluatedAt,
      };
    }

    if (riskMode === "MICRO_RISK" || riskMode === "REDUCED_RISK") {
      const cappedPermission = capToSmallRisk(input.scorePermission);
      reasonCodes.push(riskMode === "MICRO_RISK" ? "RISK_MODE_MICRO" : "RISK_MODE_REDUCED");
      reasonCodes.push(
        cappedPermission === "TAKE_SMALL_RISK"
          ? "FINAL_PERMISSION_TAKE_SMALL_RISK"
          : cappedPermission === "WAIT"
            ? "FINAL_PERMISSION_WAIT"
            : "FINAL_PERMISSION_REJECT",
      );
      warnings.push(`Risk mode ${riskMode} caps final permission.`);

      return {
        permission: cappedPermission,
        riskMode,
        reasonCodes,
        warnings,
        evaluatedAt,
      };
    }

    reasonCodes.push("RISK_MODE_NORMAL", "SCORE_PERMISSION_ACCEPTED");

    if (input.scorePermission === "TAKE_TRADE") {
      reasonCodes.push("FINAL_PERMISSION_TAKE_TRADE");
    } else if (input.scorePermission === "TAKE_SMALL_RISK") {
      reasonCodes.push("FINAL_PERMISSION_TAKE_SMALL_RISK");
    } else if (input.scorePermission === "WAIT") {
      reasonCodes.push("FINAL_PERMISSION_WAIT");
    }

    return {
      permission: input.scorePermission,
      riskMode,
      reasonCodes,
      warnings,
      evaluatedAt,
    };
  }
}
