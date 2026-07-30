# ADR-019: Deterministic Factor Evaluator Contract

Status: Accepted

Date: 2026-07-30

Phase: Phase 2E

## Context

Phase 2D produces one safe assembled factor input, but no provider-independent contract defines how future deterministic evaluators declare identity, support, contributions, outcomes, audit references, and safe diagnostics.

## Decision

Add neutral evaluator types, a synchronous deterministic evaluator port, and a pure contract-validation service. No production evaluator or evaluator registry is added.

## Evaluator identity

An evaluator declares an immutable uppercase identifier plus positive integer evaluator and configuration versions. Declaration validation never invokes the evaluator.

## Evaluator versioning

Evaluator logic and configuration versions are explicit independent positive integers. Returned evaluator identity must exactly match the declaration.

## Input contract

Evaluators consume only `AssembledFactorInput`. They cannot read Evidence, call Factor Input Assembly, select sources, fetch providers, or read a clock.

## Supported-factor policy

Supported factor keys are a non-empty, duplicate-free, exact list of registered `FactorKey` values. Unsupported inputs fail before normal result validation. No key normalization occurs.

## Configuration contract

Future evaluator-specific parameters use a versioned generic configuration envelope. Phase 2E defines no market-price strategy parameters.

## Outcome taxonomy

Outcomes are `PASS`, `FAIL`, `NEUTRAL`, and `UNAVAILABLE`. Unsupported factors are typed failures, not `UNAVAILABLE` results.

## Contribution contract

Each result declares finite points, minimum points, and maximum points. Values are not rounded and Phase 2E defines no business-specific point schedule.

## Contribution bounds

Minimum must not exceed maximum and points must remain inclusively within the declared range.

## Reason-code policy

One non-empty, pre-trimmed, uppercase machine identifier of at most 160 characters is required. Only letters, numbers, and underscores are accepted. Free-form text is non-authoritative and omitted from the contract.

## Diagnostics policy

Diagnostics are supplementary, primitive-only, and immutable. At most 20 entries are allowed; keys and string values are bounded; numbers must be finite; nested data, raw payloads, credentials, complete Evidence, stacks, and exception objects are forbidden.

## Result validation

Validation checks evaluator identity, factor, subject, Evidence ID, definition version, safe source identity, timestamps, outcome, contribution, reason code, diagnostics, and strict result shape. Valid results are defensively cloned and frozen.

## Error behavior

Ordinary declaration and result validation return typed failures rather than throwing. Failed executions accept only approved safe codes and exact-or-null evaluator/factor identity. Raw errors are rejected and never returned.

## Determinism requirements

Evaluator implementations must be pure, synchronous, deterministic, and free of randomness, clocks, I/O, network calls, database writes, providers, and LLMs.

## Immutability

Evaluator declarations, supported keys, assembled inputs, executions, diagnostics, and dates are not mutated. Valid returned results contain frozen cloned structures and cloned dates.

## Relationship to Factor Input Assembly

The port consumes Phase 2D’s safe envelope but never calls its service.

## Relationship to evaluator registry

The port is independent from the legacy evaluator registry. No new registry exists, and the approved legacy evaluator cycle is not entered.

## Relationship to score aggregation

No contribution is summed, weighted, normalized, or mapped to a band. No factor score or final score is calculated.

## Relationship to legacy scoring

Legacy scoring and its evaluators remain unchanged and authoritative. No BUY, SELL, HOLD, permission, or trade decision is produced.

## Relationship to AI

Evaluators cannot use LLMs, RAG, vector stores, MCP, or nondeterministic AI output.

## Consequences

Future evaluators have a strict deterministic boundary with safe audit identity and bounded contributions, while runtime composition and business policy remain deferred.

## Deferred work

Production evaluators, evaluator-specific configurations and reason codes, a new registry, execution orchestration, score aggregation, templates, APIs, scheduling, monitoring, and runtime activation.

## Rejected alternatives

Reusing the cyclic legacy registry contract; asynchronous evaluation; evaluator-owned Evidence reads; unbounded diagnostics; free-form reasons; implicit versions; global point ranges; production market-price logic; score aggregation or trade decisions.
