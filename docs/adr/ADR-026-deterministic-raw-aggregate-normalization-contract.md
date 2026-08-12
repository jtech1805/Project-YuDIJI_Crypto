# ADR-026: Deterministic Raw Aggregate Normalization Contract

Status: Accepted

Date: 2026-08-01

Phase: Phase 2L

## Context

Phase 2K produces a bounded raw contribution aggregate, but no neutral contract defines how that domain may later map into a normalized numeric range while preserving an explicit zero anchor and avoiding legacy score assumptions.

## Decision

Add immutable normalization-policy types and one synchronous validation service. Phase 2L defines mapping instructions only; no normalization arithmetic, normalized score, rounding, clamping, band, or decision is produced.

## Policy identity

Every policy carries a caller-supplied uppercase `normalizationPolicyId` containing only letters, digits, and underscores with a length of 1–120 characters.

## Policy versioning

`normalizationPolicyVersion` is a caller-supplied positive integer. No semantic-version parsing, generated version, latest lookup, or fallback exists.

## Aggregation-policy relationship

The policy references one exact validated Phase 2J aggregation policy ID and version. Its source minimum and maximum must exactly equal that policy’s declared aggregate bounds.

## Single-factor scope

The normalization factor must exactly match the aggregation policy factor. Cross-factor mapping is not defined.

## Raw source range

The source range explicitly declares finite `minimumPoints < 0`, literal `neutralPoints: 0`, and finite `maximumPoints > 0`. Both sides of neutral must have non-zero capacity.

## Normalized target range

The target range declares finite `minimumScore < neutralScore < maximumScore`. No fixed 0–100 range or midpoint is required.

## Neutral-point mapping

Raw zero maps exactly to `neutralScore`. Future execution must special-case exact zero to preserve the anchor.

## Piecewise-linear method

The only method is `PIECEWISE_LINEAR_ZERO_ANCHORED`. The lower and upper sides are independently linear around zero; a single global slope is not assumed.

## Lower-segment semantics

The closed raw interval from source minimum to zero maps linearly from target minimum to target neutral.

## Upper-segment semantics

The closed raw interval from zero to source maximum maps linearly from target neutral to target maximum.

## Asymmetric-range support

Source magnitudes, target magnitudes, and the target neutral’s position may all be asymmetric. Neutral need not be the target midpoint.

## Zero-width segment rejection

Source minimum zero, source maximum zero, equal target minimum/neutral, and equal target neutral/maximum are rejected.

## Out-of-range behavior

The only policy is `FAIL`. Future execution must fail closed when raw points fall below the source minimum or above the source maximum.

## Clamping policy

Clamping, saturation, and linear extrapolation are not permitted.

## Rounding policy

No rounding rule, decimal-place setting, or formatted numeric conversion exists.

## Precision policy

The only precision policy is `PRESERVE_NATIVE`: future execution preserves native finite JavaScript arithmetic without truncation or epsilon correction.

## Validation order

Validation checks request shape, the validated aggregation-policy boundary, normalization object and identity, exact aggregation reference, factor, method, source shape and bound match, target ordering, out-of-range policy, and precision policy. Only the first deterministic failure is returned.

## Immutability

Validated policies defensively clone and freeze source and target ranges and the outer policy. They retain no aggregation-policy object, execution result, function, or runtime state.

## Determinism

Validation reads no aggregate result, clock, randomness, generated ID, persistence, or external state. Identical logical inputs produce deep-equal policies.

## Relationship to Phase 2K

Phase 2L does not import or call Phase 2K and does not consume its results. The Phase 2J policy provides the authoritative source identity and declared bounds.

## Relationship to future normalization execution

Piecewise interpolation, finite arithmetic checks, exact-zero handling, and out-of-range enforcement are deferred to a separately approved execution phase.

## Relationship to future decision bands

No threshold, band, permission, confidence, trade direction, BUY, SELL, HOLD, or NO_TRADE output exists.

## Relationship to legacy scoring

Legacy 0–100 normalization, rounding, templates, thresholds, and decisions remain unchanged and authoritative.

## Relationship to persistence

Policies are validated in memory and are not stored, registered, or queried.

## Relationship to runtime activation

No API, controller, route, scheduler, frontend, default composition, feature-flag connection, provider, LLM, RAG, or MCP is added. `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Future normalization has an explicit versioned two-segment mapping domain that supports asymmetric ranges without embedding legacy score or trade semantics.

## Deferred work

Normalization execution, normalized result contracts, decision bands, persistence, monitoring, APIs, scheduling, runtime activation, and authority migration.

## Rejected alternatives

Single global linear mapping; implicit source bounds; automatic bound copying; symmetric-only ranges; fixed 0–100 targets; midpoint-only neutral; zero-width segments; clamping; saturation; extrapolation; rounding settings; decimal libraries; normalized score calculation; decision thresholds; Phase 2K invocation; legacy scoring reuse.
