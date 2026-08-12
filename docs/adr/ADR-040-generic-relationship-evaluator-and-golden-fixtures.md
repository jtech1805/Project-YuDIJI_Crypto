# ADR-040: Generic Relationship Evaluator and Golden Fixtures

Status: Accepted

## Context and decision

ADR-039 permits only DIRECT and INVERSE single-factor execution today. `GenericRelationshipFactorEvaluator` reuses the existing Phase 2 evaluator port and result contract; it is not a parallel framework and is not registered by default.

Its exact identity is `GENERIC_RELATIONSHIP_FACTOR_EVALUATOR`, evaluator version 1, configuration version 1. It supports only `CRYPTO.ETF_NET_FLOW`, `DIRECT`, and `INVERSE`. Configuration owns exact `USD` unit, four strictly ordered finite thresholds, five finite contributions, and contribution bounds. Validation returns the first failure in the ADR-039 order.

## Execution and outcomes

DIRECT assigns configured band contribution. INVERSE negates directional contribution but preserves canonical neutral `0`; it never mutates values or units. Positive points map to `PASS`, negative to `FAIL`, and zero to `NEUTRAL`. Evidence lineage and explicit evaluation time are copied from the assembled input. Reason codes are deterministic `<strength><direction>_<relationship>_RELATIONSHIP` values. Missing input cannot reach this port as a fabricated neutral result.

CONDITIONAL returns configuration validation `CONDITION_BINDING_REQUIRED`; compiled condition execution is deferred. CONFIRMATION_ONLY, RISK_ONLY, and VETO are represented in golden contract fixtures by their typed support classification and never by fabricated Phase 2 points.

## Golden fixtures and safety

The fixture suite covers five DIRECT bands, five INVERSE bands, exact boundaries, native fractional precision, CONDITIONAL binding-required, confirmation cross-factor deferral, risk-axis deferral, and veto-channel deferral. It also proves ordered configuration rejection, wrong factor/unit rejection, detached frozen output, deterministic rerun, explicit test registration, and an empty default registry.

The evaluator is synchronous and has no repository, provider, Evidence read, network, system clock, template, or legacy-scoring dependency. Inputs are not mutated; outputs and nested records are frozen.

## Consequences, deferred work, and rejected alternatives

This provides the minimum honest arithmetic proof while retaining ownership boundaries. Conditional execution awaits compiled rulebooks. Confirmation, risk, and veto await their dedicated engines and typed outputs. Production registration and runtime activation are deferred.

Rejected alternatives include a new evaluator framework, automatic registration, evaluator-side dependency fetching, using unavailable as zero, flattening deferred semantics into points, and rounding native values.
