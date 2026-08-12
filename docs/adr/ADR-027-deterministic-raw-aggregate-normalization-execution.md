# ADR-027: Deterministic Raw Aggregate Normalization Execution

Status: Accepted

Date: 2026-08-01

Phase: Phase 2M

## Context

Phase 2K returns a bounded raw aggregate and Phase 2L validates exact zero-anchored normalization instructions. A separate pure execution boundary is required to apply those instructions without introducing decision semantics or legacy-scoring authority.

## Decision

Add one synchronous normalization execution service. It defensively validates one Phase 2L policy and one Phase 2K success, requires exact aggregation identity, factor, and declared source bounds, and returns one immutable normalized numeric result.

## Mapping

`PIECEWISE_LINEAR_ZERO_ANCHORED` is the only method. Source minimum maps exactly to target minimum, positive or negative zero maps exactly to target neutral, and source maximum maps exactly to target maximum. Interior negative and positive values use independent linear segments.

## Range and numeric safety

Raw values must be finite and inside the inclusive source range. Normalized arithmetic must remain finite and inside the inclusive target range. `FAIL` prohibits clamping, saturation, and extrapolation. `PRESERVE_NATIVE` prohibits rounding, truncation, formatting, and epsilon adjustment.

## Identity and data minimization

Aggregation policy ID/version and factor must match exactly. Source bounds must exactly equal Phase 2K declared bounds. Success retains only required policy, plan, factor, range, raw value, segment, normalized value, and method metadata; it retains no policy object, aggregation object, steps, Evidence, or diagnostics.

## Immutability and determinism

Nested ranges and the outer result are newly created and frozen. No input is mutated. No clock, randomness, generated ID, persistence, I/O, or external state is read.

## Relationships

Phase 2M consumes but does not call Phase 2K or Phase 2L services. It produces no band, confidence, permission, BUY, SELL, HOLD, order, or position instruction. Legacy scoring remains unchanged and authoritative, and `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Future semantic classification can consume an exact deterministic normalized score without coupling arithmetic to band policy or production trading behavior.

## Deferred work

Decision-band contracts and execution, persistence, monitoring, APIs, scheduling, runtime activation, and authority migration.

## Rejected alternatives

Single global slope; implicit identity or bounds; clamping; extrapolation; rounding; decimal libraries; configurable precision; direct aggregation execution; embedded decision thresholds; legacy score reuse.
