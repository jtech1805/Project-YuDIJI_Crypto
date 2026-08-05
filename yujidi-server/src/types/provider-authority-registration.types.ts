import type { ProviderDefinition, ProviderKey } from "./provider-definition.types.js";

export type ProviderAuthorityCapabilities = Readonly<{
  compileEligible: boolean;
  liveExecutionEligible: boolean;
  replayFixtureEligible: boolean;
}>;
export type ProviderAuthorityRegistration = Readonly<{
  providerDefinition: ProviderDefinition;
  capabilities: ProviderAuthorityCapabilities;
}>;
export interface ProviderAuthorityRegistry { getExact(providerKey: ProviderKey): ProviderAuthorityRegistration | null }
export class ProviderAuthorityRegistryError extends Error {
  public constructor(public readonly code: "INVALID_REGISTRATION" | "DUPLICATE_PROVIDER") {
    super(`Provider authority registry failed: ${code}`);
    this.name = "ProviderAuthorityRegistryError";
  }
}
