# Gemini free-tier structured-generation validation

Status: implementation complete; guarded live validation complete

The unregistered development adapter uses official `@google/genai` 2.16.0, stable Gemini API `v1`, exact model `gemini-3.1-flash-lite`, adapter version 1, and `TEMPLATE_DRAFT_CANDIDATE` v1. Google's model catalog identifies this endpoint as stable; the distinct `gemini-3.1-flash-lite-preview` endpoint is shut down. See [Gemini models](https://ai.google.dev/gemini-api/docs/models), [API versions](https://ai.google.dev/gemini-api/docs/api-versions), and the [official SDK](https://googleapis.github.io/js-genai/).

The candidate JSON Schema is derived from the existing Zod schema using Zod 4's built-in JSON Schema conversion, then projected to Gemini's accepted JSON Schema subset. Unsupported provider hints such as `pattern`, `minLength`, `maxLength`, and `exclusiveMinimum` are omitted only from the provider request. Repeated `maxItems` constraints are also omitted because live stable-v1 characterization rejects the complete candidate schema when they are present. No candidate field is removed, and the original strict Zod schema—including every array bound—remains the authoritative post-generation validator. Gemini output still passes through JSON parsing, deterministic B1 registry validation, and—when RAG is used—the existing citation and contradiction validators.

## Data restriction

This free-tier development adapter permits only synthetic validation and explicitly approved non-sensitive PLATFORM_KNOWLEDGE development material. Free-tier submitted content may be used by Google to improve products. Never submit private/confidential/regulated content, real user data, private documents, market research, broker reports, financial positions, account data, personal information, production database content, or secrets. This phase is not production privacy approval.

## Guarded command

The command is never part of `npm test` or CI:

```text
npm run benchmark:gemini-generation
```

It requires all of:

```text
YUDIJI_GEMINI_LIVE_VALIDATION_CONFIRMED=true
YUDIJI_GEMINI_API_KEY=<benchmark-only key>
YUDIJI_GEMINI_BENCHMARK_MODEL=gemini-3.1-flash-lite
YUDIJI_GEMINI_BENCHMARK_MAX_REQUESTS=18
YUDIJI_GEMINI_BENCHMARK_DATASET=SYNTHETIC_V1
NODE_ENV=development
```

It rejects missing confirmation/key, production environment, another model, more than 18 requests, or another dataset. The six synthetic cases run three repetitions each at concurrency one. Output contains counts and identities only—never prompts, candidates, API keys, response bodies, or headers.

The adapter enforces a 30-second request timeout by default, a 60-second total deadline, at most two attempts, and retries only rate limiting, request timeout, network failure, or provider unavailability against the same exact model. SDK cancellation is client-side and may not cancel provider billing, as documented by the SDK. Authentication, permission, model lookup, rejection, malformed/schema-invalid output, and identity mismatch are not retried. No Groq or alternate Gemini fallback exists.

## Current result

```text
LIVE_GEMINI_VALIDATION_COMPLETED
model: gemini-3.1-flash-lite
dataset: SYNTHETIC_V1
requests: 18
completed: 18
failed: 0
```

This proves live account/model access and provider acceptance of the projected structured request. The count-only runner does not yet prove post-generation Zod validity, semantic safety, latency percentiles, usage/cost thresholds, quota behavior, or rate-limit recovery. Those remain C-B1C evaluation work. The authoritative Zod contract was not weakened.
