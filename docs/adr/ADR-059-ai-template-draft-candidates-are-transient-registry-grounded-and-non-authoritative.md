# ADR-059: AI Template Draft Candidates Are Transient, Registry-Grounded and Non-Authoritative

Status: ACCEPTED

Date: 2026-08-05

Phase: Track B1-B

## Context

Track A proved deterministic compilation, compiled shadow execution, and legacy-versus-compiled parity for one real internal SYSTEM-template slice. Legacy templates remain the editable source of truth, compiled rulebooks remain immutable execution artifacts, legacy scoring remains authoritative, and compiled execution remains default OFF.

Track B1-A audited the repository for AI-assisted template drafting. The repository has reusable provider-independent LLM invocation, structured JSON parsing and schema validation, typed provider failures, and metadata-only tracing. It does not have a generic template-drafting workflow. It also has no document-ingestion, chunking, embedding, vector-store, retrieval, citation, reranking, or RAG orchestration infrastructure.

Future template persistence has lifecycle risks that are outside this phase. USER-template duplication currently creates an ACTIVE template, ScoreCheck resolution accepts DRAFT and ACTIVE templates, there is no explicit approval-to-activation transition, and an unused ACTIVE template may be edited in place while used templates receive a new version. AI output therefore cannot safely be projected into template persistence yet.

The first drafting milestone needs a useful but non-authoritative result without granting an LLM control over template, factor, provider, compilation, or execution authority. It must preserve unsupported user intent rather than silently replacing it with superficially similar registered behavior.

The initial workflow is:

```text
validated user request
  -> compact exact registry-knowledge projection
  -> versioned prompt orchestration
  -> structured LLM draft candidate
  -> deterministic candidate validation
  -> supported bindings
     + unresolved concepts
     + clarification questions
     + warnings
  -> immutable review report
  -> no persistence
```

## Decision

### Transient non-authoritative candidate

The LLM returns a dedicated, versioned `TemplateDraftCandidate`. It does not return a `CreateTemplateRequest`, persisted `ScoringTemplate`, compiled rulebook, execution binding, Evidence, ScoreCheck result, or provider authority.

A candidate is a proposal envelope. It cannot score, compile, activate, execute, create a database record, or establish a valid authority identity. The first MVP keeps the model candidate, deterministic validation result, and review report transient for the current response or deterministic test execution.

The first MVP does not persist raw candidates, prompts, model responses, validation reports, or review reports. Existing metadata-only LLM tracing may continue under its accepted trace policy. Candidate persistence requires a future explicit architecture decision.

### Conceptual candidate separation

The conceptual candidate contains:

```text
TemplateDraftCandidate
  identity and generation lineage
  interpreted request
  requested concepts
  proposed bindings
  unresolved concepts
  clarification questions
  generation warnings
```

The model proposal and validated result are distinct immutable values:

```text
model candidate
  -> deterministic validation
  -> ValidatedTemplateDraftCandidate
     + TemplateDraftValidationReport
```

Validation never mutates the model proposal. A deterministic review-report projection may present the candidate and validation result, but it is not a second authority and cannot improve or change support through another LLM call.

### Closed registry-grounded vocabulary

The model may reference only exact authority values supplied by a compact generation projection. The bounded vocabulary may include:

- factor key and version;
- concise factor meaning;
- allowed subject types;
- value type and canonical-unit policy;
- registered relationship vocabulary and executable support;
- provider capability or availability summary;
- compilation-support summary;
- missing-data policy choices;
- bounded template constraints.

The projection is generation context, not authority. Deterministic validation resolves every proposed exact reference again against the current exact authorities. An LLM assertion that an identity exists or is `SUPPORTED` has no authoritative effect.

The model never receives evaluator implementation objects, provider runners, compiled policies, compiled rulebooks, or execution bindings as candidate-owned content.

### Compact registry knowledge projection

The first MVP uses an immutable, bounded, versioned projection generated from exact runtime authorities. It is not retrieval and registry references are not RAG citations.

The projection preserves semantic equivalents of:

```text
projection ID
projection version
source authority identities and versions
canonical digest
deterministic generation lineage
```

Caller-supplied or deterministic build lineage is preferred to ambient system time. The projection has deterministic ordering and bounded content. Exact registries remain authoritative if the projection and current authority disagree.

### Requested-concept preservation

Every meaningful concept interpreted from the user request remains visible in at least one of:

```text
supported bindings
unresolved concepts
clarification questions
warnings
```

The workflow never drops, substitutes, or coerces a concept merely to create a valid-looking candidate. For example, an unregistered request for `long buildup` remains unresolved; it is not silently replaced with price momentum or open-interest change.

### Requirements and deterministic support

Candidate concepts use a closed requirement vocabulary with semantic equivalents of:

```text
UNSUPPORTED
REQUIRES_NEW_FACTOR
REQUIRES_NEW_RELATIONSHIP
REQUIRES_PROVIDER
REQUIRES_CLARIFICATION
```

Multiple requirements may apply to one concept through an immutable collection equivalent to:

```text
requirements: readonly DraftRequirementCode[]
```

A model may propose a support interpretation, but deterministic validation produces the authoritative support result. A binding is `SUPPORTED` only when deterministic validation accepts all required exact references and constraints. `SUPPORTED` is therefore a validated outcome rather than an authority granted by model text.

For example, broker-research sentiment may simultaneously require a new factor and a provider. A lossy single status must not hide either requirement.

### Candidate binding references

A proposed binding preserves semantic equivalents of:

```text
requested concept
exact factor key and version
relationship
subject binding
missing-data behavior
optional rationale
bounded context references
```

The deterministic validator rechecks every proposed reference. A candidate binding does not contain executable implementation objects or runtime policy objects, and its presence does not imply compilation support.

### Relationship handling

The candidate may reference only registered relationship vocabulary. Current executable support remains bounded by exact authorities.

Unsupported or deferred semantics such as `CONDITIONAL`, `CONFIRMATION_ONLY`, `RISK_ONLY`, and `VETO` remain unresolved unless current exact authorities explicitly support their intended use. They are never converted into `DIRECT` or `INVERSE` merely to pass validation.

### Subject handling

Subject kind and identity remain explicit. The workflow preserves distinctions such as:

```text
COMPANY/TATA_STEEL
INSTRUMENT/TATASTEEL_EQ
INSTRUMENT/TATASTEEL_FUT
ASSET/BTC
INSTRUMENT/BTCUSDT
```

The model may propose only supplied subject vocabulary. Ambiguous issuer, exchange, instrument, contract, or expiry intent produces a clarification question. No subject or expiry is guessed.

### Weight handling

AI-proposed weights are disabled in the first MVP. Model-supplied weights are not accepted. The candidate records an unresolved weight policy equivalent to:

```text
weightStatus = REQUIRES_USER_INPUT
```

Equal weights are not silently applied. `WEIGHT_PROPOSALS_ENABLED` remains default OFF and unwired for this workflow. AI-assisted weights require a later explicit decision and evaluation.

### Dedicated structured-generation boundary

Future implementation uses a dedicated drafting port. The Copilot controller is not a template-drafting domain boundary.

The drafting port will support:

- a versioned request;
- the compact registry projection;
- a versioned system prompt;
- a strict candidate schema;
- explicit model and provider identity;
- typed completion and failure;
- metadata-only tracing.

This ADR does not select an LLM provider, model, hosted service, provider-specific response format, production prompt, token price, or token limit.

### Deterministic validation authority

A deterministic validator runs after every model response and is authoritative for:

- candidate schema and version;
- collection and text-size bounds;
- dense arrays and duplicate detection;
- exact factor existence and version;
- subject compatibility;
- relationship availability;
- value-type and unit compatibility;
- provider requirements;
- compilation-support reporting;
- unresolved-concept preservation;
- disabled weight proposals;
- projection-lineage consistency.

Validation makes no LLM call, Evidence read, provider call, compilation request, persistence read, or persistence write. It uses exact lookup only and never substitutes latest, insertion order, or inferred versions.

Compilation-support reporting is descriptive. Candidate validation does not compile a template and does not make a candidate compile eligible.

### Partial success

Partial candidate success is permitted. A schema-valid response may contain deterministically valid supported bindings alongside explicit unresolved concepts.

```text
request: price momentum + long buildup + broker research
supported: price momentum
unresolved: long buildup + broker research
outcome: PARTIAL
```

One unsupported concept does not invalidate otherwise valid bindings, provided every requested concept remains visible and no fabricated authority reference is accepted.

### Typed workflow outcomes

The first MVP uses closed semantic outcomes equivalent to:

```text
COMPLETED
PARTIAL
VALIDATION_FAILED
PROVIDER_FAILED
FEATURE_DISABLED
UNSUPPORTED_REQUEST
```

`RETRIEVAL_FAILED` is excluded because B1 performs no retrieval. Malformed model output, deterministic validation failure, provider failure, disabled capability, and unsupported user intent are distinct typed outcomes. Exception-message inspection does not determine an outcome.

### Candidate identity and lineage

Every candidate result preserves semantic equivalents of:

```text
candidate ID
candidate schema version
drafting request ID
model provider identity
model or model-family identity
prompt ID and version
registry projection ID, version, and digest
generation attempt identity
validation policy version
```

Caller-supplied or injected deterministic identities are required where reproducibility matters. Pure validation performs no hidden random-ID or current-time generation. Operational traces do not persist prompt text.

### Human confirmation and future persistence

The first MVP ends before persistence:

```text
validated candidate
  -> human review
  -> explicit acceptance
  -> future safe USER/DRAFT projection
```

Human confirmation is mandatory before any persisted template is created. Confirmation does not imply activation, compilation, execution, or public listing.

Before B1-G may project candidates, its accepted architecture and implementation must resolve or explicitly characterize:

- exclusion of unapproved DRAFT templates from ScoreCheck;
- creation of DRAFT rather than ACTIVE templates where applicable;
- an explicit approval and activation transition;
- ownership enforcement;
- immutable or versioned approved state;
- material-edit behavior;
- preservation of approved historical versions;
- prohibition on AI-created ACTIVE templates.

### No RAG in B1

The first MVP introduces no document model, chunk model, parser, embedding, vector database, semantic search, hybrid search, reranking, retrieval citation, user-document ingestion, or RAG orchestration.

Track B2 may introduce approved document and retrieval architecture only after the candidate contract, deterministic validator, prompt contract, unresolved-concept behavior, and lifecycle-safe DRAFT projection are stable.

### Security and privacy

The initial generation context contains only the bounded registry projection and required request fields. It does not automatically include private market reports, user documents, raw Evidence, provider credentials, full account history, unrelated templates, or templates owned by other users.

Existing external-model privacy and configuration policies remain applicable. User-private RAG is deferred to Track B2 and requires explicit tenant isolation, access propagation, retention, and deletion decisions.

### Evaluation lineage

Future contracts must be capable of preserving the following for deterministic fixtures and governance without implementing an evaluation harness in B1:

- request fixture identity;
- expected requested concepts;
- prompt version;
- candidate schema version;
- projection digest;
- model identity;
- structured-output validity;
- final validated support results;
- invented-reference count;
- unresolved-concept recall;
- deterministic validation errors.

### Feature and runtime boundaries

All future generation integration remains behind an approved drafting feature flag that defaults OFF. This ADR enables no feature flag and introduces no runtime behavior.

Legacy templates, ScoreCheck, compiler behavior, compiled repositories, execution bindings, legacy scoring, and compiled runtime remain unchanged. AI does not make or execute a trading decision.

## Consequences

- The initial deliverable is useful for review while incapable of modifying scoring authority.
- Exact registries, not model confidence or prose, decide support.
- Unsupported and ambiguous intent remains visible.
- Partial results can be returned safely without fabricating a complete template.
- Registry-only context reduces implementation risk, token usage, and evaluation complexity.
- Users cannot save or resume candidates in the first MVP.
- Users must supply or approve weights later.
- Rich prose knowledge and private documents are unavailable until Track B2.
- Candidate-to-DRAFT projection waits for lifecycle safety.
- Implementation requires new candidate, projection, validation, drafting-port, and tracing contracts in later phases.

## Alternatives considered

### LLM returns `CreateTemplateRequest`

Rejected. It couples probabilistic output directly to a persistence DTO, cannot preserve unresolved concepts cleanly, and creates pressure to accept model-controlled authority fields.

### LLM returns a persisted template directly

Rejected. It bypasses deterministic review and the mandatory human-confirmation boundary, and current DRAFT/ACTIVE behavior is not safe for AI projection.

### LLM returns free text only

Rejected. Free text cannot be validated completely, cannot provide exact support lineage, and makes hallucination measurement unreliable.

### Dedicated transient structured candidate

Accepted. It preserves model interpretation while separating it from domain and execution authority.

### Persist every candidate immediately

Rejected for the first MVP. It creates privacy, retention, tenancy, schema-migration, and lifecycle obligations before the candidate contract is proven.

### Keep candidates transient initially

Accepted. It is the smallest reversible boundary and leaves existing templates unchanged.

### Vector RAG in the first milestone

Deferred to Track B2. The repository lacks the required corpus, ingestion, retrieval, citation, security, and evaluation infrastructure.

### Registry-only projection first

Accepted. Structured runtime authorities provide exact bounded vocabulary with deterministic validation and efficient context.

### Allow invented or open factor references

Rejected. An invented identity cannot become valid because it appears in model output.

### Closed references plus unresolved concepts

Accepted. It preserves user intent without weakening authority.

### AI-generated weights initially

Deferred. Weight quality and user expectations require a separate decision and evaluation.

### No initial AI weights

Accepted. Weight requirements remain explicit user work; equal weighting is not inferred.

### Reuse Copilot as the drafting boundary

Rejected. Copilot is a workflow-specific controller and response schema, not a reusable authoring-domain port.

### Dedicated drafting port

Accepted for future implementation. It isolates versioned generation and typed failures without selecting a provider.

### Reject the whole request if any concept is unsupported

Rejected. It discards valid work and makes unsupported-concept recall less visible.

### Partial candidate with visible unresolved concepts

Accepted. Valid bindings remain useful while missing capabilities are explicit.

### Apply equal weights automatically

Rejected. Equal weighting is a scoring decision, not a neutral formatting default.

### Require user-supplied weights later

Accepted for the first projection direction. Any later AI proposal remains non-authoritative and separately gated.

## Why rejected

Alternatives were rejected when they granted probabilistic output template or execution authority, hid unsupported intent, depended on absent retrieval infrastructure, introduced premature persistence, weakened exact-version validation, or silently made scoring decisions. Deferred alternatives require dedicated contracts, safety boundaries, and evaluation evidence before adoption.

## Migration and rollback

This ADR is documentation only. It changes no runtime behavior, schema, feature flag, template, source file, test, dependency, or persistence boundary.

Future generation integration must remain default OFF. Its operational rollback is:

```text
disable drafting generation
  -> no model call
  -> no candidate response
  -> no template changes
```

Because the B1 MVP persists no candidate or template, disabling it requires no data migration. Existing templates, legacy scoring, compilation, and compiled shadow execution remain unaffected.

## Related artifacts

- Track B1-A repository audit and contract discussion
- `src/models/scoring-template.model.ts`
- `src/services/scoring-template-crud.service.ts`
- `src/services/scoring-template-validation.service.ts`
- `src/services/scoring-template-registry.service.ts`
- `src/services/scoring-engine.service.ts`
- `src/registries/default-factor-definitions.ts`
- `src/registries/template-rule-compilation-mapping.registry.ts`
- `src/ports/llm-provider.port.ts`
- `src/services/llm.service.ts`
- `src/services/llm-trace.service.ts`
- `src/config/feature-flags.ts`
- ADR-055 through ADR-058
- Track B1-CD — Candidate Contracts, Deterministic Validator and Compact Registry Knowledge Projection
- Track B1-EF — Structured Generation and Review Report
- Track B1-G — Safe USER/DRAFT Lifecycle and Projection
- Track B1-H — End-to-End Drafting Proof
- Track B2 — Document Corpus, Chunking, Embeddings, Retrieval and RAG
