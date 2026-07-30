# ADR-020: Deterministic Factor Evaluator Registry

Status: Accepted

Date: 2026-07-30

Phase: Phase 2F

## Context

Phase 2E defines a deterministic evaluator port and validation boundary. Future orchestration needs an immutable, predictable way to register valid implementations without reusing the authoritative legacy evaluator registry or inventing production factor logic.

## Decision

Add a code-supplied `StaticDeterministicFactorEvaluatorRegistry`. It validates every supplied evaluator exactly once through Phase 2E, snapshots declaration metadata, indexes exact evaluator IDs and supported factors, and never executes an evaluator.

## Registry identity

Exact `evaluatorId` is the primary key. Evaluator and configuration versions are audit metadata rather than lookup or upgrade selectors.

## Construction validation

The evaluator collection must be a dense array. Every entry is delegated once to `FactorEvaluatorContractService.validateEvaluator`; ordinary invalid declarations fail construction with a sanitized typed error.

## Empty-registry policy

Empty construction is valid. The default production collection and registry are empty because no production evaluator has been approved.

## Duplicate-ID policy

Duplicate exact evaluator IDs fail construction regardless of evaluator version, configuration version, or supported factors. First/last wins and automatic replacement are forbidden.

## Version metadata

Versions are snapshotted into safe summaries. There is no latest-version lookup, semantic-version comparison, automatic upgrade, or version preference.

## Factor-support indexing

Every snapshotted supported factor maps to all matching evaluator IDs. Multiple evaluators may support one factor. No evaluator is automatically selected.

## Lookup behavior

`getById` returns the retained implementation reference for future explicit execution. `list` and `listByFactor` return safe summaries. `getImplementationsByFactor` returns all implementation references in a fresh protected array because future orchestration cannot execute summaries.

## Ordering behavior

All lists sort by exact evaluator ID ascending. Construction order and version numbers do not affect ordering.

## Unknown lookup behavior

Unknown, malformed, or non-string evaluator IDs return `null`. Unknown or malformed factors return an empty immutable list. No normalization occurs.

## Immutability

Registry maps, factor indexes, identity metadata, and supported-factor arrays are snapshotted at construction. Summary calls return new frozen arrays with new frozen summaries and factor arrays. Implementation-list array mutation cannot affect registry structure.

## Evaluator-instance policy

The original implementation reference is retained and never cloned or invoked. A hostile caller may mutate its object, but such mutation cannot alter registry summaries, indexes, or lookup membership because all structural metadata is snapshotted.

## Relationship to Phase 2E validation

Every supplied evaluator is validated exactly once during construction by an injected narrow Phase 2E validation dependency. Lookups do not revalidate.

## Relationship to Factor Input Assembly

The registry does not import, call, or read Factor Input Assembly.

## Relationship to execution orchestration

No evaluator executes and no automatic selection exists. Explicit configured execution orchestration is deferred.

## Relationship to legacy evaluator registry

This registry is separate from the legacy evaluator registry and does not import, modify, bridge, or replace legacy evaluator keys or implementations.

## Circular-dependency isolation

The new registry imports only neutral Phase 2E contracts and validation. It does not enter `LEGACY-CYCLE-006` and introduces no new cycle.

## Consequences

Registration and discovery are deterministic, immutable, fail-closed, and ready for future explicit orchestration while accurately representing that no production evaluator exists.

Existing scoring remains authoritative and Evidence remains disconnected from production decisions.

## Deferred work

Production evaluators, explicit configured evaluator sets, execution orchestration, runtime discovery, score aggregation, template mapping, APIs, scheduling, monitoring, and activation.

## Rejected alternatives

Legacy-registry reuse; dynamic imports; plugin or container discovery; database persistence; placeholder production evaluators; duplicate-ID replacement; version preference; automatic factor-to-evaluator selection; evaluator execution during registration.
