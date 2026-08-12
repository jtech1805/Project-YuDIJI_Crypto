# ADR-062: Embedding Requests Carry Explicit Purpose and Versioned Normalization Is a Provider-Neutral Authority

Status: ACCEPTED

Date: 2026-08-06

Phase: Track C-B2A

## Context

ADR-060, ADR-061, and Tracks B2-BC through B2-FG establish immutable knowledge documents and chunks, complete manifest verification, exact embedding schemas, provider-neutral embedding and vector ports, immutable embedding persistence, deterministic vector digests, and bounded retrieval. Track C-B2 correctly stopped before implementing Gemini embeddings because two semantics required by the selected model are not authoritative in the current contracts.

`KnowledgeEmbeddingProviderRequest` carries request, schema, provider, model, input, chunk, text, and digest correlation, but no embedding purpose. `KnowledgeEmbeddingService` uses the port for persisted chunk embeddings, while `KnowledgeRetrievalService` uses it for a transient retrieval query. Identifiers such as `RETRIEVAL_QUERY` and `TRANSIENT_QUERY` are correlation data, not semantic authority, and an adapter must not infer provider task type from them.

Embedding schemas preserve `normalizationStrategyId` and `normalizationStrategyVersion`, but no normalization definition authority, exact registry, executable service, arithmetic, zero-magnitude behavior, output validation, floating-point tolerance, or provider-versus-canonical vector policy exists. The only concrete identity is test-owned `TEST_NO_NORMALIZATION` version 1. It is not a production Gemini policy. The initial `gemini-embedding-001` selection uses 768-dimensional cosine vectors, for which explicit canonical normalization is required.

`KnowledgeEmbeddingPort` remains the correct provider boundary. Provider adapters translate and validate provider I/O only. Manifest verification, text projection, normalization, persistence, indexing, search, and retrieval remain outside the adapter.

## Decision

### Explicit request-level purpose

Add the closed provider-neutral vocabulary:

```ts
type KnowledgeEmbeddingPurpose =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";
```

Every `KnowledgeEmbeddingProviderRequest` contains one mandatory `purpose`. There is no default. One provider request cannot mix purposes; a future mixed-purpose batch requires a new contract version.

The caller owns purpose:

```text
KnowledgeEmbeddingService -> RETRIEVAL_DOCUMENT
KnowledgeRetrievalService -> RETRIEVAL_QUERY
```

An adapter validates and translates this value but never decides it. It cannot infer purpose from input ID, chunk ID, text, caller identity, request shape, schema ID, or stack context. Provider adapters map the two values to the provider's exact documented task vocabulary. Unsupported combinations fail closed.

Embedding schemas declare a non-empty, unique `allowedPurposes` collection. The request purpose must be allowed by the exact schema. The initial Gemini platform-knowledge schema allows both purposes. Equal dimensions or model identity cannot imply purpose compatibility.

Persisted knowledge embeddings record `RETRIEVAL_DOCUMENT`; query vectors remain transient and are not stored in the immutable knowledge-embedding repository. Purpose participates in semantic lineage and canonical vector-digest material. A purpose change creates a different artifact or a lineage conflict. Existing deterministic provider fakes preserve and expose the supplied purpose.

### Provider vector and canonical vector

The provider returns a raw provider vector. The authoritative downstream vector is produced after exact normalization:

```text
provider response
-> strict raw-vector validation
-> exact normalization strategy
-> canonical normalized vector
-> canonical vector digest
-> persistence or transient retrieval use
```

The provider adapter does not normalize. Raw provider vectors are transient: they are validated, normalized, then discarded. They are not persisted, traced, separately indexed, or included in the canonical digest. A future raw-vector retention policy requires another ADR.

### Versioned normalization authority

Introduce an immutable provider-neutral definition equivalent to:

```ts
type KnowledgeEmbeddingNormalizationDefinition = Readonly<{
  normalizationStrategyId: string;
  normalizationStrategyVersion: number;
  algorithm: "NONE" | "L2_UNIT_VECTOR";
  inputDimension: number;
  zeroMagnitudeBehavior: "FAIL";
  numericPolicy: Readonly<{
    requireFiniteInput: true;
    requireFiniteOutput: true;
    rounding: "NONE";
    clamping: "NONE";
  }>;
  validationPolicy: Readonly<{
    unitMagnitudeTolerance: number;
  }>;
}>;
```

An exact immutable registry provides ID/version registration, `getExact`, duplicate and conflicting-duplicate rejection, deterministic listing, and detached frozen definitions. It provides no latest or highest-version selection. Every embedding schema resolves one exact definition. Schema validation requires equal normalization input and vector dimensions, allowed purpose, and compatible metric/normalization semantics.

The initial production-shaped strategy is:

```text
normalizationStrategyId: L2_UNIT_VECTOR
normalizationStrategyVersion: 1
algorithm: L2_UNIT_VECTOR
inputDimension: 768
zeroMagnitudeBehavior: FAIL
rounding: NONE
clamping: NONE
```

It applies equally to `RETRIEVAL_DOCUMENT` and `RETRIEVAL_QUERY` for `gemini-embedding-001`, output dimension 768, and `COSINE`. Production schemas cannot reference test-only strategies.

### Exact L2 arithmetic

For input `v = [v1, ..., vn]`, calculate:

```text
magnitude = sqrt(sum(value * value))
normalized[i] = input[i] / magnitude
```

The input length must equal the exact definition dimension. Every input, multiplication, accumulated sum, magnitude, and output must be finite. Magnitude must be greater than zero. Output dimension is unchanged. There is no rounding, clamping, epsilon substitution, zero-vector replacement, or fallback to the raw vector.

Output validation recomputes L2 magnitude and accepts only:

```text
abs(normalizedMagnitude - 1) <= unitMagnitudeTolerance
```

The exact tolerance is a bounded implementation parameter that C-B2B must select through focused JavaScript-number characterization before registering `L2_UNIT_VECTOR` version 1. It validates floating-point arithmetic only and cannot compare semantic similarity.

### Provider-neutral normalization service

`KnowledgeEmbeddingNormalizationService` resolves an exact strategy, validates input, executes `NONE` or `L2_UNIT_VECTOR`, validates output, and returns a detached immutable result with metadata-only diagnostics. It does not call providers, choose schemas, persist embeddings, calculate similarity, write indexes, or retrieve content.

`NONE` remains versioned for deterministic tests or provider vectors proven canonical under an approved schema. It validates dimension, finite input/output, and immutability. It is never a default and is invalid for a model/schema requiring explicit normalization.

### Canonical digest and orchestration

The persisted `vectorDigest` covers the canonical normalized vector, purpose, exact normalization identity/version, and all existing embedding/chunk lineage. It does not cover or retain the raw provider vector.

Persisted path:

```text
manifest verification
-> embedding-text projection
-> provider request with RETRIEVAL_DOCUMENT
-> raw-vector validation
-> exact L2 normalization
-> canonical digest
-> immutable persistence
```

Query path:

```text
query-text projection
-> provider request with RETRIEVAL_QUERY
-> raw-vector validation
-> exact L2 normalization
-> transient canonical query vector
-> exact vector search
```

Document and query vectors compared in one index use the same exact schema and normalization strategy.

### Closed failures

The provider-neutral normalization boundary uses repository-conventional equivalents of:

```text
NORMALIZATION_STRATEGY_NOT_FOUND
PURPOSE_NOT_ALLOWED
PURPOSE_MISMATCH
VECTOR_DIMENSION_MISMATCH
VECTOR_CONTAINS_NON_FINITE_VALUE
VECTOR_MAGNITUDE_NON_FINITE
VECTOR_MAGNITUDE_ZERO
NORMALIZED_VECTOR_NON_FINITE
NORMALIZED_MAGNITUDE_OUT_OF_TOLERANCE
NORMALIZATION_INVARIANT_VIOLATION
```

No failure permits an unnormalized vector or different strategy fallback.

## Consequences

- Provider task semantics become explicit, testable, and independent of correlation naming.
- Document and query embeddings enter cosine comparison through identical canonical arithmetic.
- Raw provider output remains transport data; normalized output becomes the single persisted/search vector.
- Schema, purpose, normalization, vector, and digest lineage remain exact and replayable without calling a provider again.
- Existing callers, deterministic fixtures, schemas, digest tests, and services require an intentional compile-time update in C-B2B.
- No production records or indexes require migration because production Gemini embeddings do not yet exist.
- Any external development vectors produced under an older schema remain historical and cannot be reinterpreted silently.

## Alternatives considered

- **Infer purpose from input or chunk ID:** rejected because correlation identifiers are not semantic authority.
- **Infer from text, caller, request shape, schema, or stack:** rejected because it is implicit and provider-coupled.
- **Use one generic retrieval purpose:** rejected because providers distinguish query and document tasks.
- **Purpose per input:** deferred; the initial provider call owns one task type and mixed batches create ambiguity.
- **Request-level purpose:** accepted for deterministic homogeneous batches.
- **Normalize inside the Gemini adapter:** rejected because normalization belongs to schema semantics, not transport.
- **Normalize inside persistence:** rejected because transient query vectors require identical semantics.
- **Provider-neutral versioned service:** accepted.
- **Persist raw and normalized vectors:** deferred due to storage, lineage, and privacy cost.
- **Persist normalized vector only:** accepted.
- **Use `TEST_NO_NORMALIZATION`:** rejected for production Gemini 768-dimensional vectors.
- **Use dimension 3072 to avoid normalization:** deferred; the approved initial dimension is 768.
- **Add epsilon or replace zero vectors:** rejected because it fabricates direction.
- **Round or clamp output:** rejected because it changes vector and digest semantics.

## Migration and rollback

C-B2B updates the request contract, both callers, embedding schema definitions, persisted purpose lineage, digest material, deterministic providers, fixtures, and tests explicitly. No compatibility shim may infer purpose. It adds normalization types, exact registry, characterized tolerance, service, and schema compatibility validation.

Rollback removes the unactivated contract implementation and its test-only definitions before provider activation. It does not rewrite persisted production data or rebuild an index because none exists. Existing historical development artifacts retain their original schema lineage and are not converted implicitly.

C-B2C may implement the Gemini embedding adapter and guarded live validation only after C-B2B passes independently.

## Related artifacts

- ADR-060: RAG uses versioned document corpora and immutable citation-bearing chunks
- ADR-061: Production AI and RAG providers use versioned adapters, independent rollout controls and evaluation-gated activation
- Track B2-DE1: Embedding authority, repository, and versioned vector-index authority
- Track B2-DE2: Bounded retrieval, hybrid search, reranking, and citation validation
- Track C-B2 mandatory stop audit
- Next: Track C-B2B — Embedding Purpose and Normalization Foundation Implementation
