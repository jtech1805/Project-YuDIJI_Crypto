import { z } from "zod";

import { INSTRUMENT_TYPES, MARKET_TYPES } from "../../types/market-data.types.js";
import {
  CAPITAL_ADJUSTMENT_TYPES,
  PLAN_MODES,
  REVIEW_CADENCES,
  type PlanMode,
} from "../../types/trade.types.js";

const validatePlanModeRules = (
  value: {
    planMode?: PlanMode | undefined;
    maxTrades?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
  },
  context: z.RefinementCtx,
): void => {
  if (value.planMode === "FIXED_TRADE_COUNT" && value.maxTrades === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxTrades"],
      message: "maxTrades is required for FIXED_TRADE_COUNT plans",
    });
  }

  if (value.planMode === "DATE_RANGE" && !value.endDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "endDate is required for DATE_RANGE plans",
    });
  }

  if (value.endDate && value.startDate && value.endDate <= value.startDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "endDate must be after startDate",
    });
  }
};

const baseTradePlanSchema = z.object({
  name: z.string().min(1).max(120).transform((value) => value.trim()),
  description: z.string().max(1000).optional(),
  marketType: z.enum(MARKET_TYPES),
  tradeStyle: z.string().min(1).max(64).transform((value) => value.trim().toUpperCase()),
  instrumentType: z.enum(INSTRUMENT_TYPES),
  planMode: z.enum(PLAN_MODES),
  startingCapital: z.number().positive(),
  currentCapital: z.number().nonnegative().optional(),
  currency: z.string().min(1).max(12).transform((value) => value.trim().toUpperCase()),
  maxRiskPerTradePercent: z.number().positive().max(10),
  maxDailyLossPercent: z.number().positive().max(20).optional(),
  maxConsecutiveLosses: z.number().int().min(1).optional(),
  maxTrades: z.number().int().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  reviewCadence: z.enum(REVIEW_CADENCES).optional(),
  scoringTemplateKey: z.string().min(1).max(120).optional(),
  scoringTemplateVersion: z.string().min(1).max(64).optional(),
  riskTemplateKey: z.string().min(1).max(120).optional(),
  riskTemplateVersion: z.string().min(1).max(64).optional(),
  monitoringTemplateKey: z.string().min(1).max(120).optional(),
  monitoringTemplateVersion: z.string().min(1).max(64).optional(),
});

export const createTradePlanSchema = baseTradePlanSchema.superRefine((value, context) => {
  validatePlanModeRules(value, context);
});

export const updateTradePlanSchema = baseTradePlanSchema.partial().superRefine((value, context) => {
  validatePlanModeRules(value, context);
});

export const capitalAdjustmentSchema = z.object({
  adjustmentType: z.enum(CAPITAL_ADJUSTMENT_TYPES),
  amount: z.number().refine((value) => value !== 0, "Amount cannot be zero"),
  currency: z.string().min(1).max(12).transform((value) => value.trim().toUpperCase()),
  reason: z.string().max(500).optional(),
});

export const resetRiskLockSchema = z.object({
  reason: z.string().min(1).max(500).transform((value) => value.trim()),
  resetDailyRisk: z.boolean().optional().default(false),
  resetPlanRiskLock: z.boolean().optional().default(true),
}).strict();

export const restartTradePlanSchema = z.object({
  name: z.string().min(1).max(120).transform((value) => value.trim()).optional(),
  startingCapital: z.number().positive(),
  archiveOldPlan: z.boolean().optional().default(true),
  reason: z.string().min(1).max(500).transform((value) => value.trim()),
  carrySettings: z.boolean().optional().default(true),
  activateNewPlan: z.boolean().optional().default(true),
}).strict();

export const deleteTradePlanSchema = z.object({
  reason: z.string().max(500).optional(),
  cascade: z.boolean().optional(),
}).strict();

export type CreateTradePlanInput = z.infer<typeof createTradePlanSchema>;
export type UpdateTradePlanInput = z.infer<typeof updateTradePlanSchema>;
export type CreateCapitalAdjustmentInput = z.infer<typeof capitalAdjustmentSchema>;
export type ResetRiskLockInput = z.infer<typeof resetRiskLockSchema>;
export type RestartTradePlanInput = z.infer<typeof restartTradePlanSchema>;
export type DeleteTradePlanInput = z.infer<typeof deleteTradePlanSchema>;

export const buildRiskBucketKey = (input: {
  userId: string;
  marketType: string;
  tradeStyle: string;
  instrumentType: string;
}): string => {
  return [
    input.userId,
    input.marketType.trim().toUpperCase(),
    input.tradeStyle.trim().toUpperCase(),
    input.instrumentType.trim().toUpperCase(),
  ].join(":");
};
