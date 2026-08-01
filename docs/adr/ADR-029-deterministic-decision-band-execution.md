# ADR-029: Deterministic Decision-Band Execution

Status: Accepted

Date: 2026-08-01

Phase: Phase 2O

## Context

Phase 2M returns a normalized score and Phase 2N provides a complete immutable semantic interval policy. A separate pure boundary is needed to classify one score without conflating normalization, policy validation, or production trading action.

## Decision

Add one synchronous classifier. It consumes one defensively checked Phase 2N policy and one Phase 2M success, requires exact normalization identity, factor, and target range, then returns exactly one matching immutable semantic band.

## Matching

Bands are examined in validated order. The first four use `minimum <= score < maximum`; the final band uses `minimum <= score <= maximum`. A shared boundary therefore belongs to the later band and the normalized maximum belongs to the final band. Zero and multiple matches fail closed.

## Numeric safety

The normalized score must be finite and inside the inclusive normalized range. No clamping, rounding, coercion, tolerance, or repair occurs.

## Data minimization, immutability, and determinism

Success retains only required band, normalization, aggregation, plan, factor, range, and score metadata. The selected band, range, and outer result are newly created and frozen. No policy/result object, clock, randomness, generated ID, timestamp, persistence, I/O, or external state is retained or read.

## Semantic limitation

`STRONG_NEGATIVE`, `NEGATIVE`, `NEUTRAL`, `POSITIVE`, and `STRONG_POSITIVE` describe only score position. They are not BUY, SELL, HOLD, long, short, order, broker, permission, confidence, sizing, stop-loss, or take-profit instructions.

## Relationships

Phase 2O does not call Phase 2M or Phase 2N services and does not modify legacy scoring. Legacy scoring remains authoritative, no runtime activation exists, and `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

The deterministic factor pipeline can end in an auditable semantic classification while remaining disconnected from production trading authority.

## Deferred work

Persistence, monitoring, APIs, scheduling, runtime activation, user presentation, and any future authority migration.

## Rejected alternatives

First-match acceptance without uniqueness checking; arbitrary boundary inclusivity; clamping; rounding; epsilon comparison; trade-action translation; confidence fabrication; embedded normalization or policy validation calls.
