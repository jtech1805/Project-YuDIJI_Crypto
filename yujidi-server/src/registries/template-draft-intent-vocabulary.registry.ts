export const TEMPLATE_DRAFT_INTENT_CONCEPT_VOCABULARY = Object.freeze([
  Object.freeze({
    conceptId: "ETF",
    labels: Object.freeze([
      "ETF",
      "ETF flow",
      "ETF flows",
      "ETF inflow",
      "ETF inflows",
      "ETF net flow",
      "Bitcoin ETF flow",
      "Bitcoin ETF flows",
      "Bitcoin ETF net flow",
    ]),
  }),
] as const);

export const TEMPLATE_DRAFT_INTENT_SUBJECT_VOCABULARY = Object.freeze([
  Object.freeze({
    type: "ASSET",
    key: "BTC",
    displayName: "Bitcoin",
    labels: Object.freeze(["BTC", "Bitcoin"]),
  }),
  Object.freeze({
    type: "TRADED_INSTRUMENT",
    key: "TATASTEEL",
    displayName: "Tata Steel",
    labels: Object.freeze(["Tata Steel", "TATASTEEL"]),
  }),
] as const);
