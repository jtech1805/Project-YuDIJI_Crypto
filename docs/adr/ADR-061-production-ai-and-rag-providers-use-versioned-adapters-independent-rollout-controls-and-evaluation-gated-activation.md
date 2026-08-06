# ADR-061: Production AI and RAG Providers Use Versioned Adapters, Independent Rollout Controls and Evaluation-Gated Activation

Status: ACCEPTED

Date: 2026-08-06

Phase: Track C-A

## Context

ADR-059 and ADR-060, followed by Tracks B1 and B2, established provider-neutral structured template drafting and immutable, citation-bearing PLATFORM_KNOWLEDGE retrieval. The repository now has deterministic test implementations and exact registries, but no production generation, embedding, or vector-store adapter. AI candidates remain non-authoritative and can only be accepted as USER/DRAFT templates.

The production boundary must preserve exact provider, model, embedding, index, prompt, schema, corpus, and retrieval-policy lineage. It must also prevent provider availability, mutable aliases, SDK behavior, or commercial convenience from silently changing domain semantics.

This ADR distinguishes four kinds of statement:

- **Repository fact** describes inspected code as of this ADR.
- **Provider fact** is supported by linked first-party documentation.
- **Architectural inference** is a YUDIJI conclusion drawn from facts, not a vendor guarantee.
- **Decision** is the authoritative YUDIJI rule.

## Repository audit

### Reusable boundaries

Repository facts:

- `TemplateDraftGenerationPort` already isolates structured generation from parsing, deterministic authority validation, citation validation, review, and persistence.
- `KnowledgeEmbeddingPort` receives exact schema/provider/model identities and correlated inputs; embedding persistence remains outside the provider port.
- `KnowledgeVectorIndexWritePort` and `KnowledgeVectorSearchPort` isolate vector I/O. Search results are untrusted and exact document, chunk, manifest, embedding, and digest rereads remain mandatory.
- Exact-version embedding-schema, vector-index-definition, and retrieval-policy registries already use `getExact()` and detached immutable outputs.
- RAG drafting preserves separate authoritative-registry and untrusted-retrieved-context envelopes and only permits PLATFORM_KNOWLEDGE.
- `RAG_TEMPLATE_DRAFTING_ENABLED` exists, defaults OFF, and currently gates multiple concerns.
- Existing LLM traces are metadata-oriented and include template drafting, but their closed tasks/statuses do not provide durable embedding, index-publication, or retrieval operational records.
- Configuration currently uses `dotenv`, direct `process.env` access in bootstrap/configuration, constructor injection in the new AI/RAG services, and some shared service instances elsewhere.
- Runtime dependencies include Groq for an existing LLM path and MongoDB/Mongoose, but no production adapter for the B1/B2 ports and no embedding or vector-store SDK.

### Mandatory gaps

The repository has no production structured-generation adapter, production embedding adapter, production vector adapter, production adapter registration, class-separated provider configuration or secrets, durable index-publication authority, embedding-job orchestrator, durable retrieval trace, production tokenizer, immutable production evaluation repository, cost budgets, class-specific rate/concurrency controls, bounded provider fallback policy, circuit breakers, AI/RAG alerts, provider-class health/readiness, deprecation monitor, approved data-residency choice, AI incident runbook implementation, index rebuild orchestrator, or orphan reconciliation. These are implementation gaps; this ADR does not fill them silently.

## Provider research

Research was performed against first-party documentation available on the ADR date. Commercial terms, account-specific limits, regional availability, and retention eligibility must be reconfirmed during procurement and staging.

### Structured generation

| Provider | Documented capabilities and constraints | YUDIJI assessment |
| --- | --- | --- |
| OpenAI | The Responses API supports JSON-schema structured outputs, streaming, usage reporting, rate-limit headers, and dated model snapshots. API data is not used to train models by default; abuse-monitoring logs are normally retained up to 30 days, with eligible Zero Data Retention or Modified Abuse Monitoring controls. Some endpoint/state features are not ZDR-compatible. Batch processing has a separate asynchronous window and pricing. See [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs), [rate limits](https://platform.openai.com/docs/guides/rate-limits), [Batch API](https://platform.openai.com/docs/guides/batch), and [data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint). | Strong first benchmark candidate. Exact snapshot availability, chosen endpoint state behavior, region, retention agreement, safety refusal mapping, request limits, latency, and schema success must be verified. |
| Anthropic | Claude APIs document structured outputs/tool use, streaming, token-counting/usage, rate and spend limits, batch processing, and model deprecations. API inputs and outputs are normally deleted within 30 days; approved enterprise ZDR arrangements have product-feature exceptions. See [structured outputs](https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs), [rate limits](https://docs.anthropic.com/en/api/rate-limits), [batch processing](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing), [model deprecations](https://docs.anthropic.com/en/docs/about-claude/model-deprecations), and [retention](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data). | Strong benchmark candidate. Exact regional processing, contractual ZDR coverage, refusal/content filtering, schema conformance, model identity, limits, latency, and cost remain account-specific gates. |
| Google Gemini | Gemini documents schema-constrained JSON output, function calling, streaming, usage metadata, safety settings, rate limits, batch operation, model lifecycle/release notes, and tiered pricing. See [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [function calling](https://ai.google.dev/gemini-api/docs/function-calling), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [pricing](https://ai.google.dev/gemini-api/docs/pricing), and [release notes](https://ai.google.dev/gemini-api/docs/changelog). | Strong benchmark candidate. The exact Vertex AI versus Gemini Developer API product, contractual data use/retention, region, stable model version, safety behavior, schema support, latency, and limits must be selected and reviewed explicitly. |

No provider documentation makes semantically identical output across model revisions a guarantee. Therefore a provider-reported model identity, request timestamp, adapter version, prompt/schema versions, and evaluation after provider-side change are mandatory whenever an immutable dated model snapshot is unavailable.

### Embeddings

| Option | Provider facts | Limitations and assessment |
| --- | --- | --- |
| OpenAI | `text-embedding-3-small` and `text-embedding-3-large` support shortened dimensions; endpoint usage/retention controls are documented. See [embeddings](https://platform.openai.com/docs/guides/embeddings) and [data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint). | Benchmark exact model, dimensions, input/batch limits, multilingual retrieval quality, price, region, retention, normalization, and lifecycle. Do not rely on an alias or undocumented replay equality. |
| Google | Gemini embedding models document task types, batching, usage metadata, multilingual support, configurable 128–3072 output dimensions, and model-specific token limits. Embedding spaces from different models are incompatible and require re-embedding. See [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings). | Benchmark exact model and task type. Disable silent truncation, freeze dimensions/normalization, and rebuild on model change. Privacy/product selection remains a gate. |
| Voyage AI | Voyage documents query/document input types, model-specific context lengths and dimensions, optional reduced dimensions for supported models, batching, and truncation behavior. See [text embeddings](https://docs.voyageai.com/docs/embeddings). | Benchmark domain quality, cost, region, retention, lifecycle, normalization, rate limits, and exact version semantics. Automatic truncation must be disabled. |
| Cohere | Embed v4 documents 256/512/1024/1536 dimensions, 128K context, multiple similarity metrics and multilingual coverage; the API accepts up to 96 inputs and supports an explicit no-truncation mode. Cohere publishes retirement notices. See [Embed models](https://docs.cohere.com/docs/cohere-embed), [Embed API](https://docs.cohere.com/v2/reference/embed), and [release notes](https://docs.cohere.com/v2/changelog). | Benchmark exact model/dimension/input type, retrieval quality, retention, region, cost, lifecycle, and normalization. Select `truncate=NONE`; published retirement history reinforces explicit migrations. |
| Self-hosted/open source | Hugging Face Text Embeddings Inference supports multiple embedding families, CPU/GPU images, batching-oriented serving, and documented hardware constraints. See [supported models and hardware](https://huggingface.co/docs/text-embeddings-inference/en/supported_models). | Deferred for initial rollout. It improves data control but transfers capacity, patching, model-license, security, availability, scaling, benchmarking, and lifecycle ownership to YUDIJI. A model ID, artifact digest, runtime/image version, tokenizer, precision, dimensions, normalization, and hardware profile would all require exact lineage. |

Embedding vectors are derived data, not guaranteed deterministic replay artifacts. Historical replay uses persisted immutable vectors and exact lineage; it does not call a provider again and assume bit equality.

### Vector stores

| Option | Provider facts | Limitations and assessment |
| --- | --- | --- |
| PostgreSQL + pgvector | pgvector supports exact nearest-neighbor search by default, approximate HNSW/IVFFlat indexes, metadata filtering through SQL, cosine/inner-product/L2 metrics, and Postgres operational tooling. Approximate indexes trade recall for speed; `vector` supports up to 2,000 dimensions and `halfvec` up to 4,000. See [pgvector](https://github.com/pgvector/pgvector). | Attractive for transactional publication and local development, but introduces PostgreSQL beside the current MongoDB stack. Benchmark filtering, scale, availability, backup/restore, encryption, region, operations, and tie ordering. |
| Qdrant | Qdrant supports named collections, dense/sparse vectors, payload filtering, custom sharding/multitenancy, snapshots, distributed replicas, and local/self-hosted operation. Approximate HNSW results can vary with search limits. See [data management](https://qdrant.tech/documentation/manage-data/), [multitenancy](https://qdrant.tech/documentation/tutorials/multiple-partitions/), [distributed deployment](https://qdrant.tech/documentation/scaling/distributed_deployment/), and [snapshots](https://qdrant.tech/documentation/operations/snapshots/). | Strong dedicated-store benchmark candidate. Cloud region/security/cost and self-hosted operational burden differ. YUDIJI still owns publication proof and deterministic tie-breaking. |
| Pinecone | Pinecone serverless uses exact namespaces for isolation, supports metadata filters, fixed index dimensions/metrics, imports/upserts, and backups. It documents eventual consistency after writes. See [indexing](https://docs.pinecone.io/guides/index-data/indexing-overview), [multitenancy](https://docs.pinecone.io/guides/index-data/implement-multitenancy), and [data freshness](https://docs.pinecone.io/guides/index-data/data-modeling). | Low infrastructure burden, but cost/region/backup plan and eventual consistency require validation. Publication cannot be inferred from an upsert response; readiness rereads and manifests remain required. |
| Weaviate | Weaviate documents vector and hybrid search, filters, multi-tenancy, replication, backups, and managed/self-hosted deployment. See [hybrid search](https://docs.weaviate.io/weaviate/search/hybrid), [multi-tenancy](https://docs.weaviate.io/weaviate/manage-collections/multi-tenancy), [replication](https://docs.weaviate.io/weaviate/concepts/replication-architecture), and [backups](https://docs.weaviate.io/weaviate/configuration/backups). | Feature-rich candidate with higher operational/configuration surface. Benchmark exact-vector mode, filtering, readiness, isolation, backup/restore, region, cost, local development, and deterministic tie handling. |
| MongoDB Atlas Vector Search | Atlas Vector Search supports ANN and ENN on documented MongoDB versions, pre-filtering, multiple similarity metrics, and hybrid vector/full-text search. See [Vector Search overview](https://www.mongodb.com/docs/atlas/atlas-vector-search/) and [vector search index fields](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/). | Operationally compatible benchmark lead because YUDIJI already uses MongoDB/Mongoose, but deployment tier/version, Atlas availability, indexing consistency, backup/restore, region, cost, local parity, isolation, and deterministic ties remain unverified. Existing MongoDB use is not approval. |

All options can return approximate candidates. YUDIJI applies canonical tie-breaking after bounded candidate retrieval and never treats vendor ranking, metadata, or successful writes as publication authority.

## Decision

### Independent provider classes and ports

The closed production provider classes are:

```text
GENERATION_PROVIDER
EMBEDDING_PROVIDER
VECTOR_INDEX_PROVIDER
```

Each class has independent adapter registration, exact identity/version, credential, limits, health, gate, metrics, rollout, fallback policy, and rollback. A vendor may occupy more than one class, but there is no global `AI_PROVIDER` switch and no permanent vendor dependency.

```text
TemplateDraftGenerationPort
  <- versioned generation adapter <- one exact provider/model

KnowledgeEmbeddingPort
  <- versioned embedding adapter <- one exact provider/model/schema

KnowledgeVectorIndexWritePort + KnowledgeVectorSearchPort
  <- versioned vector adapter <- one exact provider index/namespace
```

Adapters own request translation, one provider call, response translation, and closed provider-error mapping only. They do not validate domain authority, choose chunks/documents/schemas/indexes, persist domain objects, rerank, create citations, or activate templates. SDK types never cross the ports.

### Initial selections and benchmark gates

The approved initial selections are all **TBD, benchmark-gated**:

- Generation: benchmark OpenAI, Anthropic, and the explicitly chosen Google API product. OpenAI is the initial contract-test lead, not an approved production dependency.
- Embeddings: benchmark OpenAI, Google, Voyage, and Cohere against the exact YUDIJI golden retrieval set. Self-hosting is deferred. OpenAI is the initial contract-test lead only.
- Vector store: benchmark MongoDB Atlas Vector Search, Qdrant, pgvector, Pinecone, and Weaviate. Atlas is the operational-compatibility lead only.

Selection requires security/privacy and retention acceptance, an available exact or provider-reported model identity, schema/dimension compatibility, regional fit, contract tests, golden retrieval quality, structured-output quality, latency, availability, operability, migration/rebuild proof, and projected cost. Numeric thresholds remain TBD until staging produces evidence. Production rollout is blocked until one provider per required class passes and the decision is recorded without rewriting this ADR.

### Exact identity and configuration

Every generation call preserves provider ID, adapter version, exact model ID, model version or dated snapshot, provider-reported model identity, request timestamp, request-schema version, prompt ID/version, and candidate-schema version. Every embedding call additionally preserves embedding schema, projector, normalization, dimensions, metric assumptions, input digests, and correlation. Every vector operation preserves adapter version, provider index identity, exact index definition/schema/version, namespace, dimensions, metric, and publication identity.

`latest`, `default`, `recommended`, implicit version inference, and caller-selected arbitrary vendor/model names are prohibited. Exact registries remain authoritative. Provider configurations are immutable validated snapshots constructed at bootstrap; domain services receive ports, not environment values.

### Retries, timeouts, fallback, and errors

Initial execution is one exact provider and one exact model/index. No automatic cross-provider, cross-model, cross-index, or cross-region fallback exists.

- Generation may retry only classified transient transport, provider-unavailable, or rate-limit failures, using the same exact model and idempotent attempt identity. Invalid schema/content is not retried. Attempts and total deadline are bounded.
- Embeddings may retry classified transient failures with the same exact provider/model/schema and exact input correlation. Partial results are validated before any idempotent persistence.
- Vector writes use exact idempotent entry identities and bounded transient retries. Conflicts are not transient.
- Search may use a bounded transport retry against the same exact published index only.

Adapters map provider/SDK codes—not free-form message inspection—into this closed vocabulary:

```text
AUTHENTICATION_FAILED
PERMISSION_DENIED
RATE_LIMITED
TIMEOUT
NETWORK_FAILED
PROVIDER_UNAVAILABLE
CONTENT_REJECTED
EMPTY_RESPONSE
MALFORMED_RESPONSE
SCHEMA_VALIDATION_FAILED
INPUT_TOO_LARGE
MODEL_NOT_FOUND
MODEL_DEPRECATED
VECTOR_DIMENSION_MISMATCH
INDEX_NOT_FOUND
INDEX_NOT_READY
UNKNOWN_PROVIDER_FAILURE
```

Separate configurable budgets are required for generation request, embedding batch, vector write, vector search, end-to-end drafting, queue wait, cancellation, and retry exhaustion. SDK defaults cannot define product behavior. Exact values are TBD after load tests.

### Capacity and cost controls

Generation, embedding, indexing, and retrieval use separate bounded queues/semaphores and overload outcomes. Controls must cover per-user generation rate, global generation concurrency, embedding batch concurrency, indexing throughput, retrieval concurrency, queue length, and `retry-after` behavior. Fire-and-forget provider work is prohibited.

Budgets cover request input/output units, per-user/day generation, embedding tokens/characters and chunk counts, vector storage/writes/search, reranking, global daily spend, monthly alert threshold, and hard-disable threshold. Provider-neutral usage metadata is captured where available; absence is explicit. Raw content never enters cost telemetry.

### Secrets, privacy, and data classification

Credentials flow only through the existing configuration/secret boundary, with separate local, staging, and production secrets and preferably separate least-privilege keys per class. Rotation and revocation are required. Secrets never enter prompts, traces, databases, vector metadata, candidate lineage, source, fixtures, or errors.

Generation may receive the user drafting prompt, compact registry projection, bounded cited PLATFORM_KNOWLEDGE passages, schema instructions, and non-sensitive correlation IDs. Embeddings may receive approved platform chunk projections, bounded semantic metadata, and retrieval queries. A vector store receives vectors and bounded lineage metadata only; full text requires a future privacy decision. Credentials, unrelated user data, raw database objects, private documents, and market research are prohibited initially.

Vectors are potentially sensitive derived data. Encryption in transit/at rest, access control, exact namespaces, retention, backup/restore, auditability, deletion/rebuild, and an approved deployment region are mandatory. PLATFORM_KNOWLEDGE may use a shared system namespace. Private corpora remain prohibited pending independent tenant-isolation proof.

Provider-specific API retention, training use, abuse monitoring, ZDR eligibility/exceptions, enterprise controls, and regional processing must be recorded in the selection review and contract. Consumer-product terms are irrelevant. If the selected configuration does not satisfy YUDIJI classification, rollout remains blocked.

### Immutable publication and migration

Production indexing adds two append-only authorities in Track C-C:

```text
CorpusPublicationManifest
  = exact corpus + document versions + chunk-set manifests
    + effective time + canonical publication digest

IndexBuildAttempt
  -> IndexPublicationManifest
     = exact index definition + embedding schema
       + expected count + canonical entry identities/digest
       + provider index identity + publication time
```

Mutable status is rejected. Failed attempts remain attempts; a usable exact index has a separate immutable publication manifest after count, identity, and readiness verification. Retrieval must name an exact corpus publication and index publication. It never lists documents or indexes and chooses newest.

A model/index change creates a new embedding schema, explicit re-embedding job, immutable embeddings, index-definition version, build attempt, publication manifest, evaluation subject, and rollout. Existing artifacts are not overwritten. Rollback selects a prior exact publication. Orphan attempt/entry reconciliation and rebuild orchestration are required but deferred.

### Independent rollout controls

Future default-OFF controls are equivalent to:

```text
AI_TEMPLATE_GENERATION_ENABLED
PLATFORM_KNOWLEDGE_INGESTION_ENABLED
KNOWLEDGE_EMBEDDING_ENABLED
KNOWLEDGE_INDEXING_ENABLED
KNOWLEDGE_RETRIEVAL_ENABLED
RAG_TEMPLATE_DRAFTING_ENABLED
```

RAG drafting requires generation and retrieval. Retrieval requires exact published corpus and index manifests. Disabled behavior performs no downstream call: generation yields no candidate; embedding persists nothing; indexing writes nothing; retrieval performs no embedding/vector/lexical search; disabled RAG never retrieves. Registry-only drafting may run only under its separate generation control. This ADR does not implement these controls.

Rollout environments are `LOCAL_TEST`, `CI_DETERMINISTIC`, `DEVELOPMENT`, `STAGING`, `INTERNAL_PRODUCTION`, `LIMITED_PRODUCTION`, and `GENERAL_PRODUCTION`. CI never uses production credentials.

```text
0 deterministic fakes/golden baseline
1 live provider adapter contract tests, no user traffic
2 offline PLATFORM_KNOWLEDGE indexing
3 shadow retrieval, context not injected
4 shadow RAG generation, neither exposed nor persisted
5 allowlisted internal users, USER/DRAFT only
6 limited allowlist/percentage, USER/DRAFT only
7 broader rollout after all gates
```

Gates measure adapter contracts, schema success, errors, p50/p95/p99 latency, embedding/write success, retrieval latency and golden precision/recall, citation validity, unsupported-concept retention, invented factors, prohibited weights, registry-conflict acceptance, prompt-injection overrides, cost/request, projected monthly cost, and critical leaks. Thresholds are versioned and TBD until staging. Each exact prompt + generation model + embedding model + index publication + retrieval policy combination is a separate immutable evaluation subject.

Shadow comparison records registry-only versus RAG differences in bindings, unresolved concepts, citations, contradictions, latency, cost, and later user edits/acceptance. Shadow results never persist templates.

### Observability, health, and incidents

Future durable operational records contain metadata only:

- generation identities, sizes, status, latency, usage/cost, retries, failure code;
- embedding batch/schema identities, counts, dimensions, latency/cost and outcome counts;
- index/build/publication identities, counts, failures and latency;
- retrieval corpus/index/schema/policy identities, candidate/selection/citation counts, latency, fallback and no-context counts.

Raw prompts, documents, passages, vectors, embeddings, URLs, secrets, and private metadata are excluded from routine traces. Existing LLM tracing may be extended only in an implementation phase with an explicit migration.

Generation health, embedding health, vector-write health, and vector-search health are independent. Optional AI failure does not fail core application readiness or legacy scoring. RAG returns typed unavailable outcomes. Bounded per-class circuit breakers may stop calls but cannot switch providers, fabricate output, or activate anything.

Required roles are AI provider owner, RAG platform owner, security/privacy owner, cost owner, on-call owner, evaluation owner, and corpus-publication approver. Named people are assigned operationally, not invented here.

Deprecation monitoring identifies affected model/schema/prompt/index subjects, creates new immutable versions, reruns staging evaluation, and performs explicit migration. If no approved exact model remains, that provider class is disabled.

Incidents support independent disablement and key revocation. Generation privacy incidents preserve metadata-only request IDs; embedding incidents identify exact affected chunk/schema versions and retention exposure; vector isolation incidents disable reads/writes, quarantine exact publications, revoke credentials, and rebuild from immutable embeddings when safe. Core scoring remains available.

### Initial production scope and rollback

Only PLATFORM_KNOWLEDGE, internal/allowlisted template drafting, and USER/DRAFT output are authorized. Market research, private documents, financial extraction, Evidence creation, ACTIVE template creation, automatic compilation, ScoreCheck execution, trading recommendations, and autonomous decisions are not authorized.

Generation, embedding jobs, indexing, retrieval, and RAG drafting can each be disabled independently. Rollback preserves immutable documents, chunks, manifests, embeddings, definitions, evaluations, and existing USER/DRAFT templates. It never automatically deletes historical artifacts. Legacy scoring and compiled execution defaults are unaffected.

## Security and activation gates

Before production activation, the implementation must pass secret-management, retention/privacy, prompt-injection, citation-integrity, dependency/supply-chain, vector isolation, logging/privacy, denial-of-wallet, rate-limit, and abuse reviews. Private corpora require a separate tenant-isolation review.

Provider SDKs may be introduced only in narrow adapter phases after maintenance, license, transitive dependency, security history, Node/TypeScript support, and runtime impact review. Official SDKs are preferred where suitable, but a narrow REST adapter is permitted when authentication, retry, timeout, and parsing remain explicit.

The current character budget remains conservative. A future exact tokenizer/provider estimator has an identity/version. Until then adapters reject provider-limit violations and record truncation/rejection; they never silently truncate citation passages.

## Alternatives considered

| Alternative | Outcome |
| --- | --- |
| One provider for generation, embeddings, and vectors | Rejected as an architectural coupling; commercial consolidation may still win three independent selections. |
| Independent providers/classes | Accepted for portability, isolation, and separate rollback. |
| Immediate automatic provider fallback | Rejected because output, safety, embedding space, retention, and replay semantics differ. |
| One exact provider/model with typed failure | Accepted initially. |
| `latest`/marketing aliases | Rejected as mutable lineage. |
| Exact model/version identity | Accepted; provider-reported identity/change evaluation is required where snapshots are unavailable. |
| Mutable embeddings/index records | Rejected. |
| Immutable derived artifacts and publications | Accepted. |
| One global AI flag | Rejected because it prevents safe independent operations and rollback. |
| Independent rollout controls | Accepted conceptually; implementation deferred. |
| Direct production activation | Rejected. |
| Shadow and staged activation | Accepted. |
| SDK types in domain contracts | Rejected. |
| Provider-neutral adapters | Accepted. |
| Trust vendor search results directly | Rejected. |
| Exact YUDIJI rereads | Accepted. |
| Raw operational logging | Rejected. |
| Metadata-only observability | Accepted. |
| Private documents initially | Rejected pending tenant/privacy proof. |
| PLATFORM_KNOWLEDGE only | Accepted initially. |
| Live primary plus automatic backup | Rejected initially. |
| Live exact provider with no silent fallback | Accepted. |
| Self-hosted embeddings on day one | Deferred pending operations, license, security, and quality evaluation. |
| Managed embeddings first | Preferred benchmark direction, not a vendor selection. |
| pgvector beside MongoDB | Deferred to benchmark; transactional strengths versus a second datastore. |
| Dedicated vector database | Deferred to benchmark; capabilities versus operational surface. |
| Atlas Vector Search | Benchmark lead due current MongoDB use, not approved by familiarity. |
| Corpus/index selection by latest | Rejected. |
| Immutable publication manifests | Accepted. |

## Consequences

Production integration becomes deliberately incremental and reversible. More operational contracts must be implemented before live traffic, and vendor selection takes benchmark effort. In return, provider failures and migrations cannot silently change authority, provenance, retrieval scope, or core scoring.

No provider adapter, SDK, environment variable, configuration, feature flag, runtime registration, network call, schema, persistence change, or activation is introduced by this ADR.

## Future implementation sequence

```text
C-B1 — Production Structured-Generation Adapter
C-B2 — Production Embedding Adapter
C-B3 — Production Vector-Store Adapter
C-C  — Corpus and Index Publication Authorities
C-D  — Runtime Configuration, Secrets and Independent Feature Flags
C-E  — Staging Integration and Provider Contract Tests
C-F  — Shadow Retrieval and RAG Rollout
C-G  — Internal/Limited Production Activation
```

Each phase remains separately reviewable. Track C-B1 is next and must resolve its provider benchmark gate before production adapter approval.
