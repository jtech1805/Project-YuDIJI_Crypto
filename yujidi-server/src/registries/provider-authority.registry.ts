import type { ProviderDefinition } from "../types/provider-definition.types.js";
import { ProviderAuthorityRegistryError, type ProviderAuthorityRegistration, type ProviderAuthorityRegistry } from "../types/provider-authority-registration.types.js";
import { cloneAndFreeze } from "./historical-authority.internal.js";

export const BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY = "YUDIJI_CHARACTERIZATION_BTC_ETF_FLOW";
export const BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER: ProviderAuthorityRegistration = cloneAndFreeze({
  providerDefinition: { providerKey: BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY, displayName: "YUDIJI internal non-live BTC ETF-flow characterization fixture", providerType: "DIRECT", authorityLevel: "MANUAL_REVIEWED", costTier: "INTERNAL", supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], enabled: true },
  evidenceProvenanceProvider: "yudiji-internal-btc-etf-flow-characterization",
  capabilities: { compileEligible: true, liveExecutionEligible: false, replayFixtureEligible: true },
});
export const DEFAULT_PROVIDER_AUTHORITY_REGISTRATIONS: readonly ProviderAuthorityRegistration[] = Object.freeze([BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER]);

export class StaticProviderAuthorityRegistry implements ProviderAuthorityRegistry {
  private readonly registrations: ReadonlyMap<string, ProviderAuthorityRegistration>;
  public constructor(values: readonly ProviderAuthorityRegistration[]) {
    if (!Array.isArray(values)) throw new ProviderAuthorityRegistryError("INVALID_REGISTRATION");
    const registrations = new Map<string, ProviderAuthorityRegistration>();
    for (const value of values) {
      if (!valid(value)) throw new ProviderAuthorityRegistryError("INVALID_REGISTRATION");
      if (registrations.has(value.providerDefinition.providerKey)) throw new ProviderAuthorityRegistryError("DUPLICATE_PROVIDER");
      registrations.set(value.providerDefinition.providerKey, cloneAndFreeze(value));
    }
    this.registrations = registrations;
  }
  public getExact(providerKey: string): ProviderAuthorityRegistration | null {
    const value = this.registrations.get(providerKey);
    return value ? cloneAndFreeze(value) : null;
  }
}
export const createDefaultProviderAuthorityRegistry = () => new StaticProviderAuthorityRegistry(DEFAULT_PROVIDER_AUTHORITY_REGISTRATIONS);
const valid = (value: unknown): value is ProviderAuthorityRegistration => {
  if (!record(value) || !record(value.providerDefinition) || !record(value.capabilities)) return false;
  const provider = value.providerDefinition as ProviderDefinition;
  return typeof provider.providerKey === "string" && /^[A-Z0-9_]{1,120}$/.test(provider.providerKey)
    && typeof provider.displayName === "string" && provider.displayName.trim() === provider.displayName
    && Array.isArray(provider.supportedFactorKeys) && provider.supportedFactorKeys.length > 0
    && typeof value.evidenceProvenanceProvider === "string" && value.evidenceProvenanceProvider.length > 0
    && value.evidenceProvenanceProvider.length <= 120 && value.evidenceProvenanceProvider.trim() === value.evidenceProvenanceProvider
    && typeof value.capabilities.compileEligible === "boolean" && typeof value.capabilities.liveExecutionEligible === "boolean"
    && typeof value.capabilities.replayFixtureEligible === "boolean";
};
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
