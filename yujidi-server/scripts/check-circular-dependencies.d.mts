export type CircularDependencyBaselineEntry = {
  id: string;
  paths: string[];
  reason: string;
  owner: string;
  introducedBefore: string;
  remediation: string;
  targetPhase: string;
};

export type CircularDependencyBaseline = {
  version: 1;
  cycles: CircularDependencyBaselineEntry[];
};

export function canonicalizeCycle(input: unknown): string[];

export function validateBaseline(
  baseline: unknown,
): Array<CircularDependencyBaselineEntry & {
  key: string;
}>;

export function compareCycles(
  baseline: unknown,
  discoveredCycles: unknown,
): {
  approved: Array<CircularDependencyBaselineEntry & {
    key: string;
  }>;
  newCycles: string[][];
  resolvedCycles: Array<CircularDependencyBaselineEntry & {
    key: string;
  }>;
};

export function exitCodeForComparison(comparison: {
  newCycles: string[][];
}): 0 | 1;

export function runCircularDependencyCheck(): Promise<number>;
