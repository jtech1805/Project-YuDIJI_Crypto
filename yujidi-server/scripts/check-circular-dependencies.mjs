import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import madge from "madge";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const baselinePath = path.resolve(
  projectDirectory,
  "../docs/architecture/known-circular-dependencies.json",
);

const normalizePath = (value) =>
  value
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");

export const canonicalizeCycle = (input) => {
  if (!Array.isArray(input)) {
    throw new Error("Cycle paths must be an array");
  }
  const paths = input.map((entry) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error("Cycle paths must contain non-empty strings");
    }
    const normalized = normalizePath(entry);
    if (
      path.posix.isAbsolute(normalized)
      || normalized === ".."
      || normalized.startsWith("../")
    ) {
      throw new Error("Cycle paths must be project-relative");
    }
    return normalized;
  });
  if (paths.length > 1 && paths[0] === paths.at(-1)) paths.pop();
  if (paths.length < 2 || new Set(paths).size !== paths.length) {
    throw new Error("Cycle must contain at least two unique paths");
  }

  const candidates = [];
  for (const direction of [paths, [...paths].reverse()]) {
    for (let index = 0; index < direction.length; index += 1) {
      candidates.push([
        ...direction.slice(index),
        ...direction.slice(0, index),
      ]);
    }
  }
  candidates.sort((left, right) =>
    left.join("\0").localeCompare(right.join("\0")));
  const canonical = candidates[0];
  return [...canonical, canonical[0]];
};

const cycleKey = (paths) => canonicalizeCycle(paths).join("\0");

export const validateBaseline = (baseline) => {
  if (
    !baseline
    || typeof baseline !== "object"
    || baseline.version !== 1
    || !Array.isArray(baseline.cycles)
  ) {
    throw new Error("Circular dependency baseline must use version 1");
  }
  const ids = new Set();
  const keys = new Set();
  return baseline.cycles.map((entry) => {
    for (const field of [
      "id",
      "reason",
      "owner",
      "introducedBefore",
      "remediation",
      "targetPhase",
    ]) {
      if (typeof entry?.[field] !== "string" || entry[field].trim().length === 0) {
        throw new Error(`Baseline cycle has invalid ${field}`);
      }
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate baseline id: ${entry.id}`);
    ids.add(entry.id);
    const paths = canonicalizeCycle(entry.paths);
    const key = paths.join("\0");
    if (keys.has(key)) throw new Error(`Duplicate baseline cycle: ${entry.id}`);
    keys.add(key);
    return { ...entry, paths, key };
  });
};

export const compareCycles = (baseline, discoveredCycles) => {
  const approved = validateBaseline(baseline);
  if (!Array.isArray(discoveredCycles)) {
    throw new Error("Discovered cycles must be an array");
  }
  const discovered = new Map();
  for (const paths of discoveredCycles) {
    const canonical = canonicalizeCycle(paths);
    discovered.set(canonical.join("\0"), canonical);
  }
  const approvedKeys = new Set(approved.map((entry) => entry.key));
  return {
    approved,
    newCycles: [...discovered.entries()]
      .filter(([key]) => !approvedKeys.has(key))
      .map(([, paths]) => paths),
    resolvedCycles: approved.filter((entry) => !discovered.has(entry.key)),
  };
};

export const exitCodeForComparison = (comparison) =>
  comparison.newCycles.length > 0 ? 1 : 0;

const display = (paths) => paths.join(" -> ");

export const runCircularDependencyCheck = async () => {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const graph = await madge(path.join(projectDirectory, "src"), {
    fileExtensions: ["ts"],
    tsConfig: path.join(projectDirectory, "tsconfig.json"),
  });
  const discovered = graph.circular().map((cycle) =>
    cycle.map((entry) => `src/${normalizePath(entry)}`));
  const comparison = compareCycles(baseline, discovered);

  for (const entry of comparison.approved) {
    if (!comparison.resolvedCycles.some((resolved) => resolved.id === entry.id)) {
      console.log(`Approved ${entry.id}: ${display(entry.paths)}`);
    }
  }
  for (const entry of comparison.resolvedCycles) {
    console.log(`Resolved baseline debt ${entry.id}: ${display(entry.paths)}`);
  }
  if (exitCodeForComparison(comparison) !== 0) {
    for (const cycle of comparison.newCycles) {
      console.error(`New circular dependency: ${display(cycle)}`);
    }
    return exitCodeForComparison(comparison);
  }
  console.log(
    `Circular dependency gate passed: ${discovered.length} approved legacy cycle(s), 0 new.`,
  );
  return 0;
};

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.exitCode = await runCircularDependencyCheck();
  } catch (error) {
    console.error(
      `Circular dependency gate failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    process.exitCode = 1;
  }
}
