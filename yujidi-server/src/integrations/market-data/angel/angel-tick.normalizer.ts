import type { NormalizedMarketTick } from "../../../types/market-data.types.js";
import type { AngelRawTick } from "./angel.types.js";

export const normalizeAngelTick = (_rawTick: AngelRawTick): NormalizedMarketTick => {
  throw new Error("normalizeAngelTick is not implemented yet. Phase 0 scaffold only.");
};
