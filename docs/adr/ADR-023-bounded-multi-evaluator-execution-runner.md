# ADR-023: Bounded Multi-Evaluator Execution Runner

Status: Accepted

Date: 2026-07-31

Phase: Phase 2I

## Context

Phase 2H validates a bounded caller-defined evaluator sequence, while Phase 2G safely executes one exact evaluator. A narrow runner is needed to apply the plan’s failure policy and return an ordered categorical report without introducing score aggregation or runtime authority.

## Decision

Add one synchronous `FactorEvaluatorPlanRunnerService`. It accepts one already validated Phase 2H plan and one already assembled Phase 2D input, performs defensive boundary checks, delegates each attempted step exactly once to Phase 2G in plan order, applies the frozen policy, and returns an immutable minimized report.

## Input boundary

The request contains only one validated plan and one assembled input. It contains no plan lookup, raw-plan contract, evaluator implementation, weight, aggregation configuration, or assembly request.

## Validated-plan requirement

Only the safe Phase 2H output is accepted. Phase 2I defensively checks its runtime shape, bound, exact contiguous order, identity, versions, and failure policy, but does not call the Phase 2H validator, perform registry lookup, or revalidate evaluator support.

## Single-factor consistency

The validated plan factor and assembled input factor must match exactly before execution begins.

## Sequential execution

Steps are attempted synchronously in their existing validated array order. Phase 2I never sorts, repairs, discovers, or automatically selects evaluators.

## Maximum-step policy

The runner accepts 1–20 dense steps. Phase 2H owns the normal bound; Phase 2I rejects runtime bypasses defensively.

## Phase 2G delegation

Every attempted step calls Phase 2G with only the exact step evaluator ID and the unchanged assembled input. No evaluator or registry is accessed directly.

## Single-invocation guarantee

Phase 2G is called once per attempted step. There are no retries. Skipped steps are never delegated.

## Failure-policy application

`STOP_ON_ANY_FAILURE` stops before the next step after either failure category. `CONTINUE_ON_EVALUATOR_FAILURE` continues after typed evaluator failures but stops before the next step after boundary failures. `CONTINUE_ALWAYS` attempts every step after either category.

## Boundary-failure semantics

A Phase 2G `executed: false` result is a boundary failure. An unexpected Phase 2G throw is replaced with a sanitized `EVALUATOR_EXECUTION_FAILED` boundary result. A malformed result or identity-inconsistent success is replaced with `INVALID_EVALUATOR_EXECUTION`. Both replacements use the plan evaluator ID and input factor and are processed through the same policy without retry.

## Typed evaluator-failure semantics

A Phase 2G `executed: true` result whose execution has `evaluated: false` is a typed evaluator failure, distinct from a boundary failure.

## Skipped-step semantics

After early termination, every remaining plan step receives an explicit metadata-only `SKIPPED_AFTER_TERMINATION` report with `execution: null`. Original order and evaluator version metadata are preserved.

## Completion semantics

`COMPLETED` means every plan step was attempted; it does not imply every evaluation succeeded. A failure on the final step still produces `COMPLETED`.

## Termination semantics

`STOPPED` is used only when a policy prevents one or more remaining steps from being attempted. Its termination metadata identifies the triggering attempted step and its boundary or typed-evaluator failure category. Completed runs use `NONE` and null step identity.

## Execution-report contract

The report contains plan identity, factor, policy, completion status, termination metadata, categorical counts, and one ordered attempted-or-skipped report per plan step. It contains sanitized Phase 2G results for attempted steps.

## Data minimization

Reports add no assembled input, factor value, complete Evidence, provider payload, evaluator implementation, registry state, raw exception, stack, timestamp, duration, generated ID, contribution summary, or score.

## Immutability

The runner does not mutate requests, plans, steps, inputs, dates, or Phase 2G results. It defensively clones and freezes report structures and sanitized Phase 2G result data.

## Determinism

Control flow reads only validated plan order, failure policy, and Phase 2G discriminators. No clock, randomness, generated identifier, I/O, or persistence is used. Identical inputs and Phase 2G outputs produce deep-equal reports.

## Relationship to Phase 2H

Phase 2H remains the raw-plan validation and registry-support boundary. Phase 2I consumes its output and does not duplicate or invoke that service.

## Relationship to Phase 2G

Phase 2G exclusively owns evaluator resolution and execution. Phase 2I delegates once per attempted step and never invokes evaluators directly.

## Relationship to aggregation

The runner does not inspect contributions for control flow, aggregate points, apply weights, calculate totals, normalize outcomes, or produce decision bands.

## Relationship to legacy scoring

Legacy scoring remains unchanged and authoritative. Phase 2I produces no BUY, SELL, or HOLD decision.

## Relationship to persistence

Execution reports are returned in memory and are not persisted or registered.

## Relationship to runtime activation

No API, controller, route, scheduler, frontend, default composition, provider, LLM, RAG, MCP, or feature-flag connection is added. `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Future composition can observe a deterministic ordered execution report with explicit skipped work and failure categories while scoring semantics remain deferred.

## Deferred work

Production plans and evaluators, aggregation, weighting, scoring, report persistence, monitoring, APIs, scheduling, activation, and authority migration.

## Rejected alternatives

Raw-plan validation in the runner; direct registry or evaluator access; asynchronous or parallel execution; retries; silent skipped steps; stopped status for a final-step failure; trusting malformed Phase 2G output; exception leakage; contribution inspection; score aggregation; report persistence; legacy scoring integration.
