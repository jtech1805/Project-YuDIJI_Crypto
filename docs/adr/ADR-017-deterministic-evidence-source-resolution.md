# ADR-017: Deterministic Evidence Source Resolution

Status: Accepted

Date: 2026-07-30

Phase: Phase 2C

## Context

Lifecycle-active Evidence may contain several compatible observations for the same factor and subject. A bounded, deterministic boundary is needed to select one source without inferring truth from values or changing scoring.

## Decision

Add a caller-fed `EvidenceSourceResolutionService`, an immutable source-authority registry, and one audited Binance `MARKET.PRICE` rule.

## Input boundary

The caller supplies the requested factor and subject, up to 100 observations, exact Phase 1D completeness flags, and explicit `asOf`. No repository read occurs.

## Completeness requirement

`complete = false`, `baseTruncated = true`, or `relationshipTruncated = true` fails closed before compatibility evaluation.

## Candidate-bound policy

Zero candidates produce typed no-selection. One through 100 are evaluated. More than 100 fails without truncation or evaluation.

## Factor and subject consistency

Every candidate must match the explicit requested factor, subject type, and subject key. Mixed sets and duplicate Evidence IDs fail closed.

## Compatibility delegation

Every valid candidate is evaluated exactly once through Phase 2B. Incompatible or stale candidates remain in the minimized trace but cannot win.

## Source-authority policy

Authority is immutable code metadata. Lower configured priority wins. The initial rule is `MARKET.PRICE` / `MARKET_DATA` / `BINANCE` at priority 100.

## Unknown-source policy

Configured sources outrank unconfigured sources. Unknown sources remain eligible when no configured candidate is compatible and expose `sourcePriority: null`; no authority is fabricated.

`sourceId` is `provenance.sourceName` when present and otherwise the required provider. `externalReference` is per-observation metadata and is not a source identity.

## Selection ordering

Compatible candidates sort by configured authority, newest `observedAt`, highest confidence, lexically smallest provider, source ID, then Evidence ID.

## Tie-breaking

Confidence `null` ranks below every numeric confidence. Exact case-sensitive lexical comparisons guarantee order after duplicate Evidence IDs are rejected. Raw Evidence values are never compared.

## Conflict semantics

Duplicate Evidence IDs are invalid. `UNRESOLVED_CONFLICT` remains a defensive failure if distinct candidates are nevertheless indistinguishable across all frozen keys.

## No-selection semantics

Empty or entirely incompatible candidate sets return `NO_COMPATIBLE_EVIDENCE`. Unsupported factors, incomplete input, excess candidates, and mixed identities have separate codes.

## Resolution trace

Trace contains only safe identity, source identity, time, confidence, compatibility summary, configured priority, and disposition. It never contains values, prices, payloads, credentials, deduplication keys, or full Evidence records.

## Immutability

Requests, observations, compatibility results, registry rules, and dates are not mutated. Results use defensive frozen arrays and cloned dates. Input order does not affect output.

## Relationship to Evidence reads

The resolver imports no repository or read service. A future orchestrator may pass complete active observations and exact completeness flags.

## Relationship to lifecycle resolution

No revocation, supersession, graph, or lifecycle calculation occurs.

## Relationship to Factor Registry

The requested factor must be registered. Phase 2C supports only `MARKET.PRICE`.

## Relationship to evaluators

No evaluator executes.

## Relationship to scoring

No score is calculated and no numeric Evidence value is compared. Existing scoring remains authoritative, Evidence remains disconnected from production decision-making, and its feature flag remains OFF.

## Consequences

Selection is bounded, auditable, source-aware, and deterministic. Only one source policy exists, and multi-factor behavior remains deferred.

## Deferred work

Additional audited source rules, multi-factor policies, read orchestration, selected-record transport, evaluators, scoring, APIs, monitoring, and runtime activation.

## Rejected alternatives

Repository reads inside resolution; value comparison; confidence before authority; input-order selection; automatic provider ranking; scoring or evaluator execution.
