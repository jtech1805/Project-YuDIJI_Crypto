# YUDIJI Feature and RAG Architecture Summary

Status: Current implementation summary  
Audience: Product, engineering, operations, and future contributors  
Last reviewed: 2026-08-13

## 1. Product objective

YUDIJI helps a trader define how a trade should be evaluated, gather the data
required by that definition, calculate a reproducible score, and use the result
inside a governed trading workflow.

The core product flow is:

```text
Create or select a scoring template
  -> review and activate the template
  -> select an instrument and propose a trade
  -> collect the data required by the template
  -> evaluate each factor
  -> aggregate and classify the result
  -> present the score and explanation
  -> monitor the accepted trade
```

The AI Copilot does not replace this flow. It adds a safer way to prepare a
template draft:

```text
Create Scoring Template
  -> Create Manually
     or
  -> Create with Copilot
```

Both paths converge into the same template lifecycle. There is no separate
"AI template" product, editor, activation mechanism, or scoring engine.

## 2. The most important authority rule

YUDIJI separates suggestion from authority.

```text
AI and RAG may suggest and explain
User must review and choose
Backend registries must validate
Existing template lifecycle must persist and activate
Scoring engine must calculate
```

The model is never allowed to:

- register a new factor, evaluator, relationship, provider, or unit;
- invent an internal authority identifier;
- decide or silently populate business-critical weights;
- persist or activate a scoring template directly;
- convert retrieved text into market Evidence;
- calculate an authoritative trade score;
- bypass backend validation, feature controls, or authorization.

This is why the AI integration is primarily an authority-design feature, not
only an LLM call.

## 3. Main architecture areas

The backend is organized by responsibility under `src/services`:

| Area | Responsibility |
| --- | --- |
| `access/` | authentication, application roles, authorization, and audit |
| `ai-runtime/` | AI deadlines, budgets, concurrency, circuits, provider outcomes, usage, and tracing |
| `copilot/` | prompt interpretation, generation, candidate validation, review, acceptance, and RAG orchestration |
| `knowledge/` | document admission, chunking, embeddings, retrieval, citations, vector projection, and publication |
| `compiled-rulebook/` | deterministic compilation, compiled execution, shadow execution, and parity |
| `evidence/` | canonical observations, provenance, eligibility, resolution, and replay preparation |
| `providers/` | provider catalog, health, exact resolution, and policy |
| `scoring/` | authoritative scoring, factor evaluation, aggregation, normalization, and template CRUD |
| `templates/` | canonical template resources and monitoring orchestration |
| `market-data/` | quotes, symbols, subscriptions, broker sessions, snapshots, and news |
| `trading/` | plans, setups, active trades, monitoring, risk, events, Analyzer, and WebSockets |

The domain folders improve navigation without creating a new framework or
changing the public behavior of existing services.

## 4. Existing manual template and scoring path

The manual path remains authoritative and independent of AI availability.

```text
User enters template details and bindings
  -> backend validates the request
  -> template is stored as USER/DRAFT
  -> user reviews or edits it
  -> explicit activation occurs through the existing lifecycle
  -> ScoreCheck resolves the active template
  -> scoring context supplies factor inputs
  -> evaluators calculate factor contributions
  -> aggregation, normalization, and decision policies produce the result
```

A template describes what must be evaluated. It does not itself contain the
current market observation.

For example:

```text
Template requirement: BTC ETF net flow
Factor authority: exact registered ETF-flow factor and version
Provider observation: +$240 million net flow at a stated observation time
Evaluator: exact registered implementation and configuration
Relationship: DIRECT
User weight: 30%
```

The factor observation is evaluated only after its identity, subject, provider
lineage, time, value contract, and configuration are validated.

## 5. Copilot template-drafting flow

The product-facing API accepts a free-form request such as:

```text
Create a BTC scoring-template draft using ETF net flow and momentum.
```

The implemented path is:

```text
Authenticated request
  -> product feature admission
  -> bounded prompt/intent interpretation
  -> canonical subject and requested concepts
  -> exact runtime-binding resolution
  -> registry-only authoritative baseline generation
  -> optional RAG shadow execution
  -> deterministic candidate validation
  -> safe review projection
  -> opaque review reference returned to the client
```

The review projection exposes user-relevant information, for example:

```text
Subject: BTC
Concept: ETF net flow
Binding: supported registered factor
Relationship: DIRECT
Weight: user input required
```

It does not expose writable internal factor keys, evaluator IDs, registry IDs,
provider authority, candidate identities, or compilation authority.

### Acceptance and persistence

When the user accepts the proposal, the client submits:

- the opaque review identity and version;
- normal template metadata;
- accepted binding review identities;
- one explicit weight for every accepted binding.

The backend rereads the owner-scoped review, rejects stale or expired material,
reconstructs authoritative bindings server-side, validates all weights, and
creates a normal `USER/DRAFT` template.

The required weight rules are:

- every accepted binding has a weight;
- each weight is between 0 and 100;
- the total is exactly 100%;
- unresolved concepts cannot be accepted as executable bindings.

The draft then returns to the existing editor and explicit activation flow.

## 6. What RAG means in YUDIJI

RAG means Retrieval-Augmented Generation. Instead of asking the model to rely
only on its general training, YUDIJI retrieves a small, relevant, governed set
of project knowledge and supplies it as labelled context.

The important distinction is:

```text
Registry projection = exact system authority
Retrieved documents = explanatory, citation-bearing context
Model output = untrusted proposal
Deterministic validator = final drafting gate
```

If retrieved text conflicts with a registry, the registry wins.

### Example

A user asks:

```text
Build a BTC template using ETF net flow.
```

The exact registry tells the system whether an ETF-flow factor exists, which
subjects and relationships it supports, and which versions are allowed. RAG may
retrieve approved documentation explaining what ETF net flow means, how DIRECT
interpretation works, and what limitations should be shown. Gemini uses both
envelopes to propose a structured candidate. The validator then rejects any
unregistered factor, unsupported relationship, invalid subject, fabricated
citation, or AI-generated weight.

RAG improves explanation and grounded drafting; it does not expand authority.

## 7. Knowledge ingestion and chunking

The initial RAG corpus is `PLATFORM_KNOWLEDGE`: approved YUDIJI documentation,
factor guidance, relationship explanations, template examples, validation
guidance, and curated architecture summaries.

Documents enter through explicit admission and immutable versioning:

```text
Source document
  -> admission and trust validation
  -> immutable document version
  -> structure-aware chunking strategy
  -> complete immutable chunk-set manifest
  -> canonical embeddings
  -> immutable vector-index projections
  -> explicit corpus/index publication
```

YUDIJI does not use one universal blind fixed-size chunker. It uses versioned,
document-specific, structure-aware strategies. Factor documentation keeps a
factor's meaning, subject/value/unit contract, limitations, and examples
together. ADR summaries preserve decisions, restrictions, and consequences.
Tables and other structured sources retain the context required to interpret
their values.

Each chunk preserves exact lineage including document and chunk versions,
strategy version, content digest, ordinal, source span, corpus, trust level, and
applicable metadata. A chunk-set manifest proves that a document projection is
complete; retrieval cannot silently operate on a partially generated set.

## 8. Embedding and vector architecture

Embeddings are derived search artifacts, not truth or business authority.

The current production adapter path uses Gemini for embeddings with an explicit
embedding purpose and exact model/schema lineage. Provider-neutral
normalization is applied by a versioned YUDIJI authority, so provider behavior
cannot silently define domain semantics.

The vector flow is:

```text
Immutable chunk
  -> purpose-specific embedding request
  -> Gemini embedding adapter
  -> versioned normalization
  -> canonical immutable KnowledgeEmbedding
  -> immutable provider-neutral index projection
  -> MongoDB Atlas Vector Search
```

Canonical embeddings and vector-index projections are deliberately separate.
One embedding may be published to different exact indexes or namespaces. A new
index publication does not rewrite the embedding, and an indexing failure does
not mutate the source document or chunk.

Atlas candidates are treated as untrusted search results. Their identities and
digests must be reread against canonical repositories before they can enter
model context.

## 9. Retrieval pipeline

The bounded retrieval pipeline is:

```text
Normalized concept query
  -> exact corpus/index/retrieval-policy lookup
  -> Gemini query embedding
  -> metadata-filtered Atlas vector search
  -> optional lexical search
  -> exact source and lineage rereads
  -> candidate validation
  -> version-aware deduplication
  -> deterministic reranking
  -> bounded context selection
  -> trusted citation-handle creation
```

Important controls include:

- explicit corpus, namespace, publication, index, schema, and policy versions;
- bounded top-K and context budget;
- deterministic tie handling and ordering;
- per-document dominance limits;
- exact document/chunk/embedding/projection lineage checks;
- no implicit `latest()` lookup for historical replay;
- closed trust levels and corpus isolation;
- prompt-injection-resistant context envelopes;
- citations created by the backend, not by the model.

Only citation handles supplied to the model may appear in its response. Any
unknown, altered, unauthorized, or fabricated citation fails validation.

## 10. Dual-path execution and failure isolation

The governed application runtime uses two paths:

```text
                     -> registry-only baseline (authoritative)
Governed request ----|
                     -> RAG-enriched generation (shadow/diagnostic)
```

The baseline reuses exact registry-grounded generation and deterministic
validation without retrieval. If the baseline fails, shadow execution does not
continue. If the baseline succeeds but embedding, Atlas, RAG generation,
citation validation, or comparison fails, the failure cannot replace or mutate
the baseline result.

This guarantees that introducing RAG does not make the original drafting path
dependent on vector search.

The current runtime binding remains `SHADOW_ONLY`. RAG output is evaluated and
compared, but it is not silently promoted to production authority.

## 11. AI runtime governance

Every governed request is controlled by server-owned policy:

- product and RAG feature flags default OFF;
- exact runtime binding and version;
- one request budget reservation;
- bounded concurrency;
- one overall request deadline;
- caller disconnect cancellation;
- independent generation, embedding, and vector-provider circuits;
- normalized provider outcomes;
- stage-level timing and metadata-only usage;
- a kill switch and explicit rollout mode.

Provider stages are distinguished as:

```text
BASELINE_GENERATION
QUERY_EMBEDDING
VECTOR_RETRIEVAL
RAG_GENERATION
```

Network failures, timeouts, and provider unavailability may affect circuit
health. Caller cancellation and downstream schema, registry, citation, or
business validation failures do not incorrectly penalize the provider.

No raw secret, prompt, complete provider response, vector, or Atlas pipeline is
written into routine operational traces.

## 12. Authentication and API boundaries

JWT cookies establish identity only. Application roles are reread from the
current User record and use the closed vocabulary `USER`, `INTERNAL`, and
`ADMIN`.

- Internal RAG endpoints require `INTERNAL` or `ADMIN`.
- The product Copilot endpoint is authenticated and separately protected by the
  default-OFF `COPILOT_TEMPLATE_DRAFT_ENABLED` admission flag.
- Role claims supplied by a client or stale JWT are not authorization authority.
- Caller cancellation is propagated through embedding, retrieval, and
  generation without being confused with a provider failure.

The product-facing endpoints include:

```text
POST /api/copilot/template-drafts
POST /api/copilot/template-drafts/:reviewId/accept
```

The create endpoint returns a safe product projection or a sanitized
clarification/unavailable outcome. The acceptance endpoint can create only an
owner-scoped normal draft after deterministic validation.

## 13. Compiled rulebook runtime

The compiled-rulebook architecture makes a template execution reproducible.

```text
Template snapshot
  -> deterministic compiler
  -> immutable compiled rulebook
  -> exact compiled execution request and observations
  -> subject resolution and input assembly
  -> exact evaluator/configuration implementation lookup
  -> one-binding execution
  -> compiled weighted mean
  -> exact normalization policy
  -> exact decision-band policy
  -> immutable compiled execution result
```

The runtime uses exact identities and versions. It never silently chooses a
latest evaluator, configuration, provider, rulebook, normalization policy, or
decision policy. Outputs are detached, dates are cloned, and lineage is
preserved for deterministic replay.

Provider-attested observations are independent from the legacy Evidence input
model. A compiled factor input contains only deterministic evaluator data and
provider provenance; it does not manufacture Evidence-specific IDs or source
priority fields.

Compiled execution has been integrated as shadow/parity infrastructure. Legacy
scoring remains authoritative. A compiled failure must not fail or alter the
legacy ScoreCheck response.

## 14. Evidence and provider lineage

Evidence represents an observed fact required by a factor, for example:

```text
Factor: BTC ETF net flow
Subject: BTC
Value: +240,000,000 USD
Observation time: 2026-08-13T08:00:00Z
Provider: exact provider identity/version
Attestation: exact provider-resolution decision
```

The evidence architecture preserves:

- observation time separately from publication and ingestion time;
- explicit freshness evaluation at the request's `asOf` time;
- immutable provider-resolution attestation;
- exact provider namespace mapping;
- replay eligibility independently from live-runner eligibility;
- deterministic duplicate and ambiguity rejection;
- append-only historical lineage.

A replay/characterization provider can prove historical behavior without a live
runner. Live Phase 3 provider execution still requires live eligibility and a
registered runner. This keeps historical proof independent from current vendor
availability.

## 15. End-to-end example

Assume a user asks Copilot:

```text
Create a BTC scoring template using ETF net flow and price momentum.
```

### Drafting

1. Authentication establishes the user.
2. Product admission verifies the Copilot feature state.
3. Prompt interpretation extracts subject `BTC` and concepts `ETF net flow` and
   `price momentum`.
4. The server resolves the exact runtime binding and registry projection.
5. The baseline generator proposes only registry-known candidates.
6. RAG retrieves approved explanatory chunks about ETF flow and momentum,
   verifies exact lineage, and provides backend-issued citations.
7. Gemini returns a structured proposal.
8. Deterministic validation rejects invented factors, invalid relationships,
   wrong subjects, weights, and invalid citations.
9. The API returns an opaque review reference and safe binding summaries.

### User decision and template lifecycle

10. The user selects supported bindings and enters, for example, ETF flow 40%
    and momentum 60%.
11. The backend proves every binding belongs to that review and totals exactly
    100%.
12. A normal `USER/DRAFT` scoring template is created.
13. The user can edit it in the existing editor and explicitly activate it.

### Future/live scoring use

14. When the active template is used for a trade, provider resolution identifies
    exact eligible data sources for the required factors.
15. Canonical observations/Evidence are collected with time and provenance.
16. The scoring context validates availability, freshness, subject, factor,
    provider, and unit compatibility.
17. Exact evaluators calculate the individual factor contributions.
18. Aggregation, normalization, and decision classification produce the score.
19. The authoritative legacy result is returned; compiled shadow execution may
    run independently to measure parity without changing that result.

The crucial point is that RAG participates in steps 5–8, during drafting. It does
not fabricate the live data in steps 14–16 or calculate the authoritative score
in steps 17–19.

## 16. How the project is now aligned

The major components now form one governed chain:

```text
Human intent
  -> Copilot proposal
  -> registry and RAG grounding
  -> deterministic validation
  -> human-owned weights and acceptance
  -> USER/DRAFT
  -> existing review and activation lifecycle
  -> provider-backed observations/Evidence
  -> authoritative scoring
  -> compiled shadow parity
  -> trade monitoring and alerts
```

Alignment is achieved through shared identities and strict boundaries:

- Templates declare factor requirements.
- Registries define which factors and relationships exist.
- RAG explains those registered concepts with citations.
- Users own weights and acceptance.
- Providers supply observations, not template authority.
- Evidence and attestations preserve provenance and time.
- Evaluators calculate contributions under exact versions.
- Compiled rulebooks preserve immutable execution lineage.
- Legacy scoring remains authoritative during shadow proof.
- Trading services consume accepted outputs without depending on AI drafting.

## 17. Current limitations and remaining product work

The architecture deliberately does not claim that every generated template is
immediately scoreable with live data.

Remaining practical work includes:

- mapping every supported factor to a production-grade provider and expected
  collection frequency;
- implementing and operating live provider runners where only compile/replay
  authority currently exists;
- proving freshness, outage, fallback, and market-hours policies per data type;
- expanding beyond the currently approved platform-knowledge corpus only after
  independent market-research and private-document controls exist;
- measuring RAG quality, citation quality, provider cost, latency, and failure
  rates under controlled rollout;
- promoting compiled execution only after parity evidence and an explicit
  authority decision; and
- keeping Copilot and RAG feature controls disabled until operational approval.

Binance alone cannot provide all template data. It is appropriate for exchange
market data such as crypto prices, trades, depth, and volume, but external data
such as ETF flows, filings, macro series, and some institutional datasets require
separate authoritative providers.

## 18. Architectural outcome

YUDIJI now has a coherent architecture in which AI improves usability without
becoming business authority. RAG supplies controlled project knowledge,
citations, and explanations. Exact registries define executable possibilities.
Users make consequential choices. Existing template persistence and activation
remain the lifecycle authority. Evidence and providers supply observed facts.
The scoring engine calculates the result, while the compiled runtime provides a
deterministic, immutable path toward future replacement only after parity is
proven.

This creates one product flow with clear ownership:

```text
AI proposes.
RAG grounds.
Registries constrain.
Users decide.
Backend validates.
Providers observe.
Scoring evaluates.
Compiled execution proves.
```

