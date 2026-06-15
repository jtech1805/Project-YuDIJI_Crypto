import type { AngelReadOnlySession, AngelSmartApiConfig } from "./angel.types.js";

export class AngelAuthService {
  public constructor(private readonly config: AngelSmartApiConfig) {}

  public async createReadOnlySession(): Promise<AngelReadOnlySession> {
    if (!this.config.enabled) {
      throw new Error("Angel SmartAPI is disabled. Set ANGEL_SMARTAPI_ENABLED=true before creating sessions.");
    }

    if (!this.config.apiKey || !this.config.clientCode) {
      throw new Error("Angel SmartAPI apiKey and clientCode are required for a read-only session.");
    }

    throw new Error(
      "Angel SmartAPI live login is not implemented yet. Credential storage and official login payloads must be approved before enabling live sessions.",
    );
  }

  public async refreshReadOnlySession(): Promise<AngelReadOnlySession> {
    if (!this.config.enabled) {
      throw new Error("Angel SmartAPI is disabled. Set ANGEL_SMARTAPI_ENABLED=true before refreshing sessions.");
    }

    throw new Error(
      "Angel SmartAPI session refresh is not implemented yet. Token storage and refresh semantics must be approved before enabling live sessions.",
    );
  }
}
