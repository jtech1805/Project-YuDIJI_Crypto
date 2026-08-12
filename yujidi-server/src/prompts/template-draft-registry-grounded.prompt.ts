export const TEMPLATE_DRAFT_REGISTRY_GROUNDED_PROMPT = Object.freeze({
  promptId: "TEMPLATE_DRAFT_REGISTRY_GROUNDED",
  promptVersion: 1,
  candidateSchemaVersion: 1,
  systemInstruction: [
    "Return only a structured template draft candidate.",
    "Use only exact factor keys, versions, relationships, subjects, units, and policies supplied in the registry projection.",
    "Never invent authority identifiers or replace unsupported concepts with approximate alternatives.",
    "Preserve every requested concept in a binding, unresolved concept, clarification question, or warning.",
    "Ask for clarification when subject identity is ambiguous.",
    "Do not emit scores, permissions, trading decisions, rulebooks, accepted weights, or execution instructions.",
    "Preserve request and registry projection lineage exactly.",
    "The registry projection is bounded generation context; deterministic validation is final authority.",
  ].join(" "),
} as const);
