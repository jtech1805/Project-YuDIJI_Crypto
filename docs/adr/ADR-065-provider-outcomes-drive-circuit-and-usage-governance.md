# ADR-065: Provider Outcomes Drive Circuit and Usage Governance

Status: ACCEPTED

Date: 2026-08-11

Phase: Track C-E1A0

## Context

The governed C-D runtime checks independent generation, embedding, and vector circuits, but provider-facing adapters previously collapsed or discarded exact provider outcomes before application governance could attribute health or usage. Best-effort diagnostics cannot be execution authority. Governed registry-only baseline plus RAG execution also requires two generation stages to share one generation circuit while retaining stage identity.

## Decision

Provider-facing results are additively enriched with immutable, metadata-only execution outcomes. The closed provider classes remain GENERATION_PROVIDER, EMBEDDING_PROVIDER, and VECTOR_INDEX_PROVIDER. Stages distinguish BASELINE_GENERATION, QUERY_EMBEDDING, VECTOR_RETRIEVAL, and RAG_GENERATION.

Failures preserve a normalized closed code without raw requests, responses, vectors, prompts, pipelines, credentials, or errors. Successful transport execution is explicit and remains success even when later schema, registry, citation, or authority validation fails.

Adapters translate provider I/O but do not mutate circuit state or decide health policy. A single stage-orchestration observer projects exact outcomes through the versioned circuit policy. REQUEST_TIMEOUT, NETWORK_FAILED, and PROVIDER_UNAVAILABLE are currently circuit eligible. Caller cancellation and application validation are not. Successful provider execution resets its exact provider-class circuit, including a successful half-open probe.

The runtime deadline remains distinct from provider-attempt timeout. Caller or runtime cancellation does not penalize provider health. Existing standalone C-D callers remain compatible; provider outcome fields and observation parameters are additive.

Provider usage is metadata-only and stage-bearing. Known values include provider and generation calls, embedding inputs, and provider-reported generation tokens. Missing values remain absent rather than zero. No adapter hardcodes pricing; estimated cost remains unknown without a separate pricing authority.

Budget admission remains `reserve`. Post-execution usage recording is a separate additive authority and cannot create another request reservation or rewrite provider execution success when recording fails. The initial implementation is process-local.

## Consequences

- Governed baseline and RAG execution can share provider circuits without relying on diagnostics.
- Provider success can close half-open circuits before downstream deterministic validation.
- Actual known usage can be reconciled independently of one-request admission.
- Distributed usage persistence, pricing authority, and dual-path execution remain future work.
