export const MAX_BINANCE_PRICE_SYMBOLS = 20;

export const BINANCE_PRICE_ADAPTER_ERROR_CODES = [
  "INVALID_CONFIGURATION",
  "INVALID_CLOCK",
  "PROVIDER_REQUEST_FAILED",
  "INVALID_PROVIDER_RESPONSE",
  "SYMBOL_MISMATCH",
  "INVALID_PRICE",
] as const;

export type BinancePriceAdapterErrorCode =
  (typeof BINANCE_PRICE_ADAPTER_ERROR_CODES)[number];

export class BinancePriceAdapterError extends Error {
  public readonly code: BinancePriceAdapterErrorCode;

  public constructor(code: BinancePriceAdapterErrorCode) {
    super(`Binance public price adapter failed: ${code}`);
    this.name = "BinancePriceAdapterError";
    this.code = code;
  }
}
