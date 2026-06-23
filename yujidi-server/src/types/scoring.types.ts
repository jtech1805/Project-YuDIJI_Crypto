import type { TradeDirection, TradePermission } from "./trade.types.js";

export const SCORE_MODES = [
  "STANDALONE_SCORE_CHECK",
  "TRADE_PLAN_SCORE",
] as const;
export type ScoreMode = (typeof SCORE_MODES)[number];

export type ScoreDecision = {
  score: number;
  permission: TradePermission;
  direction: TradeDirection;
  reasonCodes: string[];
};
