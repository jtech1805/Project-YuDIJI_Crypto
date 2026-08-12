import type { ProviderKey } from "../types/provider-definition.types.js";
import { ProviderResolutionRunnerRegistryError, type ProviderRunnerRegistration, type ProviderResolutionRunnerRegistryPort } from "../types/provider-resolution-composition.types.js";

const ID = /^[A-Z0-9_]{1,120}$/;

export class ProviderResolutionRunnerRegistry implements ProviderResolutionRunnerRegistryPort {
  private readonly registrations: ReadonlyMap<ProviderKey, ProviderRunnerRegistration>;
  public constructor(registrations: readonly ProviderRunnerRegistration[]) {
    if (!Array.isArray(registrations) || !dense(registrations)) throw new ProviderResolutionRunnerRegistryError("INVALID_REGISTRATIONS");
    const snapshots = new Map<ProviderKey, ProviderRunnerRegistration>();
    const runnerIds = new Set<string>();
    for (const raw of registrations as readonly unknown[]) {
      if (!valid(raw)) throw new ProviderResolutionRunnerRegistryError("INVALID_REGISTRATION");
      if (snapshots.has(raw.providerKey)) throw new ProviderResolutionRunnerRegistryError("DUPLICATE_PROVIDER_KEY");
      if (runnerIds.has(raw.runnerId)) throw new ProviderResolutionRunnerRegistryError("DUPLICATE_RUNNER_ID");
      const snapshot = Object.freeze({ providerKey: raw.providerKey, runnerId: raw.runnerId, evidenceProvenanceProvider: raw.evidenceProvenanceProvider, runner: raw.runner });
      snapshots.set(snapshot.providerKey, snapshot); runnerIds.add(snapshot.runnerId);
    }
    this.registrations = snapshots;
  }
  public get(providerKey: ProviderKey): ProviderRunnerRegistration | null {
    if (typeof providerKey !== "string") return null;
    return this.registrations.get(providerKey) ?? null;
  }
}

export const DEFAULT_PROVIDER_RESOLUTION_RUNNER_REGISTRATIONS = Object.freeze([] as const);
export const createDefaultProviderResolutionRunnerRegistry = (): ProviderResolutionRunnerRegistry => new ProviderResolutionRunnerRegistry(DEFAULT_PROVIDER_RESOLUTION_RUNNER_REGISTRATIONS);
const valid = (value: unknown): value is ProviderRunnerRegistration => record(value) && ID.test(value.providerKey) && ID.test(value.runnerId) && typeof value.evidenceProvenanceProvider === "string" && value.evidenceProvenanceProvider.length > 0 && value.evidenceProvenanceProvider.length <= 120 && value.evidenceProvenanceProvider.trim() === value.evidenceProvenanceProvider && record(value.runner) && typeof value.runner.run === "function";
const dense = (values: readonly unknown[]) => { for (let index = 0; index < values.length; index += 1) if (!(index in values)) return false; return true; };
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
