import type { AngelSmartApiConfig } from "./angel.types.js";

export class AngelAuthService {
  public constructor(private readonly config: AngelSmartApiConfig) {}

  public async createReadOnlySession(): Promise<never> {
    void this.config;
    throw new Error("AngelAuthService.createReadOnlySession is not implemented yet. Phase 0 scaffold only.");
  }

  public async refreshReadOnlySession(): Promise<never> {
    void this.config;
    throw new Error("AngelAuthService.refreshReadOnlySession is not implemented yet. Phase 0 scaffold only.");
  }
}
