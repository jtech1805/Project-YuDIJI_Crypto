# ADR-060: RAG Uses Versioned Document Corpora and Immutable Citation-Bearing Chunks

Status: ACCEPTED

Date: 2026-08-05

Phase: Track B2-A

## Context

Track B1 established registry-grounded, schema-validated template drafting with deterministic validation, explicit authenticated acceptance, and safe USER/DRAFT persistence. The compact registry projection remains the exact authority for factors, versions, relationships, subjects, units, provider capabilities, compilation mappings, and validation constraints.

The repository currently has no document admission authority, document or chunk model, parser registry, embedding authority, vector index, lexical retrieval, reranker, citation contract, context assembler, retrieval evaluation harness, or RAG orchestration. Existing reusable foundations are exact versioned authorities, append-only repository patterns, canonical digests, immutable detached outputs, owner-scoped persistence, provider-neutral LLM invocation, metadata-only LLM tracing, and the default-OFF `RAG_TEMPLATE_DRAFTING_ENABLED` flag.

RAG is useful for explanatory platform knowledge and source-bearing research, but probabilistic retrieval cannot become a registry, Evidence, scoring, compilation, or activation authority. Platform guidance, market claims, and private user content also have different trust, temporal, and ownership rules and therefore cannot share an implicit search boundary.

## Decision

### Authority boundary

RAG supplies bounded explanatory context and exact source citations. It does not register factors, approve relationships, validate units, create provider authority, create Evidence, calculate scores, compile or activate templates, or override exact registries. Retrieved text is data, not instruction or authority.

The B1 generation boundary will eventually receive two separate envelopes:

```text
exact immutable registry projection
  +
citation-bearing explanatory RAG context
  -> structured candidate
  -> schema validation
  -> deterministic authority validation
```

When retrieved text contradicts an exact registry, the registry wins and the future workflow records a contradiction diagnostic.

### Separate corpus classes

The architecture defines three disjoint logical corpus classes:

- `PLATFORM_KNOWLEDGE`: administratively approved YUDIJI factor, relationship, subject, unit, evaluator, validation, ADR-summary, template-example, negative-example, and product-help material.
- `MARKET_RESEARCH`: filings, results, annual reports, presentations, transcripts, approved broker or sector research, regulatory notices, and attributable news/event sources.
- `USER_PRIVATE_DOCUMENTS`: user- or tenant-owned uploads with mandatory authenticated namespace isolation.

No request searches across corpus, trust, owner, or tenant boundaries implicitly. Platform knowledge explains how the product works. Market research contains attributed claims about markets and entities. Platform documentation is not current market Evidence, and market research cannot establish a factor or relationship identity. Private material never becomes platform knowledge without explicit administrative admission.

### Immutable document-version authority

A future immutable `KnowledgeDocumentVersion` authority will preserve semantic equivalents of:

```text
documentId + documentVersion
corpus + documentType + title
ownerType + exact owner/tenant identity where applicable
sourceType + sourceIdentity + optional source URI
trustLevel
effectiveFrom/effectiveUntil where applicable
contentDigest
parserId + parserVersion
superseded document identity when applicable
```

Document identity is not a mutable URL or title. Each content revision creates a new append-only version with an exact digest, source, ownership, trust, parser, and supersession lineage. Historical replay supplies exact document/corpus/index identities; it never silently substitutes a current or latest document.

### Explicit document admission

Documents enter a corpus only through a future explicit admission boundary. Admission validates corpus eligibility, authenticated ownership, document type, source identity, digest, bounded size, parser availability, trust classification, applicable effective dates, and duplicate/version conflicts.

Chat text is not automatically admitted to `PLATFORM_KNOWLEDGE`. Uploads default to their declared private ownership and cannot self-declare authoritative trust. Unsupported executable content, credentials, secrets, unsupported encryption, decompression bombs, malicious embedded instructions, and out-of-scope ownership are rejected or quarantined.

### Immutable chunk authority

A future immutable `KnowledgeChunk` authority will identify one exact projection of one exact document version and preserve semantic equivalents of:

```text
chunkId + chunkVersion
documentId + documentVersion
strategyId + strategyVersion
chunkType + ordinal
text + contentDigest
exact source span
optional parent identity
bounded structured metadata
inherited corpus, trust, owner and tenant scope
```

Source spans may include page range, section path, paragraph range, table/row identity, character offsets, transcript timestamp, or equivalent parser-supported coordinates. Chunk identity is stable for equivalent content, parser, and strategy inputs. Text is never mutated in place. A document, parser, or strategy revision produces new versioned projections.

### Document-specific chunking

One universal fixed-token chunker is rejected as the semantic authority. Independently versioned strategy families include `FACTOR_DOCUMENTATION`, `RELATIONSHIP_DOCUMENTATION`, `ADR_SUMMARY`, `TEMPLATE_EXAMPLE`, `VALIDATION_GUIDANCE`, `FINANCIAL_REPORT`, `BROKER_REPORT`, `EARNINGS_TRANSCRIPT`, `NEWS_ARTICLE`, and `REGULATORY_FILING`.

Token targets are configurable safety bounds owned by a strategy version, not global semantic rules. Approximate 250–600-token platform chunks and bounded overlap may be initial guidance. Overlap is identified and deduplicated so it cannot silently inflate relevance or citations.

Platform strategies preserve complete meanings and constraints:

- Factor documentation keeps identity, meaning, subject/value/unit contract, interpretation, limitations, and examples coherently linked.
- Relationship documentation keeps meaning, executable/deferred status, prohibited substitutions, and drafting behavior together.
- ADR material uses curated retrieval summaries containing decision, consequences, restrictions, and supersession rather than arbitrary fragments.
- Template examples retain complete bindings and are labelled `APPROVED_EXAMPLE`, `NEGATIVE_EXAMPLE`, or `CHARACTERIZATION_ONLY`; examples never override registries.

Research strategies preserve source structure:

- Financial reports follow document, section, subsection, table, row/metric, and narrative hierarchy. Table chunks retain headers, labels, units, periods, and notes; detached numeric sequences are invalid.
- Broker reports separate rating, target, thesis, catalysts, risks, valuation, estimate revisions, assumptions, and disclosures. Publisher recommendations remain attributed claims, not YUDIJI decisions.
- Earnings transcripts preserve speaker, role, topic, question/answer distinction, timestamp/page, and surrounding context. Unrelated speakers are not merged merely to reach a token target.

### Parent-child retrieval

Chunks may form immutable parent-child hierarchies. Search may match a focused child; context assembly may include that child, a bounded parent summary, and selected neighbors. An entire long document is never included automatically.

### Citation authority

Every selectable chunk produces a citation handle created only by the trusted retrieval/context-assembly boundary. A citation preserves:

```text
documentId/documentVersion
chunkId/chunkVersion
source identity and title
exact source span
document and chunk content digests
corpus and trust level
owner-safe display metadata
```

The model cannot manufacture or redefine citation handles. Any model-returned handle is validated against the exact handles supplied in context. Invalid or unauthorized citations fail closed.

### Embedding and index lineage

Embeddings are derived artifacts, never source authority. Each embedding preserves exact chunk identity/version, chunk digest, embedding provider/model identity, embedding schema/version, normalization strategy/version, vector dimension, and ingestion-run/creation lineage. A model, schema, normalization, or source change creates a new version; prior vectors are not overwritten without retirement lineage.

A provider-neutral vector-index port will support exact corpus/tenant namespaces, immutable vector insertion, exact artifact retirement, metadata filters, bounded similarity search, deterministic tie handling where possible, and required vector/index-version filters. Vendor types cannot enter drafting-domain contracts. ADR-060 selects no provider, database, or embedding model.

### Bounded hybrid retrieval

The future retrieval pipeline is:

```text
normalized bounded request
  -> exact structured-authority lookup
  -> metadata-filtered vector retrieval
  -> optional lexical retrieval
  -> version-aware deduplication
  -> optional versioned reranking
  -> deterministic context-budget selection
  -> citation-bearing context
```

An immutable retrieval request contains request identity, explicit corpus scopes, authenticated owner/tenant scope, bounded concept queries, exact metadata filters, explicit as-of/effective-time policy, bounded top-K, context-token budget, retrieval-strategy identity/version, accepted trust levels, and exact corpus/index version for replay. User-private global search is prohibited.

An immutable retrieval result preserves chunk/document identities and versions, vector/lexical/rerank diagnostic scores where used, trust, source span, citation handle, retrieval strategy lineage, and useful exclusion reasons. Relevance scores are diagnostics, not truth probabilities.

### Context assembly

Raw vector-store responses never go directly to the model. The context assembler:

1. validates corpus and owner/tenant scope;
2. resolves exact document and chunk versions;
3. applies explicit current or historical supersession/effective-time policy;
4. deduplicates chunks and overlap;
5. preserves validated citations;
6. bounds per-document dominance;
7. applies the explicit context budget;
8. retains registry authority in a separate envelope;
9. labels explanatory and trust classifications;
10. uses deterministic ordering and tie rules.

### Initial integration and workflow separation

The first rollout retrieves only approved `PLATFORM_KNOWLEDGE` for template drafting. It may explain terminology, factor and relationship meanings, limitations, approved/negative examples, and validation behavior. It does not retrieve arbitrary market research.

`MARKET_RESEARCH` is a separate later workflow:

```text
source retrieval
  -> citation-bearing structured claim candidates
  -> deterministic claim validation
  -> future Evidence candidates
```

Free-form model output never creates Evidence directly. `USER_PRIVATE_DOCUMENTS` ingestion is also deferred until its persistence, deletion, isolation, and authorization implementation is independently proven.

Live price, volume, open interest, basis, and order-book observations remain canonical Evidence or deterministic derived-factor inputs. They are not converted into text chunks for scoring. RAG may contain explanatory documentation about such concepts.

### Supersession and historical replay

Documents, chunks, embeddings, and index manifests are append-only. Current retrieval excludes superseded, expired, withdrawn, or inactive artifacts according to an explicit versioned policy. Historical replay supplies exact corpus, strategy, embedding, and index versions. No hidden `latest()` lookup is permitted in replay.

### Trust policy

The closed trust vocabulary is:

```text
AUTHORITATIVE
APPROVED_GUIDANCE
EXPLANATORY
USER_PROVIDED
UNVERIFIED
```

Admission assigns trust under system policy. Retrieval declares accepted trust levels. Context labels trust explicitly, and the LLM cannot upgrade it. Trust does not replace exact registry or Evidence validation.

### Tenant isolation and caches

Every private document, chunk, embedding, index entry, cache entry, retrieval request, and citation inherits exact owner/tenant scope. Authenticated scope is mandatory and cross-tenant access fails closed. Citation display cannot leak unauthorized source metadata. Cache keys include all ownership and corpus boundaries.

### Prompt-injection resistance

Retrieved content is untrusted data. Future ingestion and orchestration will detect or label instruction-like content, strip or isolate unsafe control markup, use structured delimited context envelopes, never execute document instructions, bound per-document influence, validate every model output, and validate every citation. RAG does not weaken B1 schema or deterministic authority validation.

### Failure vocabulary

Future typed stage outcomes distinguish:

```text
DOCUMENT_REJECTED
PARSING_FAILED
CHUNKING_FAILED
EMBEDDING_FAILED
INDEXING_FAILED
RETRIEVAL_FAILED
CITATION_VALIDATION_FAILED
CONTEXT_ASSEMBLY_FAILED
FEATURE_DISABLED
```

Implementations classify typed outcomes, never exception-message strings. Partial ingestion is permitted only under a later explicit completeness contract that preserves successful page/chunk scope, failed scope, exact diagnostics, and an honest incomplete status. It cannot misrepresent a partial document as complete.

### Observability and evaluation lineage

Operational metadata may include ingestion run identity, document/chunk counts, parser/strategy versions, embedding/index versions, retrieval strategy, top-K, selected count, context size, citation count, failure stage, and duration. Ordinary traces do not contain full documents, private chunks, raw prompts, or model responses.

Future evaluation fixtures preserve query identity, expected document/chunk identities, corpus version, chunking/embedding/index/retrieval/reranker lineage, selected citations, context budget, candidate support outcomes, invented-citation count, and unresolved-concept recall. ADR-060 does not implement an evaluation harness.

### Feature controls and rollback

`RAG_TEMPLATE_DRAFTING_ENABLED` remains default OFF and unchanged. Its current name conflates registry-only generation and retrieval availability. Later rollout may require separately authorized controls for drafting, document admission, indexing, and retrieval; ADR-060 does not invent them.

Rollback disables RAG retrieval while preserving separately enabled B1 registry-only drafting. Retrieval failure cannot corrupt templates, existing DRAFTs, registries, Evidence, scoring, compiled rulebooks, or legacy behavior. Retrieved prose is never persisted into a template as authority.

### Implementation sequence

```text
B2-A — architecture
B2-B — immutable document and chunk authority
B2-C — platform-knowledge ingestion and structure-aware chunking
B2-D — embedding and provider-neutral vector-index ports
B2-E — bounded hybrid retrieval and citations
B2-F — B1 drafting integration
B2-G — retrieval evaluation and security proof
```

Only approved `PLATFORM_KNOWLEDGE` is eligible for the initial implementation rollout.

## Deterministic lineage diagram

```text
KnowledgeDocumentVersion
  document identity/version + digest + source + trust + ownership
          |
          v exact parser and strategy versions
KnowledgeChunk
  chunk identity/version + digest + source span + inherited scope
          |
          v exact embedding schema/model and ingestion run
EmbeddingArtifact
          |
          v exact provider-neutral index manifest/version
Bounded Retrieval
          |
          v validated citation handles + deterministic context budget
RAG Context Envelope
          +
Exact B1 Registry Projection
          |
          v
Structured Candidate -> Schema Validation -> Deterministic Validation
```

## Alternatives considered

| Alternative | Decision | Reason |
| --- | --- | --- |
| One collection and implicit search across all documents | Rejected | It collapses trust, temporal, ownership, and tenant boundaries. |
| Separate platform, research, and private corpora | Accepted | Each has distinct authority, admission, retrieval, and security policy. |
| One fixed-token chunker | Rejected | It separates definitions, consequences, table labels, speakers, and risks from their context. |
| Versioned document-type-specific strategies | Accepted | Semantic structure and independently replayable strategy lineage are preserved. |
| Mutable document and chunk rows | Rejected | Mutation destroys citation stability and historical replay. |
| Immutable versioned documents and chunks | Accepted | Exact digest, source-span, strategy, supersession, and replay lineage remain available. |
| Vector-only retrieval | Rejected | Similarity cannot establish exact authority identities and weakens literal/metadata retrieval. |
| Exact authority plus metadata-filtered hybrid retrieval | Accepted | Deterministic authority and explanatory semantic context remain separate. |
| Embed registry objects as the only knowledge source | Rejected | Exact registries lack bounded prose, examples, limitations, and citations. |
| Registry projection plus approved explanatory corpus | Accepted | Exact validation remains authoritative while drafting gains sourced explanation. |
| Pass raw vendor search results to the LLM | Rejected | It bypasses ownership, version, citation, deduplication, and budget validation. |
| Structured citation-bearing context assembly | Accepted | It creates one safe deterministic boundary before prompting. |
| Defer tenant isolation until private documents launch | Rejected as a design shortcut | Private-document contracts must inherit isolation from their first design, even though implementation is deferred. |
| Tenant isolation in every private artifact and cache key | Accepted | Cross-tenant leakage fails closed through the full lineage. |
| Store live market observations as text chunks | Rejected | Numerical observations belong to Evidence and deterministic processing. |
| Keep market data in Evidence | Accepted | Existing provenance, time, freshness, and scoring boundaries remain authoritative. |
| Vendor-specific vector contracts | Rejected | They couple domain workflows to a premature provider choice. |
| Provider-neutral embedding/index ports | Accepted | Provider selection and migration remain later implementation decisions. |
| Full market-research ingestion initially | Deferred | Claim validation, licensing, attribution, and Evidence projection need separate architecture and proof. |
| Approved platform knowledge only initially | Accepted | It is the smallest bounded path that improves B1 drafting without entering market-Evidence semantics. |

## Consequences

- Citations remain stable and auditable across document, parser, strategy, embedding, and index changes.
- Exact registries and Evidence retain authority; retrieval remains explanatory.
- Corpus, trust, ownership, and temporal policy become mandatory inputs rather than implicit filters.
- Initial implementation requires more lineage and validation than a vendor SDK proof, but avoids irreversible vendor coupling and unsafe mixed-corpus search.
- User-private and market-research workflows remain unavailable until their distinct admission and validation boundaries are implemented.

## Implementation status

Documentation only. No document/chunk model, parser, ingestion service, embedding model, vector database, index, retrieval service, citation implementation, prompt change, template change, Evidence path, scoring behavior, feature flag, dependency, API, or runtime registration is introduced by ADR-060.

