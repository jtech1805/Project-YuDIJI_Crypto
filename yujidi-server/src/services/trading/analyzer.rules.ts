export const MONITOR_CACHE_TTL_MS = 5 * 1000;

export type MonitorTrigger = "drop" | "spike";
export type MovementDirection = "up" | "down";

export type ThresholdEvaluation = {
  triggerType: MonitorTrigger | null;
  direction: MovementDirection;
  changePercentage: number;
  movementMagnitude: number;
  thresholdBreached: boolean;
};

export type MonitorCacheSnapshot = {
  activeMonitorCount: number;
  isNegativeCache: boolean;
  loadedAt: string;
  expiresAt: string;
  ttlRemainingMs: number;
};

export const normalizeMonitorTrigger = (trigger: unknown): MonitorTrigger | null => {
  if (trigger === "drop" || trigger === "spike") {
    return trigger;
  }

  return null;
};

export const evaluateMonitorThreshold = (
  percentChange: number,
  thresholdPercentage: number,
  trigger: unknown,
): ThresholdEvaluation => {
  const triggerType = normalizeMonitorTrigger(trigger);
  const direction: MovementDirection = percentChange >= 0 ? "up" : "down";
  const changePercentage = Number(percentChange.toFixed(2));
  const movementMagnitude = Number(Math.abs(percentChange).toFixed(2));

  const thresholdBreached =
    triggerType === "drop"
      ? percentChange <= -thresholdPercentage
      : triggerType === "spike"
        ? percentChange >= thresholdPercentage
        : false;

  return {
    triggerType,
    direction,
    changePercentage,
    movementMagnitude,
    thresholdBreached,
  };
};

export const createMonitorCacheSnapshot = (
  entry: { monitors: readonly unknown[]; loadedAt: number; expiresAt: number },
  now = Date.now(),
): MonitorCacheSnapshot => {
  return {
    activeMonitorCount: entry.monitors.length,
    isNegativeCache: entry.monitors.length === 0,
    loadedAt: new Date(entry.loadedAt).toISOString(),
    expiresAt: new Date(entry.expiresAt).toISOString(),
    ttlRemainingMs: Math.max(0, entry.expiresAt - now),
  };
};
