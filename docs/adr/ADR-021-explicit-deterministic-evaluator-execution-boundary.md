# ADR-021: Explicit Deterministic Evaluator Execution Boundary

Status: Accepted

Date: 2026-07-30

Phase: Phase 2G

## Context

Phase 2D supplies a safe assembled factor input, Phase 2E defines and validates synchronous deterministic evaluators, and Phase 2F resolves registered implementations. A narrow boundary is needed to execute one explicitly requested evaluator without introducing evaluator selection, aggregation, persistence, or runtime authority.

## Decision

Add a synchronous `ExplicitFactorEvaluatorExecutionService`. The caller supplies one already assembled factor input and one exact evaluator ID. The service resolves that ID once, verifies exact factor support, invokes the evaluator at most once, delegates every non-throwing return to Phase 2E validation, and returns only a sanitized deterministic result.

## Request boundary

The request contains only an exact non-empty pre-trimmed `evaluatorId` and an already assembled input. Phase 2G performs the minimum runtime shape validation needed for safe lookup, support checking, and Phase 2E validation. It accepts no configuration override, evaluator list, or fallback ID.

## Explicit evaluator selection

The caller supplies the exact evaluator ID. Phase 2G never selects an evaluator automatically or uses factor-based, version, case-insensitive, or default fallback.

## Registry lookup

The Phase 2F registry's `getById` is called exactly once with the caller's unchanged ID. An absent implementation fails closed as `EVALUATOR_NOT_FOUND`.

## Factor-support validation

The Phase 2E exact support helper is applied before execution. Unsupported input fails as `UNSUPPORTED_FACTOR` and the evaluator is not called.

## Single-invocation guarantee

`evaluate()` is called at most once. There is no retry after a throw or invalid return and no second evaluator is invoked.

## Synchronous execution

The evaluator port and execution service remain synchronous. Promise and thenable returns are detected without awaiting and fail as `INVALID_EVALUATOR_EXECUTION`.

## Typed evaluator failures

A contract-valid Phase 2E `evaluated: false` return is a successful boundary execution: Phase 2G returns `executed: true` with the validated typed failure. Boundary execution success therefore does not imply a normal factor evaluation.

## Unexpected exception handling

Only evaluator invocation is wrapped. Any thrown value becomes `EVALUATOR_EXECUTION_FAILED`; error types, messages, stacks, causes, and thrown objects are never exposed.

## Phase 2E result validation

Every non-throwing, non-Promise-like evaluator output is passed exactly once to `validateResult` with the resolved evaluator, exact assembled input, and exact raw execution. Phase 2G does not independently repair or reinterpret output.

## Invalid-result behavior

Any output rejected by Phase 2E fails closed as `INVALID_EVALUATOR_EXECUTION`. The raw output and validator details are not returned.

## Sanitized result contract

Failures contain only safe evaluator/factor identity and a boundary failure code. Success contains resolved evaluator identity metadata, exact factor identity, and the Phase 2E-validated execution.

## Immutability

Phase 2G does not mutate requests, inputs, declarations, supported factors, or results. It preserves Phase 2E's defensive cloned and frozen execution and freezes its own outer result. Boundary failures are frozen.

## Determinism

The boundary reads no clock, randomness, generated identifier, duration, provider, or external state. Identical deterministic evaluator behavior and input produce deep-equal output.

## Relationship to Factor Input Assembly

The caller supplies the assembled factor input. Phase 2G does not import or call Factor Input Assembly, Evidence reads, or source resolution.

## Relationship to evaluator registry

Phase 2F owns declaration validation and exact registration. Phase 2G uses only exact `getById` lookup and does not mutate or revalidate registry membership.

## Relationship to score aggregation

No contributions are summed, weighted, normalized, compared, or mapped to a final score or decision band.

## Relationship to legacy scoring

Legacy evaluator execution and scoring remain unchanged and authoritative. Phase 2G does not produce BUY, SELL, or HOLD decisions.

## Relationship to runtime activation

No API, controller, route, scheduler, persistence, or default runtime composition is added. `EVIDENCE_PIPELINE_ENABLED` remains OFF and runtime integration is deferred.

## Consequences

One explicit deterministic evaluator can be executed behind a small fail-closed boundary with stable failure semantics and validated immutable output, without expanding scoring authority.

## Deferred work

Production evaluator implementations, configured evaluator sets, aggregation, persistence, monitoring, APIs, scheduling, feature-flag activation, and authority migration.

## Rejected alternatives

Automatic factor-based selection; multiple-evaluator execution; invoking Factor Input Assembly; asynchronous evaluators; awaiting thenables; retrying failures; repairing invalid output; exposing raw exceptions; persisting results; aggregating contributions; integrating legacy scoring or runtime paths.
