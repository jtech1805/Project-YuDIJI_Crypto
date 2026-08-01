# ADR-022: Explicit Multi-Evaluator Execution Plan Contract

Status: Accepted

Date: 2026-07-30

Phase: Phase 2H

## Context

Phase 2G executes one explicitly selected deterministic evaluator. A later runner needs a caller-supplied, deterministic description of which registered evaluators to attempt, in what exact order, and under which bounded failure policy, without adding execution or score semantics to the plan boundary.

## Decision

Add a synchronous validation service and neutral types for one caller-supplied, single-factor execution plan. Validation preserves explicit step order, resolves exact evaluator IDs through Phase 2F, verifies factor support, snapshots safe metadata, and returns a defensively cloned and deeply frozen plan. Evaluators are not executed.

## Plan identity

Every plan carries a caller-supplied `planId` of 1–120 uppercase letters, numbers, or underscores. The identifier must be exact and pre-trimmed. Phase 2H generates no IDs.

## Plan versioning

`planVersion` is a caller-supplied positive integer. It is identity metadata, not a semantic version, registry selector, or upgrade instruction.

## Single-factor scope

One plan targets one exact registered `FactorKey` and, in a later runner, one assembled factor input for that factor. A plan cannot span inputs or factors.

## Step contract

Each step contains only a positive integer `order` and an exact, non-empty, pre-trimmed `evaluatorId`. Input values, results, weights, points, Evidence identity, and runtime state are excluded.

Malformed step objects or evaluator IDs fail as `INVALID_STEP`; non-positive, non-integer, or non-finite orders fail as `INVALID_STEP_ORDER`. Duplicate numeric orders use `DUPLICATE_STEP_ORDER`; other gaps or array-order mismatches use `INVALID_STEP_ORDER`. A non-array or sparse `steps` value is an `INVALID_PLAN`, while an empty dense array is an `EMPTY_PLAN`.

## Evaluator-ID uniqueness

Evaluator IDs must be unique within a plan. Repeating an ID has no approved meaning because Phase 2H defines no per-step configuration or input override.

## Plan-size bound

A plan contains 1–20 steps. Empty plans and plans of 21 or more steps fail; plans are never truncated or split.

## Caller-defined ordering

Array order is authoritative only when it agrees with explicit contiguous orders `1..N`. Validation rejects gaps, duplicates, and out-of-order arrays and never sorts or repairs steps.

## Registry validation

After all structural checks pass, validation calls Phase 2F `getById()` exactly once per step in plan order. It performs no discovery, factor-based selection, fallback, normalization, or version lookup. Missing evaluators fail closed.

## Factor-support validation

Every resolved evaluator must include the plan factor in its exact `supportedFactorKeys`. Factor support is checked without invoking the evaluator.

## Failure-policy taxonomy

Plans accept exactly `STOP_ON_ANY_FAILURE`, `CONTINUE_ON_EVALUATOR_FAILURE`, or `CONTINUE_ALWAYS`. These values are future-runner metadata and are not normalized.

## Termination semantics

`STOP_ON_ANY_FAILURE` stops a future runner after a Phase 2G boundary failure or a valid typed evaluator failure. `CONTINUE_ON_EVALUATOR_FAILURE` stops after boundary failures but continues after `executed: true` with `execution.evaluated: false`. `CONTINUE_ALWAYS` attempts every remaining step after either failure kind. No policy implies retry.

## Immutability

Validated plans, steps, and supported-factor arrays are defensively cloned and frozen. They retain no evaluator implementation references and are independent from later source-plan or evaluator-metadata mutation.

## Determinism

Validation follows a fixed first-failure order, preserves caller order, and reads no clock, randomness, generated identity, persistence, or external I/O. Identical logical inputs and registry metadata produce deep-equal results.

## Relationship to Phase 2G

Phase 2H defines plans only. It neither imports nor calls `ExplicitFactorEvaluatorExecutionService`. A future runner may resolve each ID again and repeatedly call Phase 2G.

## Relationship to future multi-evaluator runner

The runner, execution attempt records, retry behavior, and application of the frozen termination semantics are deferred. Phase 2H produces no evaluator result.

## Relationship to aggregation

No weights, contributions, normalization, aggregation method, final score, threshold, or decision band exists in the plan contract.

## Relationship to legacy scoring

Legacy evaluators, templates, execution, and scoring remain unchanged and authoritative. Phase 2H produces no BUY, SELL, or HOLD decision.

## Relationship to runtime activation

Plans are not persisted or registered at runtime. No API, controller, route, scheduler, frontend, provider, LLM, or default composition is added. `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Future orchestration can consume an explicit, bounded, immutable sequence with safe evaluator metadata and unambiguous termination policy without expanding scoring authority.

## Deferred work

Production plans, plan persistence, a plan registry, multi-evaluator execution, execution records, retries, aggregation, weighting, scoring, monitoring, APIs, scheduling, activation, and authority migration.

## Rejected alternatives

Automatic evaluator discovery; factor-based selection; version-selected evaluator IDs; duplicate steps; implicit array-only ordering; silent sorting; unbounded plans; executable objects in validated plans; per-step inputs or weights; plan persistence; Phase 2G execution during validation; legacy scoring integration.
