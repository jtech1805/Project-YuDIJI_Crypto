const MAX_PREFIXES_PER_TOKEN = 12;
const MAX_TOKEN_LENGTH_FOR_PREFIXES = 24;

const MONTH_PATTERN = /\b\d{1,2}[a-z]{3}(\d{2}|\d{4})\b/gi;

export function normalizeSearchText(value: string | undefined | null): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const addToken = (tokens: Set<string>, value: string | undefined | null): void => {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return;
  }

  for (const token of normalized.split(" ")) {
    if (token.length >= 2) {
      tokens.add(token);
    }
  }
};

const addRawToken = (tokens: Set<string>, value: string | undefined | null): void => {
  const normalized = normalizeSearchText(value).replace(/\s+/g, "");
  if (normalized.length >= 2) {
    tokens.add(normalized);
  }
};

const addExpiryTokens = (tokens: Set<string>, value: Date | string | undefined): void => {
  if (!value) {
    return;
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      tokens.add(String(value.getUTCFullYear()));
    }
    return;
  }

  const normalized = value.toLowerCase();
  const matches = normalized.match(MONTH_PATTERN) ?? [];
  for (const match of matches) {
    tokens.add(match);
    const year = match.match(/\d{4}$/)?.[0];
    if (year) {
      tokens.add(year);
    }
  }
};

const addProviderSymbolHints = (tokens: Set<string>, providerSymbol: string | undefined): void => {
  if (!providerSymbol) {
    return;
  }

  const normalized = providerSymbol.toLowerCase();
  const commodityMatch = normalized.match(/^([a-z]+)(\d{1,2}[a-z]{3}\d{2,4})(fut|ce|pe)?/);
  if (commodityMatch?.[1]) {
    tokens.add(commodityMatch[1]);
  }
  if (commodityMatch?.[2]) {
    tokens.add(commodityMatch[2]);
  }
  if (commodityMatch?.[3]) {
    tokens.add(commodityMatch[3]);
    if (commodityMatch[3] === "fut") {
      tokens.add("future");
    }
  }
};

const expandInstrumentType = (tokens: Set<string>, instrumentType: string | undefined): void => {
  const normalized = normalizeSearchText(instrumentType).toUpperCase();
  if (normalized === "FUTURE") {
    tokens.add("future");
    tokens.add("fut");
  }
  if (normalized === "OPTION") {
    tokens.add("option");
    tokens.add("ce");
    tokens.add("pe");
  }
  if (normalized === "SPOT") {
    tokens.add("spot");
  }
  if (normalized === "CASH") {
    tokens.add("cash");
  }
};

const buildAutocompleteTokens = (tokens: Iterable<string>): string[] => {
  const prefixes = new Set<string>();

  for (const token of tokens) {
    if (token.length < 2) {
      continue;
    }

    const cappedToken = token.slice(0, MAX_TOKEN_LENGTH_FOR_PREFIXES);
    const prefixLimit = Math.min(cappedToken.length, MAX_PREFIXES_PER_TOKEN);
    for (let length = 2; length <= prefixLimit; length += 1) {
      prefixes.add(cappedToken.slice(0, length));
    }
  }

  return Array.from(prefixes).sort();
};

export function tokenizeSymbolSearch(input: {
  symbol?: string | undefined;
  displayName?: string | undefined;
  providerSymbol?: string | undefined;
  name?: string | undefined;
  baseAsset?: string | undefined;
  quoteAsset?: string | undefined;
  exchange?: string | undefined;
  marketType?: string | undefined;
  instrumentType?: string | undefined;
  expiry?: Date | string | undefined;
}): {
  searchName: string;
  searchSymbol: string;
  searchDisplayName: string;
  searchProviderSymbol: string;
  searchTokens: string[];
  autocompleteTokens: string[];
} {
  const searchName = normalizeSearchText(input.name);
  const searchSymbol = normalizeSearchText(input.symbol).replace(/\s+/g, "");
  const searchDisplayName = normalizeSearchText(input.displayName);
  const searchProviderSymbol = normalizeSearchText(input.providerSymbol).replace(/\s+/g, "");
  const tokens = new Set<string>();

  addToken(tokens, input.symbol);
  addToken(tokens, input.displayName);
  addToken(tokens, input.providerSymbol);
  addToken(tokens, input.name);
  addToken(tokens, input.baseAsset);
  addToken(tokens, input.quoteAsset);
  addToken(tokens, input.exchange);
  addToken(tokens, input.marketType);
  addToken(tokens, input.instrumentType);
  addRawToken(tokens, input.symbol);
  addRawToken(tokens, input.providerSymbol);
  addExpiryTokens(tokens, input.expiry);
  addExpiryTokens(tokens, input.symbol);
  addExpiryTokens(tokens, input.displayName);
  addProviderSymbolHints(tokens, input.providerSymbol);
  expandInstrumentType(tokens, input.instrumentType);

  return {
    searchName,
    searchSymbol,
    searchDisplayName,
    searchProviderSymbol,
    searchTokens: Array.from(tokens).sort(),
    autocompleteTokens: buildAutocompleteTokens(tokens),
  };
}
