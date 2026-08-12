# Backend Service Organization Plan

Status: approved migration plan (S1)  
Scope: `yujidi-server/src/services` only  
Behavioral changes: none

## Purpose

Keep the existing layered backend architecture while replacing the flat service
directory with domain subdirectories. Controllers, routes, models, repositories,
types, composition roots, persistence, APIs, and runtime behavior remain unchanged.

The inventory contains 170 top-level TypeScript service files (30,957 lines).
The existing `services/security` directory is already organized and is not part of
this migration.

## Target structure and ownership

| Directory | Responsibility | Files |
| --- | --- | ---: |
| `access/` | authentication, application authorization, and audit | 5 |
| `ai-runtime/` | provider-neutral AI execution controls, LLM access, and telemetry | 13 |
| `compiled-rulebook/` | compilation, compiled execution, shadow execution, and parity | 24 |
| `copilot/` | template drafting, review, acceptance, and RAG drafting orchestration | 29 |
| `evidence/` | evidence ingestion, resolution, attestation, and shadow preparation | 11 |
| `knowledge/` | corpus, chunks, embeddings, retrieval, vector publication, and Atlas administration | 28 |
| `market-data/` | quotes, snapshots, brokers, subscriptions, symbols, and news | 10 |
| `providers/` | provider catalog, health, policy, and resolution | 5 |
| `scoring/` | legacy scoring, factor evaluation, aggregation, normalization, and template CRUD | 25 |
| `templates/` | canonical template resources and monitoring orchestration | 3 |
| `trading/` | trade lifecycle, monitoring, risk, analyzer, events, and WebSocket delivery | 24 |
| **Total** |  | **177** |

## Exact migration manifest

File names below are relative to `yujidi-server/src/services`. Each file moves
from the directory root into the named directory without changing its name.

### `access/`

```text
application-authorization.service.ts
application-rag-retrieval-authorization.service.ts
audit-log.service.ts
audit-sanitizer.service.ts
auth.service.ts
```

### `ai-runtime/`

```text
ai-governed-execution-context.service.ts
ai-provider-circuit-attribution.service.ts
ai-provider-outcome-projection.service.ts
ai-provider-usage-aggregation.service.ts
ai-runtime-budget.service.ts
ai-runtime-circuit-breaker.service.ts
ai-runtime-concurrency.service.ts
ai-runtime-deadline-context.service.ts
ai-trade-review-context.service.ts
ai-trade-review.service.ts
internal-rag-lifecycle-logger.service.ts
llm-trace.service.ts
llm.service.ts
```

### `compiled-rulebook/`

```text
canonical-compilation-input.service.ts
compiled-binding-disposition.service.ts
compiled-binding-execution.service.ts
compiled-binding-score-projection.service.ts
compiled-evaluator-runtime-validation.service.ts
compiled-generic-relationship-evaluator.ts
compiled-legacy-parity-comparison.service.ts
compiled-legacy-parity-policy.service.ts
compiled-observation-attestation-validation.service.ts
compiled-observation-selection.service.ts
compiled-rulebook-aggregation.service.ts
compiled-rulebook-compatibility-validation.service.ts
compiled-rulebook-contract-validation.service.ts
compiled-rulebook-decision-classification.service.ts
compiled-rulebook-execution-binding.service.ts
compiled-rulebook-execution.service.ts
compiled-rulebook-normalization.service.ts
compiled-rulebook-policy-consistency.service.ts
compiled-rulebook-read.service.ts
compiled-shadow-execution.service.ts
compiled-shadow-input-assembly.service.ts
compiled-shadow-observation-assembly.service.ts
compiled-subject-resolution.service.ts
deterministic-compiled-rulebook-compiler.service.ts
```

### `copilot/`

```text
copilot-draft-acceptance.service.ts
copilot-draft-review.service.ts
copilot-template-draft-application.service.ts
copilot-template-draft-response.service.ts
internal-template-draft-rag-application.service.ts
internal-template-draft-rag-request-assembly.service.ts
rag-draft-evaluation.service.ts
structured-generation-benchmark-evaluation.service.ts
template-draft-acceptance-validator.service.ts
template-draft-candidate-validator.service.ts
template-draft-citation-validation.service.ts
template-draft-dual-path-governed-execution.service.ts
template-draft-generation.service.ts
template-draft-intent-extraction.service.ts
template-draft-projection.service.ts
template-draft-prompt-application.service.ts
template-draft-prompt-context.service.ts
template-draft-rag-contradiction.service.ts
template-draft-rag-generation.service.ts
template-draft-rag-prompt-context.service.ts
template-draft-rag-review-report.service.ts
template-draft-rag-runtime-binding.service.ts
template-draft-rag-runtime.service.ts
template-draft-rag-shadow-comparison.service.ts
template-draft-registry-only-baseline.service.ts
template-draft-registry-projection.service.ts
template-draft-retrieval-query.service.ts
template-draft-review-report.service.ts
template-drafting-workflow.service.ts
```

### `evidence/`

```text
evidence-candidate-normalizer.service.ts
evidence-deduplication-key.service.ts
evidence-factor-compatibility.service.ts
evidence-ingestion.service.ts
evidence-lifecycle-resolver.service.ts
evidence-observability.service.ts
evidence-provider-resolution-attestation.service.ts
evidence-provider-runner.service.ts
evidence-read.service.ts
evidence-shadow-execution.service.ts
evidence-source-resolution.service.ts
```

### `knowledge/`

```text
development-knowledge-ingestion.service.ts
knowledge-chunk-citation-source.service.ts
knowledge-chunk-set-manifest.service.ts
knowledge-chunk-set-verification.service.ts
knowledge-chunk-validation.service.ts
knowledge-chunking.service.ts
knowledge-citation-handle.service.ts
knowledge-citation-validation.service.ts
knowledge-context-assembly.service.ts
knowledge-corpus-publication.service.ts
knowledge-document-admission.service.ts
knowledge-document.service.ts
knowledge-embedding-normalization.service.ts
knowledge-embedding-text.service.ts
knowledge-embedding.service.ts
knowledge-query-text.service.ts
knowledge-retrieval-candidate-validation.service.ts
knowledge-retrieval-execution-authorization.service.ts
knowledge-retrieval-reranking.service.ts
knowledge-retrieval.service.ts
knowledge-vector-index-build-verification.service.ts
knowledge-vector-index-projection.service.ts
knowledge-vector-index-publication.service.ts
knowledge-vector-indexing.service.ts
knowledge-vector-projection-population-verification.service.ts
knowledge-vector-searchable-metadata-projection.service.ts
mongo-atlas-vector-index-administration.service.ts
mongo-atlas-vector-index-specification.service.ts
```

### `market-data/`

```text
angel-user-market-data-session.service.ts
binance.service.ts
broker-connection.service.ts
market-quote.service.ts
market-snapshot.service.ts
market-subscription-resolver.service.ts
market-subscription-router.service.ts
news.service.ts
symbol-resolver.service.ts
symbol-search.service.ts
```

### `providers/`

```text
provider-catalog.service.ts
provider-health-assessment.service.ts
provider-resolution-composition.service.ts
provider-resolution-execution.service.ts
provider-resolution-policy.service.ts
```

### `scoring/`

```text
decision-band-classification-core.ts
deterministic-factor-pipeline.service.ts
explicit-factor-evaluator-execution.service.ts
factor-aggregate-normalization-execution.service.ts
factor-aggregate-normalization-policy.service.ts
factor-contribution-aggregation-execution.service.ts
factor-contribution-aggregation-policy.service.ts
factor-decision-band-execution.service.ts
factor-decision-band-policy.service.ts
factor-evaluator-contract.service.ts
factor-evaluator-execution-plan.service.ts
factor-evaluator-plan-runner.service.ts
factor-input-assembly.service.ts
generic-factor-legacy-compatibility.service.ts
generic-relationship-calculation-core.ts
generic-relationship-factor-evaluator.ts
india-equity-scoring-evaluators.ts
score-check.service.ts
scoring-context-builder.service.ts
scoring-context.service.ts
scoring-engine.service.ts
scoring-rule-evaluator-registry.service.ts
scoring-template-crud.service.ts
scoring-template-registry.service.ts
scoring-template-validation.service.ts
```

### `templates/`

```text
canonical-template-snapshot.service.ts
template-monitoring-orchestrator.service.ts
template-resource-resolver.service.ts
```

### `trading/`

```text
active-trade-live-monitor.service.ts
active-trade-subscription.service.ts
active-trade.service.ts
analyzer.rules.ts
analyzer-order-book-calculation.ts
analyzer-runtime-snapshot.ts
analyzer-state-transition.ts
analyzer-tick-validation.ts
analyzer-trigger-projection.ts
analyzer.service.ts
monitor.service.ts
risk-governor.service.ts
risk-state-projection.service.ts
trade-event-delivery.service.ts
trade-event.service.ts
trade-journal.service.ts
trade-monitoring-health.service.ts
trade-monitoring.service.ts
trade-plan-dashboard-projection.ts
trade-plan-validation.ts
trade-plan.service.ts
trade-result.service.ts
trade-setup.service.ts
websocket.service.ts
```

## Dependency and import policy

1. A moved service may import another service by its exact file path. Internal
   service-to-service imports must not use a domain `index.ts`, avoiding barrel
   cycles and hiding no dependency.
2. Each domain may expose a small `index.ts` for controllers, composition roots,
   scripts, and tests. It exports only the services actually consumed outside
   that domain; it is not an export of every file.
3. Existing service dependencies may be preserved during the mechanical moves.
   Reorganizing files does not authorize dependency redesign.
4. New circular dependencies are prohibited. The six approved legacy cycles stay
   visible in `docs/architecture/known-circular-dependencies.json` until a later,
   behavior-preserving extraction removes them.
5. No TypeScript path aliases are introduced in this migration. Existing
   NodeNext `.js` import specifiers remain authoritative.
6. No compatibility shim files remain at the old paths. All consumers are updated
   in the same migration batch so there is one canonical location per service.

## Execution sequence

Each batch must independently pass focused tests, full backend tests, typecheck,
the circular dependency gate, and `git diff --check` before the next batch.

| Batch | Move | Reason |
| --- | --- | --- |
| S2.1 | `copilot/`, `knowledge/`, `ai-runtime/` | Organizes the largest new RAG/Copilot surface together while keeping its connected dependencies in one review. |
| S2.2 | `compiled-rulebook/`, `evidence/`, `providers/` | Moves the immutable compiled and evidence runtime as one lineage-sensitive group. |
| S2.3 | `scoring/`, `templates/` | Moves legacy and generic scoring contracts after compiled consumers have stable paths. |
| S2.4 | `market-data/`, `trading/`, `access/` | Moves the operational legacy surface last because it contains all six approved cycles and the largest services. |
| S3 | Split oversized services | Separate follow-up; only services over 500 lines are candidates, and every split requires characterization tests. |
| S4 | Enforce structure | Add repository checks preventing new root-level services and accidental barrel-based internal imports. |

## Oversized-service candidates

File movement and service decomposition are deliberately separate changes. After
all moves pass, the first decomposition candidates are:

| Service | Current lines | Intended treatment |
| --- | ---: | --- |
| `trading/trade-plan.service.ts` | 1,445 | extract validation, mapping, and query collaborators |
| `trading/analyzer.service.ts` | 1,306 | extract input processing and state-transition collaborators |
| `trading/websocket.service.ts` | 1,130 | extract connection/session and message-delivery collaborators |
| `scoring/score-check.service.ts` | 1,100 | extract preparation and result projection collaborators |
| `trading/trade-setup.service.ts` | 1,008 | extract validation and persistence mapping collaborators |
| `scoring/scoring-context-builder.service.ts` | 741 | extract source-specific context assemblers |
| `scoring/india-equity-scoring-evaluators.ts` | 648 | split evaluators by factor family while preserving registry exports |
| `trading/active-trade.service.ts` | 634 | extract lifecycle validation and projection collaborators |
| `scoring/scoring-template-crud.service.ts` | 633 | extract read projection and write validation collaborators |
| `scoring/factor-contribution-aggregation-execution.service.ts` | 574 | extract pure validation from aggregation orchestration |
| `trading/monitor.service.ts` | 508 | extract scheduling/state coordination collaborators |

Line count alone does not authorize a split. Characterization coverage and a
single-responsibility seam must exist first.

## Acceptance gates

- No API, route, controller, model, repository, persistence, feature-flag, or
  runtime behavior changes.
- All 170 migrated root-level services have exactly one destination in this manifest;
  seven S3 helper modules live beside the services they support.
- No new top-level service file is introduced during migration.
- Imports resolve without compatibility shims or TypeScript aliases.
- Focused and full backend tests pass after every batch.
- Typecheck passes after every batch.
- Circular dependency audit reports no new cycles.
- `git diff --check` passes.
