# Gemini embedding guarded development validation

Status: implementation complete; live validation pending

The unregistered adapter uses official `@google/genai` 2.16.0, stable API `v1`, exact `gemini-embedding-001`, explicit 768 output dimensions, and request-level `RETRIEVAL_DOCUMENT` or `RETRIEVAL_QUERY`. It returns raw vectors only. Existing provider-neutral orchestration validates and normalizes them through `L2_UNIT_VECTOR` version 1 before persistence or search.

## Data restriction

Only synthetic validation, approved non-sensitive PLATFORM_KNOWLEDGE, and development query text are allowed. Never submit private user documents, market or broker research, financial reports, positions, account/personal/confidential data, production database content, or real private prompts. Free-tier submitted content may be used by Google to improve products; this adapter is not production privacy approval.

## Guarded command

```text
YUDIJI_GEMINI_API_KEY=<benchmark key>
YUDIJI_GEMINI_EMBEDDING_LIVE_VALIDATION_CONFIRMED=true
NODE_ENV=development
npm run benchmark:gemini-embedding
```

Optional exact guard values:

```text
YUDIJI_GEMINI_EMBEDDING_MODEL=gemini-embedding-001
YUDIJI_GEMINI_EMBEDDING_DIMENSION=768
YUDIJI_GEMINI_EMBEDDING_BENCHMARK_MAX_INPUTS=20
YUDIJI_GEMINI_EMBEDDING_BENCHMARK_CONCURRENCY=1
YUDIJI_GEMINI_EMBEDDING_BENCHMARK_DATASET=SYNTHETIC_PLATFORM_KNOWLEDGE_V1
```

The command sends six synthetic document-purpose inputs and four synthetic query-purpose inputs in two sequential homogeneous batches. It validates counts, finite 768-dimensional vectors, L2 normalization within `1e-12`, and four directional cosine smoke checks. Output is sanitized metrics only. It never runs in tests, CI, bootstrap, or production.

## Current result

```text
LIVE_GEMINI_EMBEDDING_VALIDATION_NOT_RUN
reason: separate embedding live confirmation unavailable
```
