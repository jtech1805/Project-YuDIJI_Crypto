import type {
  Exchange,
  InstrumentType,
  MarketType,
} from "../../../types/market-data.types.js";
import type { AngelScripMasterRow } from "./angel-scrip-master.types.js";

const ANGEL_MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

export type UniversalSymbolSet = {
  provider: "ANGEL_ONE";
  marketType: MarketType;
  exchange: Exchange;
  symbol: string;
  name: string;
  displayName: string;
  providerSymbol: string;
  instrumentToken: string;
  instrumentType: InstrumentType;
  expiry?: Date;
  strikePrice?: number;
  optionType?: "CE" | "PE";
  lotSize?: number;
  tickSize?: number;
  requiresBrokerLogin: true;
  supportedBroker: "ANGEL_ONE";
  status: "ACTIVE" | "EXPIRED" | "DISABLED";
  raw: AngelScripMasterRow;
};

export const parseAngelExpiry = (value: string): Date | undefined => {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2})([A-Z]{3})(\d{4})$/);
  if (!match) {
    return undefined;
  }

  const [, dayPart, monthPart, yearPart] = match;
  const month = monthPart ? ANGEL_MONTHS[monthPart] : undefined;
  if (!dayPart || !yearPart || month === undefined) {
    return undefined;
  }

  return new Date(Date.UTC(Number(yearPart), month, Number(dayPart)));
};

const mapAngelExchange = (value: string): Exchange => {
  const normalized = value.trim().toUpperCase();
  const exchangeMap: Record<string, Exchange> = {
    MCX: "MCX",
    MCX_FO: "MCX",
    NSE: "NSE",
    NSE_CM: "NSE",
    BSE: "BSE",
    BSE_CM: "BSE",
    NFO: "NFO",
    NSE_FO: "NFO",
    BFO: "BFO",
    BSE_FO: "BFO",
    CDS: "CDS",
    NCDEX: "NCDEX",
  };

  return exchangeMap[normalized] ?? "NSE";
};

const inferMarketType = (exchange: Exchange): MarketType => {
  if (exchange === "MCX" || exchange === "NCDEX") {
    return "COMMODITY";
  }
  if (exchange === "NSE" || exchange === "BSE") {
    return "EQUITY";
  }
  if (exchange === "NFO" || exchange === "BFO") {
    return "FNO";
  }
  if (exchange === "CDS") {
    return "CURRENCY";
  }

  return "EQUITY";
};

const inferOptionType = (symbol: string): "CE" | "PE" | undefined => {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.endsWith("CE")) {
    return "CE";
  }
  if (normalized.endsWith("PE")) {
    return "PE";
  }

  return undefined;
};

const inferInstrumentType = (
  row: AngelScripMasterRow,
  exchange: Exchange,
  optionType: "CE" | "PE" | undefined,
): InstrumentType => {
  const instrumentType = row.instrumenttype.trim().toUpperCase();
  const symbol = row.symbol.trim().toUpperCase();

  if (!instrumentType && (exchange === "NSE" || exchange === "BSE")) {
    return "CASH";
  }
  if (instrumentType.startsWith("FUT") || instrumentType === "FUTCOM") {
    return "FUTURE";
  }
  if (instrumentType.startsWith("OPT") || optionType) {
    return "OPTION";
  }
  if (instrumentType.includes("INDEX") || symbol.endsWith("INDEX")) {
    return "INDEX";
  }

  return "UNKNOWN";
};

const parsePositiveNumber = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const buildUniversalSymbol = (
  row: AngelScripMasterRow,
  exchange: Exchange,
  instrumentType: InstrumentType,
  expiryLabel: string,
  strikePrice: number | undefined,
  optionType: "CE" | "PE" | undefined,
): string => {
  const name = row.name.trim().toUpperCase();

  if (exchange === "MCX" && instrumentType === "OPTION" && expiryLabel && strikePrice && optionType) {
    return `${exchange}:${name}:${expiryLabel}:${strikePrice}:${optionType}`;
  }
  if (exchange === "MCX" && instrumentType === "FUTURE" && expiryLabel) {
    return `${exchange}:${name}:${expiryLabel}:FUTURE`;
  }

  return `${exchange}:${row.symbol.trim().toUpperCase()}`;
};

const buildDisplayName = (
  row: AngelScripMasterRow,
  exchange: Exchange,
  instrumentType: InstrumentType,
  expiryLabel: string,
  strikePrice: number | undefined,
  optionType: "CE" | "PE" | undefined,
): string => {
  const parts = [exchange, row.name.trim().toUpperCase()];
  if (expiryLabel) {
    parts.push(expiryLabel);
  }
  if (instrumentType === "OPTION" && strikePrice) {
    parts.push(String(strikePrice));
  }
  if (optionType) {
    parts.push(optionType);
  } else if (instrumentType === "FUTURE") {
    parts.push("FUTURE");
  }

  return parts.join(" ");
};

export const mapAngelScripToUniversalSymbol = (row: AngelScripMasterRow): UniversalSymbolSet => {
  const exchange = mapAngelExchange(row.exch_seg);
  const marketType = inferMarketType(exchange);
  const optionType = inferOptionType(row.symbol);
  const instrumentType = inferInstrumentType(row, exchange, optionType);
  const expiry = parseAngelExpiry(row.expiry);
  const expiryLabel = row.expiry.trim().toUpperCase();
  const strikePrice = parsePositiveNumber(row.strike)
    ? Number(row.strike) / 100
    : undefined;
  const tickSize = parsePositiveNumber(row.tick_size)
    ? Number(row.tick_size) / 100
    : undefined;
  const lotSize = parsePositiveNumber(row.lotsize);

  return {
    provider: "ANGEL_ONE",
    marketType,
    exchange,
    symbol: buildUniversalSymbol(row, exchange, instrumentType, expiryLabel, strikePrice, optionType),
    name: row.name.trim().toUpperCase(),
    displayName: buildDisplayName(row, exchange, instrumentType, expiryLabel, strikePrice, optionType),
    providerSymbol: row.symbol.trim().toUpperCase(),
    instrumentToken: row.token.trim(),
    instrumentType,
    ...(expiry ? { expiry } : {}),
    ...(strikePrice ? { strikePrice } : {}),
    ...(optionType ? { optionType } : {}),
    ...(lotSize ? { lotSize } : {}),
    ...(tickSize ? { tickSize } : {}),
    requiresBrokerLogin: true,
    supportedBroker: "ANGEL_ONE",
    status: "ACTIVE",
    raw: row,
  };
};
