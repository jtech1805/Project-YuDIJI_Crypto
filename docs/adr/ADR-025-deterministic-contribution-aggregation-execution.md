# ADR-025: Deterministic Contribution Aggregation Execution

Status: Accepted

Date: 2026-08-01

Phase: Phase 2K

## Context

Phase 2J validates exact aggregation instructions and Phase 2I returns ordered execution reports. A pure boundary is needed to classify report steps, apply raw weights to eligible Phase 2E contributions, and enforce policy bounds without introducing final-score or decision semantics.

## Decision

Add one synchronous dependency-free aggregation service. It accepts one validated Phase 2J policy and one successful Phase 2I report, verifies exact identity and coverage, projects categorical step results, calculates an ordered raw weighted sum, and returns a safe immutable result.

## Input boundary

The request contains only a validated policy and a `ran: true` execution report. Raw policies, raw plans, failed run results, inputs, evaluators, registries, normalization settings, and decision thresholds are excluded.

## Validated-policy requirement

The service defensively checks the validated policy shape, fixed outcome eligibility, `WEIGHTED_SUM`, zero-containing finite bounds, 1–20 contiguous entries, exact evaluator metadata, and weights satisfying `0 < weight <= 100`. It does not call the Phase 2J validator.

## Successful-run-report requirement

Only a defensively safe `ran: true` Phase 2I report is accepted. Both `COMPLETED` and `STOPPED` reports are valid. Phase 2I is not invoked.

## Policy/report identity consistency

Plan ID, plan version, and factor key must match exactly. There is no lookup, fallback, normalization, or repair.

## Exact step coverage

Policy and report step counts must match. Corresponding steps must have the same order, evaluator ID, evaluator version, and configuration version. Matching occurs by array index and never by sorting or map lookup.

## Eligibility classification

Every report step is projected as eligible or ineligible with one exact reason. Ineligible steps are excluded rather than assigned synthetic zero contributions.

## PASS semantics

An internally consistent evaluated `PASS` step is eligible and its positive validated contribution is weighted.

## FAIL semantics

An internally consistent evaluated `FAIL` step is eligible and its negative validated contribution is weighted without special treatment.

## NEUTRAL semantics

An internally consistent evaluated `NEUTRAL` step is eligible. Its Phase 2E-valid zero is a real contribution, not failure substitution.

## UNAVAILABLE semantics

An evaluated `UNAVAILABLE` step is ineligible and exposes no contribution in the aggregation projection. Its underlying Phase 2E contribution must still be structurally valid and zero.

## Typed evaluator failure semantics

An internally consistent `TYPED_EVALUATOR_FAILURE` step is ineligible and exposes no contribution.

## Boundary failure semantics

An internally consistent `BOUNDARY_FAILURE` step is ineligible and exposes no contribution.

## Skipped-step semantics

A `SKIPPED_AFTER_TERMINATION` step with null execution is ineligible and exposes no contribution.

## Weight application

Weights are raw positive multipliers, not percentages. Eligible contribution points and bounds are multiplied directly by the corresponding policy weight.

## WEIGHTED_SUM arithmetic

Eligible weighted points are summed sequentially in report order using native JavaScript number arithmetic. Ineligible steps add nothing. No average or alternate method exists.

## Theoretical bound calculation

The weighted minimum and maximum of each actually eligible step are summed in order. Ineligible steps do not expand the theoretical range.

## Declared aggregate-bound validation

The theoretical minimum must be at least the declared minimum and the theoretical maximum at most the declared maximum. Otherwise execution fails before accepting current aggregate points.

## Actual aggregate-bound validation

The raw aggregate must fall inclusively inside the declared policy bounds. No repair or clamp occurs.

## Numeric safety

Every contribution is validated before arithmetic. Each multiplication and ordered sum must remain finite. Overflow fails closed with a typed sanitized code.

## No rounding

No `Math.round`, `toFixed`, decimal library, or epsilon correction is used. Native binary floating-point results are preserved exactly.

## No normalization

Weights are not normalized, totals are not converted to percentages, and no 0–100 score transformation exists.

## Aggregation result contract

Success contains policy/plan/factor identity, raw aggregate points, declared and theoretical bounds, categorical summary counts, and minimized eligible-or-ineligible step projections.

## Data minimization

Results omit the raw policy, report, Phase 2G execution, assembled input, Evidence, source payloads, diagnostics, reasons, warnings, errors, stacks, and legacy scoring data.

## Immutability

Inputs and nested source data are never mutated. Result bounds, summaries, step projections, contributions, weighted contributions, arrays, and the outer result are newly created and frozen.

## Determinism

No clock, randomness, generated identifier, parallel reduction, persistence, or external state is used. Identical policy and report inputs produce deep-equal results.

## Relationship to Phase 2J

Phase 2J remains the raw policy validation boundary. Phase 2K consumes its validated output without calling its service.

## Relationship to Phase 2I

Phase 2I remains the evaluator runner. Phase 2K consumes a successful report and never invokes the runner or evaluators.

## Relationship to future score normalization

The raw bounded aggregate may feed a separately approved normalization phase. Phase 2K defines no final score.

## Relationship to decision bands

No thresholds, bands, permissions, trade direction, BUY, SELL, or HOLD output exists.

## Relationship to legacy scoring

Legacy weighted averages, normalization, rounding, templates, and decisions remain unchanged and authoritative.

## Relationship to persistence

Aggregation results are returned in memory and are not stored or registered.

## Relationship to runtime activation

No API, controller, route, scheduler, frontend, default composition, feature-flag connection, provider, LLM, RAG, or MCP is added. `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Validated deterministic contributions can produce an auditable raw bounded aggregate while score normalization and authority remain explicitly deferred.

## Deferred work

Final-score normalization, score bands, decisions, persistence, monitoring, APIs, scheduling, runtime activation, and authority migration.

## Rejected alternatives

Raw-policy validation service calls; failed run reports; identity repair; map-based reordering; synthetic zero for ineligible steps; normalized weights; percentages; averaging; rounding; clamping; parallel or sign-sorted sums; evaluator or registry access; persistence; legacy scoring reuse.
