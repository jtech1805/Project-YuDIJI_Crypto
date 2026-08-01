# ADR-024: Deterministic Contribution Aggregation Contract

Status: Accepted

Date: 2026-07-31

Phase: Phase 2J

## Context

Phase 2E produces bounded evaluator contributions and Phase 2I produces an ordered execution report, but no neutral contract defines which successful outcomes may later contribute numerically, how evaluator weights are declared, or which aggregate bounds apply.

## Decision

Add immutable aggregation-policy types and a synchronous validation service. Phase 2J defines policy instructions only; it does not read an execution report, multiply or aggregate contributions, normalize a score, or produce a decision.

## Policy identity

Every policy has a caller-supplied uppercase `policyId` containing only letters, digits, and underscores, with a length of 1–120 characters.

## Policy versioning

`policyVersion` is a caller-supplied positive integer. It is audit identity, not a semantic version, generated version, latest-version selector, or upgrade instruction.

## Single-factor scope

One policy targets one exact `FactorKey`. Cross-factor aggregation is not defined.

## Execution-plan relationship

One policy references one exact validated Phase 2H plan by `planId` and `planVersion`. The factor must also match exactly. There is no plan lookup or version fallback.

## Evaluator-entry contract

Each entry declares explicit order, evaluator ID, evaluator version, configuration version, and weight. Entries contain no execution, outcome, contribution, Evidence, provider, or runtime state.

## Exact coverage policy

Policy entries exactly cover all validated plan steps. Subsets, extra entries, and automatic evaluator discovery are rejected.

## Order consistency

Entry array order must be contiguous `1..N` and each entry must match the corresponding plan step’s order and evaluator metadata. Validation never sorts or repairs entries.

## Eligibility taxonomy

Outcome eligibility is a fixed snapshotted contract. Successfully evaluated `PASS`, `FAIL`, and `NEUTRAL` results are eligible; `UNAVAILABLE`, typed evaluator failures, Phase 2G boundary failures, and Phase 2I skipped steps are ineligible. Ineligibility is distinct from a numeric zero contribution.

## PASS handling

A future aggregator may include the validated contribution from an evaluated `PASS` result.

## FAIL handling

A future aggregator may include the validated negative contribution from an evaluated `FAIL` result.

## NEUTRAL handling

A future aggregator may include the validated zero contribution from an evaluated `NEUTRAL` result.

## UNAVAILABLE handling

An evaluated `UNAVAILABLE` result is ineligible and is not substituted with zero.

## Typed evaluator failure handling

Typed evaluator failures are ineligible and are not converted into numeric contributions.

## Boundary failure handling

Phase 2G boundary failures are ineligible and are not converted into numeric contributions.

## Weight contract

Every entry requires an explicit finite weight satisfying `0 < weight <= 100`. Zero, negative, non-finite, missing, string, and excessive weights fail. Weights are not rounded, normalized, treated as percentages, or required to total 100.

## Aggregate bounds

The caller explicitly supplies finite `minimumPoints` and `maximumPoints`. Minimum must not exceed maximum and the inclusive range must contain zero. Bounds are metadata only and are not inferred from evaluator contributions or weights.

## Validation order

Validation checks the params and validated-plan boundary, policy object and identity, exact plan reference, factor, method, bounds, dense entry bound and shapes, contiguous and duplicate order, evaluator uniqueness, exact entry count, then index-aligned plan metadata. Only the first deterministic failure is returned.

## Immutability

Validated policies defensively clone and freeze identity, bounds, eligibility, entries, and the entry array. They retain no source plan, plan steps, evaluator implementation, registry, or executable function.

## Determinism

Validation preserves exact order and reads no clock, randomness, generated ID, report, persistence, or external state. Identical logical policy and plan inputs produce deep-equal results.

## Relationship to Phase 2I

Phase 2J neither imports nor calls the Phase 2I runner and does not inspect execution reports. The future aggregator will combine a validated policy with a report.

## Relationship to future aggregation execution

Applying eligibility, multiplying contributions by weights, summing, validating theoretical bounds, and producing a bounded aggregate are deferred.

## Relationship to score normalization

No percentage, 0–100 conversion, normalization rule, maximum score, or rounding rule is defined.

## Relationship to decision bands

No threshold, band, permission, trade direction, BUY, SELL, or HOLD output exists.

## Relationship to legacy scoring

Legacy scoring templates, weights, aggregation, normalization, and decisions remain unchanged and authoritative.

## Relationship to persistence

Policies are validated in memory and are not stored, registered, or queried.

## Relationship to runtime activation

No API, controller, route, scheduler, frontend, default composition, feature-flag connection, provider, LLM, RAG, or MCP is added. `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Future aggregation can consume a bounded, exact, versioned evaluator policy with unambiguous eligibility and safe weight instructions without conflating raw contributions with final scoring.

## Deferred work

Aggregation execution, theoretical-bound validation, subset policies, additional methods, weight normalization, score normalization, decision bands, persistence, monitoring, APIs, scheduling, activation, and authority migration.

## Rejected alternatives

Implicit equal weights; zero or negative weights; unbounded weights; weights totaling 100; caller-configurable outcome eligibility; treating failures or unavailable results as zero; subset coverage; reordered entries; inferred aggregate bounds; average, median, extrema, or voting methods; report inspection during validation; aggregation execution; legacy scoring reuse.
