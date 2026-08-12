# ADR-063: Vector Index Publication Uses Immutable Provider Projections Separate from Canonical Embeddings

Status: ACCEPTED

Date: 2026-08-08

Phase: Track C-B3A

## Context

ADR-060, ADR-061, ADR-062, Tracks B2-BC through B2-FG, and Track C-B2B establish immutable platform-knowledge documents, chunks, complete chunk-set manifests, canonical embeddings, exact vector-index definitions, provider-neutral vector write and search ports, untrusted search candidates, exact authority rereads, and application-owned deterministic hybrid ranking.

Track C-B3 stopped correctly during its mandatory audit. The canonical `KnowledgeEmbedding` record preserves embedding identity and version, provider and model lineage, embedding schema, normalization strategy, purpose, document/chunk-set/chunk lineage, corpus, trust level, canonical normalized vector, vector digest, and immutable creation time. It intentionally contains no vector-index publication identity.

`KnowledgeVectorIndexWritePort` receives a different artifact: a caller-supplied index-entry identity/version, exact vector-index definition identity/version, namespace, index schema, canonical vector and digest, source lineage, and bounded searchable metadata. Its result contract must distinguish an exact duplicate from the same index-entry identity carrying different material.

One canonical embedding may be published into different providers, definitions, index versions, namespaces, metadata-schema versions, and development or production publication targets. Therefore embedding identity is not vector-index publication identity. Adding publication fields to `KnowledgeEmbedding` would couple two authorities with different identities, lifecycles, rebuild rules, and failure behavior.

Atlas candidates remain untrusted. Existing retrieval is responsible for exact document, manifest, chunk, and embedding rereads; lineage and digest validation; deterministic reranking; and citation assembly. A provider projection must preserve, not replace, that boundary.

## Decision

### Separate immutable authorities

`KnowledgeEmbedding` remains the canonical embedding authority and answers:

```text
What canonical vector did YUDIJI create?
```

A new provider-neutral immutable vector-index projection authority answers:

```text
Which exact canonical embedding was published into which exact
vector-index definition and namespace?
```

Neither authority replaces the other. The projection is a publication artifact, not a new embedding, cache, search result, mutable index status, Atlas publication manifest, or independent source of vector truth.

### Projection identity and publication uniqueness

The existing exact entry identity remains authoritative:

```ts
type KnowledgeVectorIndexEntryIdentity = Readonly<{
  indexEntryId: string;
  indexEntryVersion: number;
}>;
```

The identity is caller supplied or deterministically assigned by an approved caller. The projection repository cannot generate a random or timestamp-derived identity, infer identity from MongoDB `_id`, or equate it implicitly with embedding identity.

Two uniqueness boundaries apply:

```text
indexEntryId + indexEntryVersion
```

and:

```text
indexId + indexVersion + namespace + embeddingId + embeddingVersion
```

The second boundary prevents one exact embedding publication target from being represented under multiple entry identities. A different index version or namespace is a different publication.

### Projection lineage

The provider-neutral projection preserves repository-native equivalents of:

- index-entry identity/version;
- vector-index definition identity/version;
- namespace and metadata-schema identity/version;
- embedding identity/version and embedding-schema identity/version;
- purpose `RETRIEVAL_DOCUMENT`;
- normalization-strategy identity/version;
- exact dimension and `COSINE` similarity;
- canonical vector and vector digest;
- document, chunk-set, and chunk identity/version;
- exact chunk digest;
- `PLATFORM_KNOWLEDGE` corpus and approved trust level;
- bounded searchable metadata;
- projection digest and immutable creation time.

The canonical normalized vector is duplicated only because the provider-searchable record must expose it to the vector index. `KnowledgeEmbedding` remains authoritative. Before projection creation, `KnowledgeVectorIndexingService` rereads and validates the exact embedding, schema, purpose, normalization, dimension, vector digest, manifest, document, chunk, corpus, trust, and source lineage.

### Bounded searchable metadata

Searchable metadata is an immutable projection derived from exact document and chunk authorities under one exact metadata-schema version. The initial platform-knowledge scope permits only fields already represented by current contracts and retrieval filters:

- document identity/version and document type;
- chunk identity/version and chunk type;
- corpus and trust;
- embedding schema and exact index identity;
- factor keys, relationship types, subject types, and topics;
- document effective-from and effective-until when present.

Unknown fields fail closed. The projection excludes raw document/chunk text, source URIs, credentials, prompts, private owner or tenant data, and market-research content. Existing contracts do not authorize invented tenant fields.

### Canonical projection digest

Each projection has a canonical SHA-256 digest over semantic publication material: entry, index, namespace, metadata schema, embedding, embedding schema, purpose, normalization, dimension, similarity, vector digest, document/chunk-set/chunk lineage, corpus, trust, and bounded searchable metadata.

The digest excludes database and Atlas internal IDs, `createdAt`, request IDs, attempts, latency, credentials, and raw source text. It does not replace the canonical `vectorDigest`.

### Synchronization ownership

`KnowledgeVectorIndexingService`, acting through `KnowledgeVectorIndexWritePort`, is the sole initial projection creator:

```text
exact embedding and source-authority rereads
-> vector-index compatibility validation
-> exact immutable projection command
-> provider projection repository/write adapter
```

Mongoose hooks, embedding-repository hooks, application bootstrap, Atlas triggers, search requests, controller writes, and unapproved background polling cannot create projections. Canonical embedding persistence performs no silent dual write. Projection failure returns a typed indexing failure and cannot mutate, delete, invalidate, or regenerate the embedding or its source authorities.

### Append-only persistence and conflicts

The projection authority permits exact insert, exact identity read, exact publication-target read where required, and exact duplicate detection. It provides no update, replace, upsert, delete, latest, highest-version, recency selection, mutable indexed flag, or automatic supersession.

Closed repository outcomes are:

```text
CREATED
ALREADY_EXISTS
CONFLICT
INVARIANT_VIOLATION
PERSISTENCE_FAILED
```

`ALREADY_EXISTS` requires equality of all canonical material. The same identity with a different embedding, index, namespace, vector digest, or metadata is `CONFLICT`. A duplicate-key race must reread exact records and classify deterministically. A new publication requires a new exact projection identity/version.

### Provider and Atlas boundary

The preferred layering is:

```text
KnowledgeVectorIndexProjection
-> provider-neutral immutable authority
-> MongoDB Atlas write/search adapter
-> exact Atlas vector index
```

The projection collection may itself be the Atlas-indexed collection, avoiding a third vector copy. Its domain contract remains provider neutral; Atlas aggregation stages, index names, driver types, and provider failure translation remain adapter concerns.

Search results correlate through entry identity/version and preserve embedding, document, chunk, index, vector-digest, provider-score, and provider-ordinal lineage. Atlas `_id` may implement deterministic storage correlation but does not become public authority implicitly.

A persisted projection does not prove that an Atlas index is built, queryable, complete, or approved. C-B3C may prove guarded development queryability. C-C owns durable corpus and index-publication manifests. Operational attempts or states such as pending, indexed, failed, or deleted require separate future append-only records and cannot mutate projections.

### Rebuild and migration

A new index version is built from existing immutable embeddings:

```text
existing canonical embedding
-> new exact projection identity
-> new exact index definition/version
-> provider indexing
-> separate publication proof
```

No re-embedding is required when the embedding schema and canonical vector are unchanged and only the index definition or metadata projection changes. A model, schema, dimension, or normalization change requires a new canonical embedding. Old projections are never rewritten.

Development cleanup uses an isolated disposable database or explicit administration outside domain repositories. Repository delete methods are not authorized for benchmark convenience.

## Consequences

- Canonical embedding persistence remains provider neutral and unchanged.
- Exact multi-index publication becomes representable without inferring publication identity.
- Deliberate vector duplication increases storage but preserves authority separation and enables provider indexing.
- Index publication can be rebuilt from immutable embeddings and exact source authorities.
- Projection persistence failures are isolated from embedding generation and source records.
- C-B3B must implement the projection types, model, append-only repository, validation, digest, indexing-service integration, and characterization tests before Atlas adapters.
- C-B3C must implement Atlas specification, write/search adapters, guarded administration, and development validation separately.
- C-C remains responsible for durable publication manifests.

## Alternatives considered

- **Use the canonical embedding collection directly:** rejected because it cannot preserve exact publication identity or multi-index publication without coupling authorities.
- **Add index fields to `KnowledgeEmbedding`:** rejected because embedding and publication have different identities, lifecycles, failure behavior, and rebuild rules.
- **Infer entry identity from embedding identity:** rejected because one embedding may be published to multiple exact targets.
- **Silent dual write during embedding creation:** rejected because publication failure must not affect canonical embedding creation.
- **Mongoose post-save hook:** rejected because it hides orchestration, failure, and retry ownership.
- **Provider-specific projection collection:** accepted as a possible storage implementation but not as the preferred domain contract.
- **Provider-neutral immutable projection collection indexed by Atlas:** accepted because it preserves portability and avoids an unnecessary third copy.
- **Mutable indexed status on the projection:** rejected because operational state and publication proof are separate authorities.
- **Upsert:** rejected because changed material must be reported as a conflict.
- **Delete and recreate during rebuild:** rejected for the domain authority; explicit development administration remains separate.
- **Implement a full publication manifest now:** deferred to C-C.

## Migration and rollback

C-B3B adds a new unactivated, append-only projection authority beside canonical embeddings. Existing embedding records and repositories require no schema rewrite. Initial projections are created only by explicit indexing requests after all exact rereads pass.

Rollback before activation removes the unregistered projection implementation and development records without changing canonical embeddings. After a projection has participated in an approved publication, rollback preserves its immutable history and deactivates through a future publication authority rather than mutation or deletion.

## Related artifacts

- ADR-060: RAG uses versioned document corpora and immutable citation-bearing chunks
- ADR-061: Production AI and RAG providers use versioned adapters, independent rollout controls and evaluation-gated activation
- ADR-062: Embedding requests carry explicit purpose and versioned normalization is a provider-neutral authority
- Track B2-DE1: Embedding authority, repository, and versioned vector-index authority
- Track B2-DE2: Bounded retrieval, hybrid search, reranking, and citation validation
- Track C-B3 mandatory stop audit
- Next: Track C-B3B — Immutable Vector Projection Authority Implementation
