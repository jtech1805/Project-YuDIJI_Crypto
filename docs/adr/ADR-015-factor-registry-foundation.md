# ADR-015: Factor Registry Foundation

Status: Accepted

Date:
2026-07-30

Phase:
Phase 2A

## Context

Evidence carries stable factor identity, but no authoritative definition layer currently describes factor meaning, compatible Evidence shapes, unit requirements, freshness metadata, lifecycle, version, or future scoring eligibility. Duplicating those decisions across providers, resolvers, evaluators, templates, and explanations would make later deterministic behavior inconsistent.

## Decision

Add a code-defined, immutable `StaticFactorRegistry`. Phase 2A registers only the concretely supported `MARKET.PRICE` definition. No database-backed registry or administrative editing exists.

## Factor identity

Factor keys are immutable identities. They are exact, case-sensitive, and never trimmed, uppercased, guessed, or silently renamed. Display names may evolve, but keys may change only through a new explicit identity.

## Definition immutability

Definitions are validated, cloned, and deeply frozen at construction. Lookups and lists return separate deeply frozen copies so callers cannot mutate registry state.

## Value compatibility

Definitions reuse the frozen `EvidenceValueType` union. `MARKET.PRICE` accepts only `NUMBER`.

## Subject compatibility

Definitions reuse the frozen `EvidenceSubjectType` union. `MARKET.PRICE` accepts only `INSTRUMENT`.

## Unit policy

Unit policy is explicit as `REQUIRED`, `OPTIONAL`, `FORBIDDEN`, or `ALLOW_LIST`. Market price requires a non-empty, pre-trimmed unit because quote currency varies by instrument; it is not restricted to USDT.

## Freshness policy

Freshness metadata is `MAX_AGE`, `VALIDITY_INTERVAL`, or `NON_EXPIRING`. `MARKET.PRICE` uses a 10,000 ms maximum age, aligned with the existing market-snapshot freshness threshold. Phase 2A does not evaluate freshness.

## Scoring eligibility

Definitions classify future deterministic scoring eligibility as `ELIGIBLE`, `INELIGIBLE`, or `EXPLANATION_ONLY`. `MARKET.PRICE` is metadata-classified as eligible, but no score is calculated and no scoring path reads the registry.

## Lifecycle status

Definitions are `ACTIVE`, `DEPRECATED`, or `DISABLED`. Deprecated definitions fail compatibility by default and require an explicit allowance. Disabled definitions always fail.

## Versioning

Every definition has a positive integer version. Definition meaning may evolve only through explicit versioning; keys must not silently change.

## Registry lookup behavior

`get` returns a cloned immutable definition or `null`. `require` throws a typed `UNKNOWN_FACTOR` error. `list` returns cloned definitions sorted by exact factor key. Unknown factors fail closed and no fallback is fabricated.

## Validation behavior

Construction rejects empty registries, duplicate or unknown keys, malformed definitions, invalid versions, invalid enum members, duplicate compatibility members, invalid unit policies, and invalid freshness policies. Compatibility validation checks existence, lifecycle, value type, subject type, and unit policy in that order.

## Error behavior

Construction and required lookup use typed safe error codes without embedding complete definitions or Evidence values. Compatibility returns a typed outcome containing only the factor key and safe code.

## Relationship to Evidence

The registry is authoritative metadata, not runtime Evidence. It imports only existing Evidence type aliases. It does not query, inspect, normalize, ingest, persist, resolve, or mutate Evidence. The Evidence feature remains OFF.

## Relationship to source resolution

No provider or Evidence source is selected. Source resolution is deferred.

## Relationship to evaluators

No evaluator is imported, registered, or executed. The legacy evaluator registry remains unchanged.

## Relationship to scoring templates

Factor keys are distinct from existing template, section, and evaluator keys. No scoring template is modified or validated through this registry.

## Relationship to AI

No LLM, RAG, vector store, MCP, AI explanation, or prompt consumes the registry.

## Consequences

- Later boundaries have one deterministic factor-definition authority.
- Unsupported factor semantics are not invented.
- Strict validation and immutable outputs prevent runtime definition drift.
- Future source resolution and scoring integration require separate accepted decisions.

## Deferred work

- Additional factors backed by precise Evidence contracts.
- Evidence-to-factor compatibility integration.
- Explicit source resolution and freshness evaluation.
- Evaluator and scoring-template mapping.
- Version migration, persistence, administration, and API exposure.

## Rejected alternatives

1. Store editable definitions in MongoDB.
2. Accept unrestricted factor strings inside definitions.
3. Infer compatibility from provider payloads.
4. Reuse evaluator or template keys as factor identities.
5. Register speculative roadmap factors.
6. Connect the registry to Evidence or scoring in Phase 2A.
