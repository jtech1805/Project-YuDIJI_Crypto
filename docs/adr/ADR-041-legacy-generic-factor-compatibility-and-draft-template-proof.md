# ADR-041: Legacy Generic-Factor Compatibility and Draft-Template Proof

Status: Accepted

## Context and decision

Legacy scoring remains authoritative and its exact evaluator registry is unchanged. The additive experimental namespace is exact, case-sensitive `GENERIC_FACTOR:<factor-key>`; the canonical proof key is `GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW`. Keys require one non-empty, whitespace-free registered factor key and a scoring-eligible definition.

Phase 3R-F chooses an isolated compatibility dispatcher. It is constructed explicitly with an `enabled` boolean corresponding to the default-off generic-evaluator capability, the closed Factor Registry, and a separate result adapter. It is not wired into production dispatch. Existing exact legacy evaluator lookup therefore remains authoritative by construction.

## Adapter and execution boundary

`GenericFactorLegacyResultAdapter` accepts only an already-produced Phase 2 result plus relationship identity. It never reads Evidence, selects providers, executes evaluators, calculates permission, aggregates factors, or mutates templates. DIRECT and INVERSE are supported. CONDITIONAL, CONFIRMATION_ONLY, RISK_ONLY, and VETO fail with `UNSUPPORTED_RELATIONSHIP`.

Contribution `[minimumPoints, maximumPoints]` maps linearly to legacy `[0,100]`; `-2, -1, 0, 1, 2` therefore map to `0, 25, 50, 75, 100`. This is compatibility projection, not factor evaluation. Outcome, one deterministic reason code, safe warning, confidence, factor/relationship/contribution bounds, and Evidence ID are projected. Invalid or absent execution fails typed; missing Evidence never becomes score zero.

## DRAFT template proof and safety

A test-only private USER/DRAFT fixture named `BTC_ETF_FLOW_EXPERIMENTAL` references the canonical generic key and configuration version. It is not inserted into the system-template registry or database and does not relax production template validation. System templates, active user templates, permissions, flags, ScoreCheck, provider execution, and Evidence orchestration are unchanged.

Tests cover exact parsing, feature-off behavior, unknown factor rejection, deterministic DIRECT/INVERSE/neutral translation, missing Evidence, all unsupported semantics, and the non-production fixture. Outputs are frozen and the path performs no I/O or clock access.

## Consequences, deferred work, and rejected alternatives

The compatibility shape is proven without activating runtime risk. Production integration awaits compiled rulebooks, an approved context port for preassembled inputs, and explicit default-off dispatch wiring. Non-scoring-factor coverage becomes actionable when such a registered factor exists.

Rejected alternatives include changing existing dispatch, allowing arbitrary nested keys, evaluator-side Evidence fetching, treating missing input as neutral, flattening risk/veto/confirmation, modifying system templates, and activating the flag.
