# ADR-051: Compiled Rulebook Runtime Aggregation and Observation Attestation

Status: Accepted

## Context and audit blocker

Phase 4G's pre-coding audit found no authoritative rulebook-level aggregation, no distinct runtime meaning for optional PARTIAL versus OMIT, no rulebook policy-lineage consistency rule, and no proof that caller-supplied observations came through the compiled provider lineage. Guessing any of these would make shadow execution dishonest.

## Compiled runtime responsibility

This decision freezes runtime-neutral contracts only. It does not resolve subjects, execute evaluators, normalize, classify decisions, persist results, or activate compiled execution.

## Binding outcomes

Input state is `AVAILABLE`, `MISSING`, or `INVALID`. Disposition is `INCLUDED`, `PARTIAL`, `OMITTED`, or `BLOCKING`.

- A usable binding is INCLUDED.
- MANDATORY/null missing or invalid is BLOCKING.
- OPTIONAL/PARTIAL missing or invalid is PARTIAL.
- OPTIONAL/OMIT missing or invalid is OMITTED.

PARTIAL and OMITTED have no evaluator score. A missing value is never represented as a synthetic score of zero.

## Partial and omit denominator behavior

PARTIAL contributes no numerator but retains its compiled weight in the denominator and marks the aggregate partial. OMITTED contributes neither numerator nor denominator and does not by itself mark the aggregate partial.

## Compiled weighted mean

The separate policy family is identified by exact `policyId` and `policyVersion`, uses `COMPILED_WEIGHTED_MEAN`, freezes `RETAIN_IN_DENOMINATOR` for partial weight and `REMOVE_FROM_DENOMINATOR` for omitted weight, and records compile eligibility.

For INCLUDED bindings, numerator increases by `normalizedBindingScore * compiledWeight` and denominator by compiled weight. PARTIAL increases only the denominator. OMITTED increases neither. No rounding occurs.

Any BLOCKING binding makes aggregation BLOCKED with a null aggregate. A zero denominator makes it INSUFFICIENT_INPUT with a null aggregate. Otherwise aggregate is numerator divided by included denominator, with COMPLETED or PARTIAL status. Numerator, denominator, aggregate, and partial state remain visible.

Production policy defaults are empty. Compile-ineligible definitions remain historical metadata and cannot drive aggregation.

## Rulebook-level policy consistency

All bindings in the initial runtime must carry identical aggregation, normalization, and decision-band policy identity/version. Mixed aggregation, normalization, or decision-band lineage fails with its respective typed inconsistency. No first, latest, highest, or majority policy is selected.

This consistency decision does not execute the existing normalization or decision-band authorities. Those authorities continue to require exact upstream identity and range matches.

## Observation attestation

A direct shadow observation carries exact factor identity/version, canonical subject, numeric value/unit, observation time, optional confidence, and provider attestation. Attestation contains exact provider-binding and resolution-policy identity/version, selected provider key, and one closed automated outcome: RESOLVED, FALLBACK, or PROXY.

The validator requires exact factor and resolved-subject equality, exact compiled provider lineage equality, exact historical authority lookup, compile eligibility, and selected-provider membership in the exact binding's ordered provider keys. MANUAL_REQUIRED, UNRESOLVED, and unknown outcomes are rejected.

The attestation vocabulary intentionally projects existing `FALLBACK_USED` and `PROXY_USED` runtime statuses into the smaller proof vocabulary `FALLBACK` and `PROXY`; it does not replay provider resolution.

## Exact historical lookup

Provider binding, resolution policy, and compiled aggregation policy authorities expose exact lookup, version listing, and convenience-only latest lookup. Validation uses only `getExact`; no latest substitution is allowed.

## Determinism and immutability

Validation order and arithmetic are deterministic. Inputs are not mutated. Historical definitions and successful attested observations are cloned, detached, and deeply frozen.

## Boundaries

There is no provider call, Evidence read, evaluator execution, subject resolution, normalization, decision classification, execution persistence, Mongo model, API, ScoreCheck mutation, feature-flag change, or production registration. Legacy scoring remains authoritative and compiled execution remains off.

## Relationship to earlier and future phases

Phase 2 evaluator-plan aggregation remains unchanged and does not own this cross-binding weighted mean. Phase 4D1 supplies the per-binding optional vocabulary; Phase 4E preserves it and the policy/provider lineage in compiled artifacts. Phase 4G may compose these contracts explicitly after this phase, under a separate ADR-052.

## Rejected alternatives

Rejected: reusing evaluator-plan aggregation, treating missing values as zero scores, removing PARTIAL weight, retaining OMIT weight, selecting the first or latest policy, trusting provider text alone, replaying provider calls, and persisting proof results.

## Consequences

Future shadow execution can distinguish blocked, partial, omitted, and insufficient input deterministically and can accept only provider-attested test-local observations. A compiled executor is still absent and production behavior is unchanged.
