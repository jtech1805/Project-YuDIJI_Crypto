# ADR-053: Compiled Binding Execution Runtime

Status: Accepted

## Context and mandatory audit

ADR-052 ends at an Evidence-independent `CompiledFactorInput`. Phase 4G2 must execute one compiled binding without importing Evidence semantics, changing legacy evaluation, aggregating bindings, or activating production runtime.

The audit found these existing boundaries:

- The Phase 2 `DeterministicFactorEvaluator` port and its result contract require `AssembledFactorInput` and an Evidence reference. They cannot consume `CompiledFactorInput` without fabricating fields forbidden by ADR-052.
- The executable evaluator registry resolves only by evaluator ID and does not prove an exact evaluator version, configuration ID, or implementation key.
- The historical evaluator-declaration and evaluator-configuration registries already provide immutable exact-version metadata through `getExact`.
- `GenericRelationshipFactorEvaluator` owns the authoritative DIRECT/INVERSE threshold classification, contribution, outcome, reason-code, and diagnostic algorithm, but combines that algorithm with legacy Evidence projection.
- ADR-051 requires an included binding to expose a normalized binding score before rulebook aggregation but does not define its projection from raw evaluator points.
- Provider attestation, freshness, factor compatibility, and exact provider lineage are already validated by Phase 4G1 and must not be replayed or bypassed.
- Aggregation, normalization-policy execution, and decision-band execution are rulebook concerns and are not part of one-binding execution.

This ADR closes those gaps without changing any existing contract.

## Decision summary

Phase 4G2 introduces a parallel compiled evaluator runtime:

```text
ResolvedExecutionInput
        |
        v
Exact evaluator declaration
        |
        v
Exact evaluator configuration
        |
        v
Exact compiled implementation
        |
        v
Shared generic relationship core
        |
        v
Compiled raw evaluator result
        |
        v
Zero-anchored binding-score projection
        |
        v
CompiledBindingExecutionResult
```

It does not adapt `CompiledFactorInput` into `AssembledFactorInput`. It does not call the legacy evaluator port. Instead, legacy and compiled evaluators share one extracted pure generic-relationship calculation core. Refactoring the legacy evaluator to delegate to that core is permitted during Phase 4G2 implementation only if characterization tests prove identical legacy results. The legacy port and result contract remain unchanged.

## Compiled evaluator port

The new synchronous, no-I/O `CompiledDeterministicEvaluator` contract is:

```text
identity:
  implementationKey
  evaluatorId
  evaluatorVersion

evaluate:
  CompiledFactorInput
  exact immutable evaluator configuration
  compiled relationship type
    -> CompiledEvaluatorExecutionResult
```

The port must not accept `AssembledFactorInput`, Evidence identity, provider payloads, repositories, clocks, or services. It may return only the deterministic domain result or a typed failure. It must not throw through the execution boundary.

## Shared generic relationship core

The generic core is the single owner of existing evaluator arithmetic:

1. Validate the exact generic configuration.
2. Require the configured factor and expected unit.
3. Classify the input value using the existing inclusive threshold order.
4. Read the configured DIRECT contribution for that band.
5. For DIRECT, preserve that contribution.
6. For INVERSE, negate every non-zero DIRECT contribution and preserve canonical zero.
7. Derive PASS from positive points, FAIL from negative points, and NEUTRAL from zero.
8. Preserve the existing reason-code and diagnostics semantics.

No second threshold table, relationship algorithm, contribution table, rounding rule, or evaluator fork is allowed. CONDITIONAL, CONFIRMATION_ONLY, RISK_ONLY, and VETO remain non-executable.

## Exact executable implementation registry

Phase 4G2 adds an immutable, caller-supplied compiled implementation registry. Its authoritative key is:

```text
(implementationKey, evaluatorVersion)
```

It exposes only `getExact(implementationKey, evaluatorVersion)` to the binding executor. Duplicate exact keys are rejected at construction. Registration validates that implementation identity is immutable and that its declared evaluator ID/version match the executable object. Production defaults remain empty; tests supply the generic implementation explicitly. There is no discovery, name lookup, fallback, highest-version selection, or latest lookup.

The historical evaluator declaration is resolved first by exact compiled `(evaluatorId, evaluatorVersion)`. Its `implementationKey` then identifies the exact executable implementation at the same evaluator version.

## Exact configuration runtime

The binding's `(configurationId, configurationVersion)` is resolved only through `EvaluatorConfigurationRegistry.getExact`. Configuration remains immutable data and is passed directly to the compiled implementation; it does not create mutable evaluator instances and is not globally cached by the executor.

The resolved configuration must be compile eligible and must exactly declare the binding's evaluator ID/version, factor key, and relationship type. Its inner generic configuration relationship must also equal the compiled relationship. No caller override, constructor default, configuration-version fallback, or inferred relationship is permitted.

## Compatibility validation order

For an available resolved input, compatibility is checked in this exact order:

1. Validate the `ResolvedExecutionInput` envelope and internal detached lineage equality.
2. Require input factor, subject, provider attestation, timestamps, freshness, and binding identity to match the resolved envelope exactly.
3. Resolve evaluator declaration by exact evaluator ID/version.
4. Require the declaration to be compile eligible.
5. Require the declaration to support the exact factor.
6. Require the declaration to support DIRECT or INVERSE as compiled.
7. Resolve configuration by exact configuration ID/version.
8. Require the configuration to be compile eligible.
9. Require exact evaluator ID/version agreement.
10. Require exact factor support.
11. Require exact relationship support and inner relationship equality.
12. Resolve implementation by exact declaration implementation key and evaluator version.
13. Require implementation identity to match the declaration and compiled evaluator lineage.
14. Execute once.
15. Validate the returned raw result.
16. Project the binding score.
17. Create the immutable binding result.

The first failure wins. Later lookups or execution must not occur after failure.

## Raw compiled evaluator result

A successful `CompiledRawEvaluatorResult` contains:

- exact evaluator ID/version;
- exact configuration ID/version;
- exact factor key/version;
- exact canonical subject;
- DIRECT or INVERSE relationship;
- PASS, FAIL, or NEUTRAL outcome;
- finite `points`, `minimumPoints`, and `maximumPoints`;
- bounded deterministic reason code;
- safe bounded diagnostics;
- cloned `observedAt` and `evaluatedAt`.

It contains provider attestation only through the enclosing binding result, not as evaluator-owned data. It contains no Evidence reference. UNAVAILABLE is not a successful compiled evaluation: unavailability is represented by preparation or execution failure and therefore cannot synthesize zero points.

The result validator requires `minimumPoints < 0`, `maximumPoints > 0`, `minimumPoints <= points <= maximumPoints`, and the existing sign-to-outcome relationship. These strict two-sided bounds are required by the binding-score projection.

## Binding score

`bindingScore` is a normalized per-binding score in the closed range `[0, 100]`. It is not rulebook normalization and does not execute the compiled normalization-policy lineage.

Projection is piecewise linear and zero anchored:

```text
points < 0:
  50 * (points - minimumPoints) / (0 - minimumPoints)

points = 0:
  50

points > 0:
  50 + 50 * points / maximumPoints
```

Exact endpoints are `minimumPoints -> 0`, `0 -> 50`, and `maximumPoints -> 100`. Native IEEE-754 precision is preserved. There is no rounding, clamping, weighting, confidence adjustment, or policy lookup. An out-of-bounds or non-finite projection is `INVALID_BINDING_SCORE`.

ADR-051's `normalizedScore` field receives this `bindingScore` for INCLUDED outcomes. The term means normalized within one evaluator's declared contribution bounds; it does not mean the later rulebook normalization stage.

## Confidence and provider provenance

Confidence is copied unchanged from `CompiledFactorInput` and remains metadata. Null remains null. Phase 4G2 applies no confidence multiplier, threshold, fallback, or imputation.

The exact provider-binding and resolution-policy lineage, selected provider, resolution outcome, and validated attestation are copied from `ResolvedExecutionInput`. Phase 4G2 does not repeat provider selection, call providers, or weaken Phase 4G1 attestation.

## Phase 4G1 preparation-failure mapping

The Phase 4G2 core executor accepts only successful `ResolvedExecutionInput`. A companion binding-outcome projection accepts the Phase 4G1 preparation result so later rulebook orchestration can produce exactly one binding result without executing missing or invalid input.

The complete mapping is:

### MISSING

- `MISSING_TRADED_INSTRUMENT`
- `MISSING_UNDERLYING_ASSET`
- `OBSERVATION_NOT_FOUND`
- `STALE_OBSERVATION`

These mean no usable timely runtime value was supplied for an otherwise compiled binding.

### INVALID

- `INVALID_EXECUTION_REQUEST`
- `INVALID_RULEBOOK_IDENTITY`
- `INVALID_EXECUTION_AS_OF`
- `INVALID_SUBJECT_CONTEXT`
- `INVALID_OBSERVATION_COLLECTION`
- `EMPTY_OBSERVATION_COLLECTION`
- `TOO_MANY_OBSERVATIONS`
- `INVALID_COMPILED_SUBJECT_BINDING`
- `INVALID_TRADED_INSTRUMENT`
- `INVALID_UNDERLYING_ASSET`
- `INVALID_SHADOW_OBSERVATION`
- `DUPLICATE_OBSERVATION`
- `AMBIGUOUS_OBSERVATION`
- `OBSERVATION_ATTESTATION_FAILED`, preserving its nested attestation code
- `FACTOR_DEFINITION_NOT_FOUND`
- `FACTOR_DEFINITION_NOT_COMPILE_ELIGIBLE`
- `FACTOR_SUBJECT_NOT_ALLOWED`
- `FACTOR_UNIT_NOT_ALLOWED`
- `OBSERVATION_IN_FUTURE`
- `INVALID_FRESHNESS_POLICY`

No Phase 4G1 failure maps to AVAILABLE. Only successful preparation maps to AVAILABLE.

After mapping, the existing `CompiledBindingDispositionService` is authoritative:

- AVAILABLE -> INCLUDED;
- MANDATORY MISSING or INVALID -> BLOCKING;
- OPTIONAL/PARTIAL MISSING or INVALID -> PARTIAL;
- OPTIONAL/OMIT MISSING or INVALID -> OMITTED.

PARTIAL, OMITTED, and BLOCKING results have null raw evaluator result and null binding score. They do not invoke evaluator authorities or implementations.

## Binding execution failures

Failures after successful preparation map to INVALID and then use the same existing disposition rules. The closed Phase 4G2 execution failure vocabulary is:

- `INVALID_RESOLVED_EXECUTION_INPUT`
- `RESOLVED_RULEBOOK_LINEAGE_MISMATCH`
- `RESOLVED_BINDING_LINEAGE_MISMATCH`
- `RESOLVED_FACTOR_INPUT_MISMATCH`
- `RESOLVED_PROVIDER_ATTESTATION_MISMATCH`
- `EVALUATOR_DECLARATION_NOT_FOUND`
- `EVALUATOR_DECLARATION_NOT_COMPILE_ELIGIBLE`
- `EVALUATOR_FACTOR_NOT_SUPPORTED`
- `EVALUATOR_RELATIONSHIP_NOT_SUPPORTED`
- `EVALUATOR_CONFIGURATION_NOT_FOUND`
- `EVALUATOR_CONFIGURATION_NOT_COMPILE_ELIGIBLE`
- `EVALUATOR_CONFIGURATION_LINEAGE_MISMATCH`
- `EVALUATOR_CONFIGURATION_FACTOR_NOT_SUPPORTED`
- `EVALUATOR_CONFIGURATION_RELATIONSHIP_NOT_SUPPORTED`
- `EVALUATOR_CONFIGURATION_RELATIONSHIP_MISMATCH`
- `EVALUATOR_IMPLEMENTATION_NOT_FOUND`
- `EVALUATOR_IMPLEMENTATION_IDENTITY_MISMATCH`
- `EVALUATOR_EXECUTION_FAILED`
- `INVALID_EVALUATOR_RESULT`
- `INVALID_CONTRIBUTION_BOUNDS`
- `INVALID_BINDING_SCORE`
- `INVALID_BINDING_DISPOSITION`

Implementation exceptions are caught and sanitized to `EVALUATOR_EXECUTION_FAILED`; raw errors, messages, stacks, and implementation payloads are never returned.

## Compiled binding execution result

`CompiledBindingExecutionResult` is one closed immutable union.

Every branch contains:

- rulebook identity;
- binding ID and binding order;
- complete detached compiled binding;
- exact factor lineage;
- canonical resolved subject when available, otherwise null;
- exact evaluator and configuration lineage;
- exact provider and provider-attestation lineage when available;
- exact aggregation, normalization, and decision-band lineage as metadata only;
- relationship type;
- requirement level and optional behavior;
- compiled weight;
- input state: AVAILABLE, MISSING, or INVALID;
- disposition: INCLUDED, PARTIAL, OMITTED, or BLOCKING;
- confidence when available, otherwise null;
- freshness when available, otherwise null;
- observed and evaluated timestamps when available, otherwise null;
- preparation failure code and nested attestation code when applicable;
- execution failure code when applicable.

An INCLUDED success additionally contains the raw evaluator result and finite `bindingScore`. Its execution status is `EXECUTED`.

Every non-included branch has execution status `NOT_EXECUTED`, null raw evaluator result, and null binding score. An AVAILABLE input that fails during compatibility, implementation, execution, result validation, or score projection is reclassified INVALID before disposition derivation.

The rulebook aggregation projection is mechanically:

```text
binding            -> exact compiled binding
inputState          -> result input state
normalizedScore     -> bindingScore for INCLUDED, otherwise null
```

No aggregation occurs in Phase 4G2.

## Immutability and determinism

All outputs are detached deep clones and recursively frozen. All dates are cloned before freezing. Registry definitions, configurations, inputs, and implementation results are never mutated. Failure results are frozen.

Execution is synchronous and occurs at most once. No clock, randomness, locale comparison, concurrency, retry, fallback, or timing duration is permitted. `observedAt` and `evaluatedAt` come only from the resolved input. Identical inputs and exact authorities must produce deep-equal logical results.

## Exact lookup requirements

Only these exact lookups may occur:

```text
evaluatorDeclarations.getExact(evaluatorId, evaluatorVersion)
evaluatorConfigurations.getExact(configurationId, configurationVersion)
compiledImplementations.getExact(implementationKey, evaluatorVersion)
```

`getLatest`, version listing, executable lookup by evaluator name alone, fallback implementation lookup, and configuration substitution are forbidden. Provider attestation is reused from Phase 4G1 and is not re-resolved.

## Policy-lineage boundary

Aggregation, normalization, and decision-band identities are copied exactly into the result for later consistency validation. Phase 4G2 does not resolve those authorities and does not execute or adapt their policies. Binding-score projection is evaluator-bound normalization only and is not a substitute for later rulebook normalization.

## Runtime activation boundary

Phase 4G2 implementation will remain test-local and dependency-injected. Production implementation defaults are empty. There is no application wiring, feature flag, controller, route, API, repository, persistence, provider call, ScoreCheck integration, scheduler, or legacy-scoring change. Compiled execution remains OFF.

## Rejected alternatives

Rejected:

- manufacturing `AssembledFactorInput` or Evidence references;
- calling the legacy evaluator with synthetic provenance;
- duplicating generic relationship arithmetic;
- resolving executable implementations by evaluator ID alone;
- constructing configuration from defaults;
- treating evaluator points as a common rulebook scale;
- applying confidence to points or score;
- converting missing input to neutral or zero;
- executing optional missing bindings;
- resolving aggregation, normalization, or decision policies during binding execution;
- using latest or fallback lookup.

## Consequences and next phase

Phase 4G2 implementation may now add the compiled evaluator port, exact implementation registry, shared relationship core, result validator, score projector, and binding executor under this contract. Phase 4G3 remains blocked until a separate ADR defines rulebook traversal, compiled normalization adaptation, decision classification, and final execution-result semantics.

