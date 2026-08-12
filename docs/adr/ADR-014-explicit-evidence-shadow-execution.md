# ADR-014: Explicit Evidence Shadow Execution

Status: Accepted

Date:
2026-07-30

Phase:
Phase 1H

## Context

Phase 1G provides explicit, in-memory observability for already completed provider runs. A narrow application boundary is needed to coordinate timing, the generic runner, and observability without creating an automatic runtime path or coupling those components.

## Decision

Add an explicitly constructed `EvidenceShadowExecutionService`. Execution is caller-triggered only. The caller supplies an already constructed `EvidenceProviderAdapter`; the executor has no scheduler, provider registry, or responsibility for creating provider clients.

## Execution boundary responsibility

The executor captures start time, invokes the runner exactly once, captures completion time, records every typed runner result exactly once, and returns a minimized result. It performs no retry, timeout, registration, scheduling, logging, persistence, or provider-specific translation.

## Runner responsibility

`EvidenceProviderRunnerService` remains responsible for adapter validation, reading bounded candidates, sequential ingestion, candidate failure isolation, and typed batch results. Runner results with `COMPLETED`, `PARTIAL`, or `FAILED` are all passed unchanged to observability.

A typed runner `FAILED` result is a completed orchestration that can be recorded; it is not an executor `EXECUTION_FAILED` result.

## Observability responsibility

`EvidenceObservabilityService` validates typed run results, updates bounded process-local operational state, and derives adapter health. That operational state remains separate from Evidence.

## Clock and timing semantics

One injected `Clock` is read before and after runner execution, including unexpected-runner-failure paths where possible. Valid dates are cloned, zero duration is accepted, and duration is the exact non-negative millisecond difference.

An invalid initial clock throws typed `EvidenceShadowExecutionError` with `INVALID_CLOCK` before the runner is called. An invalid or backwards completion returns `EXECUTION_FAILED` with `INVALID_CLOCK`, substitutes the cloned start instant as the safe completion, reports zero duration, and skips observability.

The service does not read the system wall clock.

## Execution-result contract

`RECORDED` contains timing, a safe aggregate run summary, and cloned health. `OBSERVABILITY_FAILED` contains timing and the safe run summary without fabricated health. `EXECUTION_FAILED` contains timing, a safe adapter identifier, and a safe failure code.

No result returns runner `results`, candidate indexes or values, Evidence records or identifiers, deduplication keys, validation messages, provider payloads, credentials, raw exceptions, or stack traces.

## Runner failure behavior

The runner normally converts adapter and candidate failures into typed results. If an unexpected exception escapes the runner, the executor captures completion time, does not call observability, returns `EXECUTION_FAILED` with `RUNNER_EXECUTION_FAILED`, and does not expose the exception.

## Observability failure behavior

If recording throws after a typed runner result, the executor returns `OBSERVABILITY_FAILED` with the safe run summary. It does not claim health was recorded, fabricate health, expose the exception, or retry.

## No-retry policy

Runner execution and observability recording are each attempted at most once. Retries, backoff, and timeout policy are deferred to a future explicitly approved boundary.

## Data-minimization policy

The executor retains and returns only aggregate counts, frozen statuses and failure codes, adapter identity, timing, and recorded health. It does not log.

## Manual and test-only usage

The service is available only to explicit callers and tests. No runtime activation, startup hook, manual script, controller, route, scheduler, WebSocket, or automatic provider registration is introduced.

## Relationship to concrete adapters

The executor accepts the frozen provider-independent adapter port. It does not import, instantiate, configure, or otherwise depend on Binance or any other concrete adapter or client.

## Relationship to Evidence

The executor never produces candidates or persists Evidence directly. All Evidence ingestion remains behind the generic runner and ingestion service. The Evidence feature remains OFF.

## Relationship to scoring

No scoring, alert, trade, LLM, RAG, vector, MCP, or frontend consumer is added. Legacy scoring remains authoritative.

## Consequences

- Explicit shadow callers receive one deterministic, privacy-safe orchestration outcome.
- Typed failed provider runs contribute to health without being confused with infrastructure failure.
- Unexpected runner and observability failures remain isolated and sanitized.
- The boundary is deliberately dormant until a future ADR authorizes runtime wiring.

## Deferred work

- Runtime activation and feature-flag policy.
- Provider registry or composition-root wiring.
- Scheduling, retry, timeout, and distributed execution.
- Persistent history, metrics export, alerting, and dashboards.
- Scoring or other business consumers.

## Rejected alternatives

1. Add runner-side observability as a hidden side effect.
2. Automatically construct, register, or schedule concrete adapters.
3. Return candidate-level results or raw errors.
4. Treat a typed batch `FAILED` result as executor infrastructure failure.
5. Retry runner or observability failures.
6. Persist execution history or health as Evidence.
