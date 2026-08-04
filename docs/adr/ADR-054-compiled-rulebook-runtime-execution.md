# ADR-054: Compiled Rulebook Runtime Execution

Status: Accepted

## Context and mandatory audit

Phases 4G1 and 4G2 prepare and execute one compiled binding. ADR-051 supplies cross-binding dispositions and `COMPILED_WEIGHTED_MEAN`. Phase 4G3 must compose those contracts into one pure rulebook execution without persistence or production activation.

The audit established:

- The immutable repository and `CompiledRulebookReadService.getExact` can load exact rulebooks, but introduce asynchronous persistence ownership and typed storage failures. Execution itself can remain pure only if loading occurs outside it.
- `CompiledExecutionRequest` carries exact rulebook identity and caller-owned `asOf`; it does not carry a rulebook definition.
- Phase 4G2 produces one immutable result per binding and mechanically projects INCLUDED binding scores into ADR-051 outcomes.
- ADR-051 aggregation already owns binding order, mandatory/PARTIAL/OMIT behavior, denominator treatment, blocked and insufficient outcomes, and arithmetic.
- Phase 4G2 binding scores are already normalized to `[0,100]`; a weighted mean of values in that range remains in `[0,100]`.
- The existing normalization executor accepts only a Phase 2 single-factor `WEIGHTED_SUM` result with plan identity, factor identity, contribution bounds, and raw points. A compiled weighted mean has none of those fields. Adapting it would fabricate lineage.
- Existing normalization policies are factor-scoped and reference Phase 2 aggregation-policy identity. The compiler preserves those exact references but does not prove runtime compatibility with the separate Phase 4G0 compiled aggregation-policy family.
- The existing decision-band executor requires the Phase 2 normalization result, including plan and factor lineage. Its band partition semantics are reusable, but its envelope is not.
- Compiled rulebooks may structurally contain multiple factors. Existing normalization and decision policies each name one factor, so mixed-factor rulebook classification is not currently authoritative.

This ADR freezes an honest initial rulebook runtime around those facts. It does not manufacture Phase 2 inputs or change frozen compiler contracts.

## Decision summary

Phase 4G3 is a caller-supplied, pure executor:

```text
Validated compiled rulebook definition
              +
CompiledExecutionRequest
              |
              v
Rulebook/request/policy preflight
              |
              v
Bindings in compiled order
              |
       Phase 4G1 prepare
              |
       Phase 4G2 execute/project
              |
              v
ADR-051 binding outcomes
              |
              v
COMPILED_WEIGHTED_MEAN
              |
              v
Compiled normalized-score projection
              |
              v
Compiled decision-band classification
              |
              v
CompiledExecutionResult
```

## Rulebook loading ownership

The Phase 4G3 executor accepts an already loaded `CompiledRulebookDefinition`. It never loads from a repository.

Callers that begin with identity may use `CompiledRulebookReadService.getExact(rulebookId, rulebookVersion)` before invoking execution. `getMostRecentlyCompiledForTemplateVersion`, template listing, repository convenience reads, and implicit loading are forbidden execution paths. Persistence and read failures remain outside the deterministic executor result.

There is exactly one ownership model: load first, execute second. The executor never accepts a repository and rulebook simultaneously and never substitutes one for the other.

## Identity and structural preflight

Before policy lookup or binding traversal, execution must:

1. Validate the supplied rulebook through the existing compiled-rulebook contract validator.
2. Validate the execution-request envelope without preparing a binding.
3. Require exact equality between request and rulebook `rulebookId` and `rulebookVersion`.
4. Require a dense non-empty compiled binding collection with contiguous `binding.order === array index` and unique binding IDs.
5. Require every Phase 4G2 binding result later produced to carry the same rulebook identity and exact compiled binding.

Any preflight failure is fail-fast. No subject resolution, observation selection, evaluator lookup, or policy execution occurs.

## Policy-lineage preflight and authority

The executor next calls `CompiledRulebookPolicyConsistencyService` once over the compiled binding array. Aggregation, normalization, and decision-band identity/version must each be uniform exactly as ADR-051 requires.

Authorities are resolved only by:

```text
compiledAggregationPolicies.getExact(aggregationPolicyId, aggregationPolicyVersion)
normalizationPolicies.getExact(normalizationPolicyId, normalizationPolicyVersion)
decisionBandPolicies.getExact(decisionBandPolicyId, decisionBandPolicyVersion)
```

All three definitions must exist and be compile eligible. `getLatest`, listing, most-recent, fallback, first-binding substitution, and majority selection are forbidden.

The exact compiled aggregation definition must use `COMPILED_WEIGHTED_MEAN`, `RETAIN_IN_DENOMINATOR`, and `REMOVE_FROM_DENOMINATOR`.

## Initial factor-policy compatibility boundary

Because current normalization and decision policies are factor-scoped, the initial runtime supports one factor lineage across a rulebook. Every binding must have the same factor key and factor version. The normalization policy and decision-band policy must both name that factor key. Mixed relationships, subjects, providers, configurations, requirement levels, and weights remain allowed.

A mixed-factor rulebook fails preflight with `MIXED_FACTOR_RULEBOOK_NOT_SUPPORTED`; it is not partially executed. Supporting cross-factor policy requires a future compiled rulebook-level normalization and decision authority and is not inferred here.

Normalization-policy compatibility additionally requires:

- exact identity/version equal to compiled lineage;
- compile eligibility;
- target range exactly `{ minimumScore: 0, neutralScore: 50, maximumScore: 100 }`;
- method `PIECEWISE_LINEAR_ZERO_ANCHORED`;
- out-of-range policy `FAIL`;
- precision policy `PRESERVE_NATIVE`.

Its Phase 2 aggregation identity and source contribution range are validated historical lineage but are not executed by Phase 4G3. The executor must not claim they describe `COMPILED_WEIGHTED_MEAN`.

Decision-policy compatibility requires exact normalization identity/version, the common factor key, and normalized range exactly `[0,100]`. Existing five-band order, coverage, contiguity, and inclusivity semantics remain authoritative.

## Traversal order

After successful preflight, bindings are traversed once in the exact stored `factorBindings` array order. The array must already be contiguous by compiled order. The executor never sorts, filters, groups, parallelizes, or reorders bindings.

For each binding, it calls Phase 4G1 once and passes that exact preparation result to Phase 4G2 once. It appends the detached Phase 4G2 result before advancing.

## Continuation semantics

Domain outcomes always continue traversal:

- INCLUDED continues;
- BLOCKING continues so every other binding receives its deterministic trace;
- PARTIAL continues;
- OMITTED continues;
- MISSING and INVALID continue through their derived disposition;
- a sanitized evaluator failure represented as a valid Phase 4G2 binding result continues.

The executor does not stop merely because the final aggregate is already known to be blocked. Complete ordered binding observability is required.

Only an invariant failure where Phase 4G1 or Phase 4G2 cannot produce its typed result stops traversal immediately. The final status is FAILED, completed binding traces are retained, `failedBindingOrder` identifies the failing binding, no trace is fabricated for that binding or remaining bindings, and aggregation/normalization/classification remain null.

## Binding result validation and counts

Each binding result must exactly match the current rulebook identity, binding ID, order, detached binding content, and policy lineage. Its input-state/disposition pair must match the existing disposition service. INCLUDED requires EXECUTED plus a finite `[0,100]` binding score; other dispositions require NOT_EXECUTED and null score.

Counts are derived after traversal and contain non-negative integers:

- `totalBindings`;
- `executedBindings`;
- `includedBindings`;
- `partialBindings`;
- `omittedBindings`;
- `blockingBindings`;
- `missingBindings`;
- `invalidBindings`.

Counts are metadata only and never affect arithmetic.

## Aggregation projection

Every valid Phase 4G2 result is projected mechanically:

```text
binding         = bindingResult.binding
inputState      = bindingResult.inputState
normalizedScore = bindingResult.bindingScore for INCLUDED, otherwise null
```

The projection preserves binding array order. No field is recomputed or inferred.

The exact compiled aggregation policy and ordered outcomes are passed once to `CompiledRulebookAggregationService`. Its result is retained unchanged. Phase 4G3 introduces no aggregation arithmetic.

Aggregation outcomes control continuation:

- `BLOCKED` -> final BLOCKED; normalization and decision are null.
- `INSUFFICIENT_INPUT` -> final INSUFFICIENT_INPUT; normalization and decision are null.
- aggregation `FAILED` -> final FAILED; normalization and decision are null.
- `COMPLETED` -> normalization projection and classification continue.
- `PARTIAL` -> normalization projection and classification continue; final status remains PARTIAL if both succeed.

## Compiled normalization boundary

The compiled weighted mean is already a normalized score in `[0,100]`. Phase 4G3 therefore introduces a compiled normalization projection, not a Phase 2 aggregation adapter.

`CompiledRulebookNormalizationResult` contains:

- exact normalization policy identity/version;
- exact compiled aggregation policy identity/version;
- common factor lineage;
- input range `[0,100]`;
- output range `[0,100]`;
- aggregate score;
- normalized score equal to aggregate score;
- method `ALREADY_NORMALIZED_WEIGHTED_MEAN`;
- precision policy `PRESERVE_NATIVE`.

Projection requires a finite aggregate within `[0,100]` and the exact compatible normalization policy described above. It performs no arithmetic, rounding, clamping, inverse mapping, plan construction, or factor-aggregation fabrication.

The existing `FactorAggregateNormalizationExecutionService` is not called because its input contract is incompatible. Its piecewise-linear algorithm remains unchanged. This is not a silent bypass: Phase 4G2 already performed the authoritative evaluator-bound zero-anchored normalization, and ADR-051 preserves that domain through weighted mean.

## Compiled decision classification boundary

Phase 4G3 introduces an Evidence- and plan-independent compiled classifier around the existing decision-band partition semantics. Implementation must extract or reuse one pure band-matching core so the legacy and compiled classifiers cannot fork.

The classifier accepts the compiled normalization result and exact decision policy. It validates exact normalization identity/version, common factor key, and `[0,100]` range, then selects exactly one band using existing semantics:

- every band minimum is inclusive;
- non-final maxima are exclusive;
- the final maximum is inclusive;
- exactly one match is required.

`CompiledRulebookDecisionResult` contains exact decision and normalization lineage, common factor lineage, normalized score, and the detached selected semantic band. It creates no permission, order, alert, risk instruction, or trade action.

The existing `FactorDecisionBandExecutionService` is not called because its envelope requires synthetic Phase 2 plan and aggregation fields. Its classification behavior remains unchanged and must be protected by shared-core characterization tests.

## Final status

The closed `CompiledExecutionStatus` vocabulary is:

- `COMPLETED`: aggregation completed and normalization/classification succeeded with no PARTIAL binding effect;
- `PARTIAL`: aggregation returned PARTIAL and normalization/classification succeeded;
- `BLOCKED`: at least one mandatory binding blocked and ADR-051 returned BLOCKED;
- `INSUFFICIENT_INPUT`: ADR-051 returned zero included denominator;
- `FAILED`: preflight, invariant, exact-policy, aggregation-contract, normalization-projection, or classification failure.

BLOCKED and INSUFFICIENT_INPUT are deterministic domain outcomes, not executor failures.

## Compiled execution result

Every `CompiledExecutionResult` is one immutable union containing:

- status;
- detached rulebook identity, source lineage, and compilation lineage;
- request identity;
- cloned `evaluatedAt` equal to request `asOf`;
- ordered binding traces produced so far;
- binding counts derived from those traces;
- uniform exact aggregation, normalization, and decision policy lineage when preflight reached it, otherwise null;
- complete `CompiledRulebookAggregationResult` when aggregation ran, otherwise null;
- `aggregateScore` when aggregation succeeded, otherwise null;
- compiled normalization result when normalization succeeded, otherwise null;
- `normalizedScore` when normalization succeeded, otherwise null;
- compiled decision result and semantic `decisionBand` when classification succeeded, otherwise null;
- `includedWeight` copied from aggregation when available, otherwise zero;
- `failedBindingOrder` only for traversal invariant failure, otherwise null;
- rulebook execution failure code and nested stage failure code when applicable.

There is no execution duration, started-at time, completed-at time, system timestamp, random execution ID, or persistence identity. `compiledAt` is copied lineage only and never participates in logic. Deterministic timing is represented solely by `evaluatedAt = request.asOf`.

Successful, partial, blocked, and insufficient results contain all binding traces because traversal completes before aggregation. Preflight failures contain an empty frozen trace. Traversal invariant failures contain only completed traces.

## Deterministic first-failure order

The rulebook executor uses this order:

1. supplied rulebook structural validation;
2. execution-request envelope validation;
3. request/rulebook identity equality;
4. binding density, order, and uniqueness;
5. uniform policy-lineage validation;
6. exact compiled aggregation-policy lookup and compatibility;
7. exact normalization-policy lookup and compatibility;
8. exact decision-policy lookup and compatibility;
9. common factor-policy compatibility;
10. binding traversal in compiled order;
11. binding-result invariant validation after each binding;
12. counts and ordered aggregation projection;
13. one ADR-051 aggregation call;
14. compiled normalization projection when eligible;
15. compiled decision classification when eligible;
16. immutable final projection.

No later stage runs after its prerequisite fails.

## Failure vocabulary

The closed Phase 4G3 failure vocabulary is:

### Rulebook and request preflight

- `INVALID_COMPILED_RULEBOOK`
- `INVALID_EXECUTION_REQUEST`
- `RULEBOOK_IDENTITY_MISMATCH`
- `INVALID_BINDING_COLLECTION`
- `INVALID_BINDING_ORDER`
- `DUPLICATE_BINDING_ID`
- `INCONSISTENT_AGGREGATION_POLICY_LINEAGE`
- `INCONSISTENT_NORMALIZATION_POLICY_LINEAGE`
- `INCONSISTENT_DECISION_BAND_POLICY_LINEAGE`
- `MIXED_FACTOR_RULEBOOK_NOT_SUPPORTED`

### Exact policy authority and compatibility

- `COMPILED_AGGREGATION_POLICY_NOT_FOUND`
- `COMPILED_AGGREGATION_POLICY_NOT_COMPILE_ELIGIBLE`
- `INVALID_COMPILED_AGGREGATION_POLICY`
- `NORMALIZATION_POLICY_NOT_FOUND`
- `NORMALIZATION_POLICY_NOT_COMPILE_ELIGIBLE`
- `NORMALIZATION_POLICY_LINEAGE_MISMATCH`
- `NORMALIZATION_POLICY_FACTOR_MISMATCH`
- `NORMALIZATION_POLICY_TARGET_RANGE_MISMATCH`
- `NORMALIZATION_POLICY_RUNTIME_INCOMPATIBLE`
- `DECISION_BAND_POLICY_NOT_FOUND`
- `DECISION_BAND_POLICY_NOT_COMPILE_ELIGIBLE`
- `DECISION_BAND_POLICY_LINEAGE_MISMATCH`
- `DECISION_BAND_POLICY_FACTOR_MISMATCH`
- `DECISION_BAND_POLICY_RANGE_MISMATCH`
- `DECISION_BAND_POLICY_RUNTIME_INCOMPATIBLE`

### Traversal and binding invariants

- `BINDING_PREPARATION_INVARIANT_FAILED`
- `BINDING_EXECUTION_INVARIANT_FAILED`
- `BINDING_RESULT_RULEBOOK_MISMATCH`
- `BINDING_RESULT_IDENTITY_MISMATCH`
- `BINDING_RESULT_ORDER_MISMATCH`
- `BINDING_RESULT_LINEAGE_MISMATCH`
- `BINDING_RESULT_DISPOSITION_MISMATCH`
- `BINDING_RESULT_SCORE_MISMATCH`

### Aggregation, normalization, and classification

- `COMPILED_AGGREGATION_FAILED`, preserving the nested ADR-051 code;
- `COMPILED_NORMALIZATION_INVALID_AGGREGATE`
- `COMPILED_NORMALIZATION_OUT_OF_RANGE`
- `COMPILED_NORMALIZATION_FAILED`
- `COMPILED_DECISION_INVALID_NORMALIZATION`
- `COMPILED_DECISION_NO_MATCHING_BAND`
- `COMPILED_DECISION_MULTIPLE_MATCHING_BANDS`
- `COMPILED_DECISION_FAILED`

Raw exceptions are caught at orchestration boundaries and sanitized to the corresponding invariant or stage failure. Messages, stacks, persistence details, and provider payloads are never returned.

## Provider lineage

Provider lineage is binding-local and already attested by Phase 4G1. Phase 4G3 preserves it in each binding trace and never resolves, ranks, groups, or calls providers. Mixed provider bindings are allowed when every individual trace is valid.

## Immutability and determinism

The executor never mutates the rulebook, request, observations, policies, or binding results. Every returned object and array is detached and recursively frozen. Every date is cloned before freezing.

Traversal is sequential and synchronous after caller-owned loading. No sorting, parallelism, retry, fallback, system clock, locale ordering, randomness, duration measurement, or persistence is allowed. Identical rulebook, request, observations, exact authorities, and implementations produce deep-equal logical results.

## Runtime activation boundary

Phase 4G3 implementation remains an isolated dependency-injected executor. All compiled runtime production defaults remain empty. There is no controller, route, API, ScoreCheck integration, template/compiler mutation, repository mutation, persistence, provider execution, scheduler, feature-flag change, production registration, or legacy-scoring replacement. Compiled execution remains OFF.

## Rejected alternatives

Rejected:

- loading a rulebook implicitly inside execution;
- using most-recent or latest rulebook lookup;
- sorting bindings;
- fail-fast on BLOCKING, PARTIAL, OMITTED, MISSING, or INVALID domain outcomes;
- fabricating traces for unexecuted remainder after an invariant failure;
- custom aggregation arithmetic;
- adapting compiled aggregation into a synthetic Phase 2 plan result;
- applying the Phase 2 normalization source range to a `[0,100]` aggregate;
- inventing a mixed-factor rulebook factor identity;
- fabricating plan identity for decision classification;
- converting blocked or insufficient input into FAILED;
- producing execution duration from wall-clock time;
- latest, fallback, or majority policy selection.

## Consequences and next phase

Phase 4G3 implementation may add only the compiled rulebook execution types, request preflight, binding-result projection/validation, compiled normalization projection, shared decision-band core, compiled classifier, and isolated executor required here. It must reuse Phase 4G1, Phase 4G2, ADR-051 aggregation, and exact policy authorities.

Cross-factor compiled normalization/decision semantics, persistence of execution results, APIs, ScoreCheck integration, feature activation, and production registration remain future architecture work.

