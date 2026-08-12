import type { FactorDecisionBandDefinition } from "../../types/factor-decision-band.types.js";

export const matchDecisionBands = (bands: readonly FactorDecisionBandDefinition[], score: number): readonly FactorDecisionBandDefinition[] =>
  bands.filter((band, index) => band.minimumScore <= score
    && (index === bands.length - 1 ? score <= band.maximumScore : score < band.maximumScore));
