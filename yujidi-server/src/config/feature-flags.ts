export const FEATURE_FLAG_KEYS = [
  "EVIDENCE_PIPELINE_ENABLED",
  "GENERIC_EVALUATOR_ENABLED",
  "SOURCE_RESOLVER_FALLBACK_ENABLED",
  "COMPILED_RULEBOOK_EXECUTION",
  "DECISION_AXES_ENABLED",
  "EVENT_CLASSIFICATION_READONLY",
  "EVENT_CLASSIFICATION_AFFECTS_RISK",
  "RAG_TEMPLATE_DRAFTING_ENABLED",
  "AI_TEMPLATE_GENERATION_ENABLED",
  "KNOWLEDGE_RETRIEVAL_ENABLED",
  "WEIGHT_PROPOSALS_ENABLED",
  "COPILOT_TEMPLATE_DRAFT_ENABLED",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlagSnapshot = Readonly<Record<FeatureFlagKey, boolean>>;

export class FeatureFlagConfigurationError extends Error {
  public readonly flagKey: FeatureFlagKey;

  public constructor(flagKey: FeatureFlagKey) {
    super(`Invalid feature flag value for ${flagKey}; expected true or false`);
    this.name = "FeatureFlagConfigurationError";
    this.flagKey = flagKey;
  }
}

export class FeatureFlagService {
  private readonly flags: FeatureFlagSnapshot;

  public constructor(snapshot: FeatureFlagSnapshot) {
    this.flags = freezeSnapshot(snapshot);
  }

  public isEnabled(flag: FeatureFlagKey): boolean {
    return this.flags[flag];
  }

  public snapshot(): FeatureFlagSnapshot {
    return freezeSnapshot(this.flags);
  }
}

export function parseFeatureFlags(
  environment: NodeJS.ProcessEnv,
): FeatureFlagSnapshot {
  const snapshot = {} as Record<FeatureFlagKey, boolean>;

  for (const flagKey of FEATURE_FLAG_KEYS) {
    snapshot[flagKey] = parseFeatureFlagValue(flagKey, environment[flagKey]);
  }

  return freezeSnapshot(snapshot);
}

export function createFeatureFlagService(
  environment: NodeJS.ProcessEnv = process.env,
): FeatureFlagService {
  return new FeatureFlagService(parseFeatureFlags(environment));
}

export const sharedFeatureFlagService: FeatureFlagService =
  createFeatureFlagService();

function parseFeatureFlagValue(
  flagKey: FeatureFlagKey,
  value: string | undefined,
): boolean {
  const normalizedValue = value?.trim().toLowerCase() ?? "";

  if (normalizedValue.length === 0 || normalizedValue === "false") {
    return false;
  }

  if (normalizedValue === "true") {
    return true;
  }

  throw new FeatureFlagConfigurationError(flagKey);
}

function freezeSnapshot(snapshot: FeatureFlagSnapshot): FeatureFlagSnapshot {
  const copy = {} as Record<FeatureFlagKey, boolean>;

  for (const flagKey of FEATURE_FLAG_KEYS) {
    copy[flagKey] = snapshot[flagKey];
  }

  return Object.freeze(copy);
}
