# Structured-generation provider research

Research date: 2026-08-06

Only official sources support provider claims. Account capabilities were not inspected; all account-specific limits, regions, models, ZDR eligibility, and commercial terms are `ACCOUNT_CONFIRMATION_REQUIRED`.

## OpenAI

`OFFICIAL_DOCUMENTATION_FACT`: The Responses API supports strict JSON Schema output, refusals, streaming events, response/request identity, and token usage. OpenAI documents dated model snapshots, rate-limit headers, Batch API behavior, and model deprecation/change practices. API customer content is not used for training by default; abuse-monitoring logs are normally retained for up to 30 days, while eligible customers can request Modified Abuse Monitoring or Zero Data Retention. Data-residency capabilities depend on region, endpoint, model snapshot, and approval. Sources: [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs), [Responses API](https://platform.openai.com/docs/api-reference/responses), [rate limits](https://platform.openai.com/docs/guides/rate-limits), [Batch API](https://platform.openai.com/docs/guides/batch), [pricing](https://platform.openai.com/docs/pricing), and [data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint).

Documentary benchmark candidate: `gpt-5.1-2025-11-13` through `/v1/responses`. Availability, current production suitability, price, limits, structured-schema compatibility with YUDIJI's complete schema, account retention settings, and provider-reported identity are unverified.

SDK review: official `openai` JavaScript/TypeScript SDK versus direct REST remains `INCONCLUSIVE`; no package was installed. The adapter phase must test cancellation, timeouts, typed errors, exact model/usage exposure, dependency footprint, license, and schema helpers.

Privacy status: `APPROVED_FOR_SYNTHETIC_BENCHMARK`; production PLATFORM_KNOWLEDGE remains conditional on security/legal approval and an accepted retention/region configuration.

## Anthropic

`OFFICIAL_DOCUMENTATION_FACT`: The Messages API documents structured outputs with a supported JSON-Schema subset, refusals/content filtering, streaming, request IDs, usage, rate/spend limits, batch processing, and dated model identifiers/deprecation notices. API inputs and outputs are normally deleted within 30 days; enterprise ZDR is separately approved and has feature-specific exceptions. Sources: [Structured outputs](https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs), [Messages](https://docs.anthropic.com/en/api/messages), [rate limits](https://docs.anthropic.com/en/api/rate-limits), [models](https://docs.anthropic.com/en/docs/about-claude/models/overview), [deprecations](https://docs.anthropic.com/en/docs/about-claude/model-deprecations), [pricing](https://docs.anthropic.com/en/docs/about-claude/pricing), [retention](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), and [ZDR](https://privacy.anthropic.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to).

Documentary candidate identity remains `ACCOUNT_CONFIRMATION_REQUIRED`; `claude-sonnet-4-20250514` is retained only as an exact recorded-contract identity, not asserted to be the current account model. A live benchmark must query permitted models and select a current exact stable dated ID without using an alias.

SDK review: official `@anthropic-ai/sdk` versus REST remains `INCONCLUSIVE`; no package was installed. Privacy status is synthetic-benchmark-only pending retention, regional, enterprise, security, and legal confirmation.

## Google Gemini

`OFFICIAL_DOCUMENTATION_FACT`: Gemini supports schema-constrained JSON using a documented JSON-Schema subset, function calling, streaming, safety settings, usage metadata, model discovery/version metadata, rate limits, batch processing, pricing, and lifecycle notices. Google distinguishes stable, preview, latest, and experimental names; `latest` is hot-swapped and prohibited by YUDIJI. Sources: [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [models](https://ai.google.dev/gemini-api/docs/models), [Models API](https://ai.google.dev/api/models), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [pricing](https://ai.google.dev/gemini-api/docs/pricing), and [release notes](https://ai.google.dev/gemini-api/docs/changelog).

Documentary candidate: stable `gemini-3.6-flash`, with the exact `models.get` version required at execution. Because a stable name is described as usually—not immutably—unchanged, provider-reported version, request time, deprecation monitoring, and reevaluation are mandatory. Account availability, API product (Gemini Developer API versus Vertex AI), schema compatibility, safety behavior, region, retention/training terms, quotas, and price are unverified.

SDK review: official `@google/genai` versus REST remains `INCONCLUSIVE`; no package was installed. Privacy status is synthetic-benchmark-only pending product-specific enterprise, region, security, privacy, and legal confirmation.

## Error mapping and contract gaps

Official HTTP/error codes can conceptually map to ADR-061 authentication, permission, rate-limit, timeout/network, unavailable, content-rejection, empty/malformed/schema, oversized-input, model-not-found/deprecated, and unknown failures. Exact per-provider mapping remains a live adapter-prototype gate; free-form message parsing is prohibited.

The current production-neutral `TemplateDraftModelResult` represents only `PROVIDER_FAILED` and `EMPTY_RESPONSE`. It can carry provider/model and basic prompt/completion/total usage, but cannot represent refusal/content rejection distinctly, exact API/provider response IDs, provider-reported model version separate from model, timeout/cancellation, retry-after/rate-limit metadata, cached or reasoning units, or the closed ADR-061 taxonomy. These gaps are reported, not changed in C-B1A.
