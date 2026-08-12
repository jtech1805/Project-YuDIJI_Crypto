# ADR-028: Deterministic Decision-Band Contract

Status: Accepted

Date: 2026-08-01

Phase: Phase 2N

## Context

Phase 2M produces a normalized number, but classification requires an explicit versioned interval policy rather than embedded thresholds or legacy trade permissions.

## Decision

Add immutable policy types and one synchronous validation service. A policy targets one exact Phase 2L normalization identity, factor, and normalized minimum/maximum. It defines exactly five caller-thresholded analytical bands in the frozen order `STRONG_NEGATIVE`, `NEGATIVE`, `NEUTRAL`, `POSITIVE`, `STRONG_POSITIVE`.

## Interval convention

Every band has an inclusive minimum. The first four have exclusive maxima; the final band has an inclusive maximum. Bands are contiguous, finite, ascending, non-zero-width, gap-free, overlap-free, and cover the complete normalized range exactly.

## Identity and validation

Policy IDs are caller-supplied uppercase identifiers of 1–120 characters and versions are positive integers. Validation uses fixed first-failure order, rejects malformed runtime normalization policies, and neither infers nor repairs thresholds.

## Immutability and determinism

The normalized range, every band, the band array, and outer validated policy are defensively cloned and frozen. Validation reads no score, clock, randomness, generated ID, persistence, I/O, or external state.

## Semantic limitation

Band labels describe only normalized factor-score position. They are not BUY, SELL, HOLD, long, short, broker, order, confidence, or permission outputs. Phase 2N performs no runtime classification.

## Relationships

Phase 2N references but does not execute normalization. It does not modify or invoke legacy scoring, which remains authoritative. No runtime activation exists and `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Future classification receives a total, unambiguous interval partition independently from normalization arithmetic and production trading behavior.

## Deferred work

Decision-band execution, persistence, monitoring, APIs, scheduling, runtime activation, and authority migration.

## Rejected alternatives

Configurable inclusivity; fewer or additional bands; arbitrary label order; gaps; overlaps; zero-width intervals; implicit endpoints; hard-coded 20/40/60/80 thresholds; BUY/SELL/HOLD labels; runtime classification in the validator.
