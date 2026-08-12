# ADR-039: Generic Factor Relationship Semantics

Status: Accepted

## Context and problem

Phase 3R requires relationship meaning to be explicit before generic evaluation. A single numeric scoring formula cannot safely represent direction, cross-factor confirmation, risk, and veto. Relationship configuration is owned by a future compiled rulebook; factor definitions continue to own measurable concepts and Phase 2 continues to own deterministic single-factor evaluation.

## Decision

The exact vocabulary is `DIRECT`, `INVERSE`, `CONDITIONAL`, `CONFIRMATION_ONLY`, `RISK_ONLY`, and `VETO`. Unknown values fail closed. The canonical classifier is immutable and deterministic.

- `DIRECT` maps higher input bands to higher bounded directional contributions and lower bands to lower contributions. It can return positive, neutral, or negative points.
- `INVERSE` uses the same ordered bands but reverses contribution meaning. It can return positive, neutral, or negative points; missing data is never inverted.
- `CONDITIONAL` requires an explicit, already-resolved condition binding. It may delegate to configured DIRECT or INVERSE arithmetic only after compiled configuration exists. It must not fetch another factor. Stage 3R-E validates its contract but does not execute it.
- `CONFIRMATION_ONLY` belongs to future cross-factor processing. Without a base directional state it produces no direction and no points.
- `RISK_ONLY` belongs to a future risk axis. Its future output requires typed risk metadata and produces no directional points.
- `VETO` belongs to a future decision-blocking channel. Its future output requires a typed veto result and produces no points; extreme negative scores are prohibited.

DIRECT and INVERSE are `SINGLE_FACTOR_EXECUTABLE`. CONDITIONAL is `CONDITION_BINDING_REQUIRED`. The other states explicitly identify their deferred owner. Multiple semantics may coexist only in a future caller-owned execution plan; an evaluator instance has one frozen relationship configuration.

## Inputs, configuration, and thresholds

Execution consumes one preassembled Phase 2 factor input. Configuration supplies relationship type, evaluator/configuration versions, expected unit, finite ordered thresholds, bounded finite contributions, and—eventually for CONDITIONAL—an explicit condition result and base relationship. Threshold order is `strongNegativeMax < negativeMax < positiveMin < strongPositiveMin`; equality/overlap fails validation. The first failure is returned in this order: relationship, supported factor, unit, finite thresholds, ordered thresholds, finite contributions, bounds, condition policy.

Missing factor input is represented by the existing Phase 2 unavailable/failure boundary and never as neutral zero. Reason codes are singular under the existing evaluator result contract; fixture and adapter reason lists preserve caller-declared order where lists exist.

## Outputs and compatibility

DIRECT and INVERSE return the existing immutable Phase 2 result with `PASS` for positive contribution, `FAIL` for negative, and `NEUTRAL` for zero. Missing input is `UNAVAILABLE` with zero only as an explicit unavailable outcome. Contribution bounds are validated by the Phase 2 contract.

Only completed DIRECT and INVERSE results are initially eligible for legacy translation. CONDITIONAL, CONFIRMATION_ONLY, RISK_ONLY, and VETO fail compatibility translation until their owning contracts are implemented. Deferred states are relationship-contract outcomes, not fabricated Phase 2 results.

## Determinism, testing, and consequences

Evaluation has no repository, provider, network, clock, template, or legacy-scoring access. Identical input and frozen configuration produce deep-equal output. Tests freeze exact vocabulary, uniqueness, immutability, classification, and unknown-value rejection. Stage 3R-E adds DIRECT/INVERSE execution and honest golden fixtures for all semantics without default registry registration.

This keeps single-factor arithmetic in Phase 2 while reserving confirmation for the future cluster/conflict engine, risk for decision axes, and veto for the decision layer. It prevents hidden dependency fetching and numeric risk/veto hacks.

## Deferred work and rejected alternatives

Compiled condition bindings, cross-factor confirmation, risk metadata, veto channels, and mixed-semantic plans are deferred. Rejected alternatives are treating every semantic as points, allowing confirmation to originate direction, querying dependencies inside an evaluator, representing veto as `-999`/`-Infinity`, and silently treating missing input as neutral.
