# ADR-055: Compiled Shadow Execution and Parity Boundary

Status: ACCEPTED

Date: 2026-08-04

Phase: Phase 4G4

## Context

ADR-051 through ADR-054 establish provider-attested observations, deterministic preparation and binding execution, and an isolated whole-rulebook executor. Phase 4G4-A confirmed that production ScoreCheck creation remains a legacy-template and legacy-runtime flow. It has useful market and runtime data, but it does not currently carry an exact compiled-rulebook identity or provider-attested `CompiledShadowObservation` values.

This decision freezes a read-only shadow boundary that may later execute beside the authoritative legacy flow. It does not activate that boundary, implement its contracts, register runtime authorities, or authorize business-state persistence.

## Decision

Legacy scoring remains the sole production authority. A compiled shadow result cannot replace or modify the legacy score, permission, score status, data confidence, reasons, warnings, breakdown, persistence sequence, errors, ownership checks, response body, or HTTP status. Promotion of compiled output to authority requires a separate accepted ADR.

The future boundary has four independent responsibilities:

```text
Exact execution-binding authority
  exact source-template identity -> exact compiled-rulebook identity

Shadow observation assembly
  approved Evidence or legacy datum -> attested CompiledShadowObservation

Compiled shadow orchestrator
  eligibility -> exact load -> observations -> Phase 4G3 -> typed outcome

Versioned parity comparison
  legacy result + compiled result + exact projection policy -> diagnostic parity
```

No responsibility may silently absorb another responsibility's authority.

## Legacy authority and compiled artifact meaning

The existing scoring template and `ScoringEngineService` remain authoritative. Compiled execution is read-only shadow computation and must never invoke a second legacy score.

A compiled rulebook is the immutable execution artifact for one exact source-template version. It is historical, append-only, non-editable, versioned, and reproducible. It is never regenerated in place. Compilation proves artifact construction only; it does not activate that artifact for shadow or authoritative execution.

## Exact execution-binding authority

Runtime selection requires a future immutable authority mapping:

```text
(templateId, templateVersion)
        ->
(rulebookId, rulebookVersion)
```

The source identity is the exact identity represented by the compiled rulebook's existing `source.templateId` and `source.templateVersion` lineage. The selected rulebook must agree with that lineage.

Execution may load only through exact rulebook identity. It must not use `getMostRecentlyCompiledForTemplateVersion`, select the latest compilation, choose the highest version, infer identity from `compiledAt`, or fall back to another artifact. Missing or invalid binding is an explicit shadow skip or failure, never implicit selection.

The mapping authority will be implemented in a later Phase 4G4 sub-task. This ADR does not approve a storage schema. Compilation alone neither creates nor changes execution binding.

## Initial eligibility

Initial shadow eligibility is restricted to explicitly bound system-template versions. User templates are ineligible by default. A user-template version may participate only after it has an exact compiled artifact, an explicit execution binding, and a separately approved rollout decision. Compilation alone never grants eligibility.

## Shadow observation assembly

Phase 4G3 may consume observations only from:

1. canonical Evidence storage; or
2. an explicit approved legacy adapter that emits provider-attested `CompiledShadowObservation` values conforming to ADR-052.

Raw legacy snapshots, analyzer runtime values, request values, or cached market data must not be silently promoted. Every adapter path must be explicit:

```text
legacy source datum
  -> approved adapter
  -> exact factor and subject projection
  -> preserved unit and observation time
  -> exact provider-binding attestation
  -> exact resolution-policy attestation
  -> CompiledShadowObservation
```

An adapter must preserve the existing observation fields: factor key/version, subject type/key, numeric value, unit, `observedAt`, confidence, provider-binding ID/version, resolution-policy ID/version, selected-provider key, and resolution outcome. It may not fabricate unavailable lineage. When required lineage cannot be proven, no observation is emitted; existing preparation and orchestration contracts represent the resulting missing, invalid, skipped, or failed outcome.

## Compiled shadow orchestrator

The future orchestrator determines eligibility, resolves the exact execution binding, loads the exact rulebook, assembles approved observations, constructs the exact `CompiledExecutionRequest`, invokes Phase 4G3 once, and returns an immutable internal outcome.

Its closed top-level semantic categories must distinguish at least `COMPLETED`, `SKIPPED`, and `FAILED`. Exact TypeScript names remain for the contracts sub-task. A skipped outcome carries an explicit reason, including semantic equivalents of:

- template not eligible;
- no execution binding;
- exact rulebook not found;
- no usable observations.

A failed outcome identifies its failure stage, such as eligibility, binding resolution, exact rulebook loading, observation assembly, compiled execution, or parity projection. Repository and provider exception details must be sanitized. The orchestrator does not mutate inputs, retry, select alternatives, or persist domain state.

## Failure isolation and ScoreCheck create integration

The first permitted production seam is ScoreCheck creation only. Update, recalculation, and all other scoring entry points remain excluded pending a separate narrowly scoped decision.

The required order is:

```text
legacy template resolution
  -> authoritative legacy scoring
  -> all existing authoritative legacy writes and side effects
  -> failure-isolated compiled shadow execution
  -> unchanged legacy response
```

A shadow skip or failure is swallowed from public behavior. It must not reject the request, change the HTTP response, roll back completed writes, prevent audits, prevent template usage updates, prevent snapshot creation, alter message ordering, or invoke legacy scoring again. It is internally traced, operationally counted, and available for diagnostics.

Synchronous shadow execution may add request latency. Asynchronous or durable execution is deferred because it introduces delivery, correlation, retry, ordering, and persistence decisions not approved here.

## Persistence and observability

Initial Phase 4G4 and Phase 4G5 integration must not persist shadow or parity results into ScoreCheck, ScoreCheck snapshot, template, trade, compiled-rulebook, or other business-state records. No new business-state collection is approved.

Permitted outputs are structured logs, operational traces, metrics, and telemetry. They must not contain prohibited raw provider payloads or mutate domain state. A durable parity-history store requires a later ADR.

## Versioned parity projection policy

Parity is a versioned projection, not direct equality between legacy and compiled result objects. An exact projection-policy identity and version must govern each comparison. The policy classifies every dimension as:

- exactly comparable;
- comparable after canonicalization;
- semantically comparable through an explicit mapping;
- non-comparable;
- unknown.

The comparison component accepts the authoritative legacy result, immutable compiled result, and exact policy. It performs no scoring and modifies neither result. Numeric and semantic parity are independent outputs; one cannot imply the other.

### Numeric parity

The policy must explicitly identify the legacy numeric field, compiled numeric field, rounding or canonicalization, treatment of legacy forced values, and whether exact equality is required. No tolerance or epsilon is authorized. Until an exact numeric projection policy is accepted, numeric parity is `unknown` or unavailable.

### Semantic parity

Semantic comparison requires an explicit versioned mapping. Legacy permission, legacy score status, compiled execution status, compiled decision-band classification, and any future decision axes are not directly equivalent. In particular, legacy trade permission is not inferred from `POSITIVE` or `STRONG_POSITIVE` analytical bands.

### Diagnostic and non-comparable data

Reason-code order, warning order, section/evaluator hierarchy, provider lineage, policy lineage, generated IDs, persistence timestamps, compiled counts, binding traces, and legacy section scores may be preserved for diagnostics without receiving a false parity classification.

## Shadow execution identity and immutability

Every attempt carries one immutable operational correlation identity containing the semantic equivalents of:

- a shadow execution ID;
- the authoritative ScoreCheck ID when available;
- exact `templateId` and `templateVersion`;
- exact `rulebookId` and `rulebookVersion` when bound;
- existing compiler lineage: `compilerId`, `compilerVersion`, `compilationInputHash`, and `compiledAt`;
- execution timestamp.

The shadow execution ID is operational metadata only and is not written into ScoreCheck business state. Outputs are detached and deeply frozen, and Dates are cloned according to existing compiled-runtime standards.

## Feature flag and rollback

Future production invocation must use the existing `COMPILED_RULEBOOK_EXECUTION` flag. It remains default OFF. Disabled behavior is exactly the current legacy behavior. This ADR neither wires nor enables the flag and changes no default.

Rollback is disabling shadow invocation. It requires no template mutation, rulebook deletion, ScoreCheck migration, public-contract change, or legacy-scoring change. Historical compiled artifacts and execution bindings remain intact.

## Consequences

- Legacy authority and all public and persistence contracts remain stable.
- Runtime selection becomes explicit and historical rather than time-based.
- Observation provenance must be proved before compiled execution can run.
- Parity can evolve through immutable policy versions without rewriting historical meaning.
- The initial scope is deliberately narrow: system-template ScoreCheck creation only.
- Operational visibility is possible without introducing domain persistence.
- The initial synchronous seam has a latency cost and requires strong failure isolation.
- Additional contracts and test-local implementations are required before production wiring.

## Alternatives considered

1. **Select the most recently compiled rulebook — rejected.** It weakens immutable lineage and makes execution depend on mutable repository contents and timestamps.
2. **Treat compilation as activation — rejected.** Artifact creation is not rollout authority and would make user templates silently eligible.
3. **Silently convert legacy snapshots — rejected.** Raw snapshots do not prove compiled factor, subject, provider-binding, or resolution-policy lineage.
4. **Compare raw result objects — rejected.** Their envelopes, rounding, status vocabularies, confidence semantics, and diagnostics differ.
5. **Write shadow results into ScoreCheck immediately — rejected.** It changes authoritative domain persistence before parity semantics and rollout safety are proven.
6. **Integrate create and update together — rejected.** Update/recalculation has distinct lifecycle and ordering risks and remains a later decision.
7. **Enable user templates immediately — rejected.** Compilation does not prove an explicit binding or rollout approval.
8. **Propagate shadow failures — rejected.** That would make a non-authoritative path change public legacy behavior.
9. **Execute shadow before authoritative writes — rejected.** Failure or latency could prevent or reorder existing side effects.
10. **Introduce asynchronous durable jobs immediately — deferred.** Delivery, retries, idempotency, ordering, correlation, storage, and operations require separate architecture.

## Migration and rollout

The authorized sequence is:

```text
parity contracts and pure comparison
  -> exact execution-binding authority
  -> observation assembly
  -> standalone shadow orchestration
  -> replay and parity tests
  -> default-OFF ScoreCheck create integration
  -> operational observation
  -> later update-flow decision
  -> later user-template decision
  -> possible future authority-promotion ADR
```

Only this architecture decision is complete. Later steps are not implemented or approved by implication.

## Related artifacts

- ADR-050: Immutable compiled rulebook repository and read boundary
- ADR-051: Compiled rulebook runtime aggregation and observation attestation
- ADR-052: Compiled runtime execution preparation
- ADR-053: Compiled binding execution runtime
- ADR-054: Compiled rulebook runtime execution
- `src/types/compiled-rulebook.types.ts`
- `src/types/compiled-shadow-observation.types.ts`
- `src/types/compiled-execution-request.types.ts`
- `src/types/compiled-rulebook-execution.types.ts`
- `src/config/feature-flags.ts`
- `src/services/score-check.service.ts`

