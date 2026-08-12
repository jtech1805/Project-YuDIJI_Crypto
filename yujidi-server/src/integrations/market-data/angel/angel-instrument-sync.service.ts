import type { InstrumentProvider } from "../../../ports/instrument-provider.port.js";
import type { AngelInstrument } from "./angel.types.js";

export class AngelInstrumentSyncService implements InstrumentProvider<AngelInstrument> {
  public readonly provider = "ANGEL_ONE" as const;

  public async syncInstruments(): Promise<AngelInstrument[]> {
    throw new Error("AngelInstrumentSyncService.syncInstruments is not implemented yet. Phase 0 scaffold only.");
  }

  public async searchInstruments(_query: string): Promise<AngelInstrument[]> {
    throw new Error("AngelInstrumentSyncService.searchInstruments is not implemented yet. Phase 0 scaffold only.");
  }

  public async getInstrumentByToken(_token: string): Promise<AngelInstrument | null> {
    throw new Error("AngelInstrumentSyncService.getInstrumentByToken is not implemented yet. Phase 0 scaffold only.");
  }
}
