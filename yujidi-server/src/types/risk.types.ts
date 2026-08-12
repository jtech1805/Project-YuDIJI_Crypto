export const RISK_MODES = [
  "NORMAL_RISK",
  "REDUCED_RISK",
  "MICRO_RISK",
  "STOP_TRADING",
] as const;
export type RiskMode = (typeof RISK_MODES)[number];

export const PNL_BASES = [
  "CONFIRMED_NET",
  "ESTIMATED_NET",
  "GROSS_FALLBACK",
] as const;
export type PnlBasis = (typeof PNL_BASES)[number];

export type MoneyValue = {
  amount: number;
  currency: string;
};
