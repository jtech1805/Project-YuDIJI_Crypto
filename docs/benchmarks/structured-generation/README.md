# Structured-generation provider benchmark

This directory defines Track C-B1A's sanitized, provider-neutral benchmark. It does not contain a production adapter or live provider integration.

## Reproducible configuration

```text
dataset: YUDIJI_STRUCTURED_GENERATION_GOLDEN v1 (10 cases)
prompt: TEMPLATE_DRAFT_REGISTRY_GROUNDED v1
candidate schema: TEMPLATE_DRAFT_CANDIDATE v1
policy: STRUCTURED_GENERATION_PROVIDER_SELECTION v1
decision weights: structured 18, safety 18, injection 10, citation 8,
latency 8, cost 8, privacy 12, stability 6, operations 5, API 4, region 3
```

The dataset covers supported ETF flow, unsupported long buildup, mixed concepts, an unknown factor, DIRECT versus INVERSE, VETO misuse, prompt injection, forged citation, bounded large context, and sanitized content rejection.

Offline contract fixtures characterize ten response classes for OpenAI, Anthropic, and Google Gemini. They are sanitized response classifications, not claims that a live provider produced the included outcome. Provider output remains nondeterministic.

## Controlled live runbook

No live command or adapter prototype is included in C-B1A because credentials and live-run authorization were not supplied. A future benchmark runner must require all of these explicitly and fail before any call if one is absent:

```text
LIVE_AI_BENCHMARK_CONFIRMED=true
benchmark-only provider credential
provider ID
exact model ID (never latest/preview/experimental)
benchmark environment
maximum USD cost
maximum request count
per-request timeout
total deadline
dataset and policy versions
```

The command must be isolated from `npm test`, normal CI, application bootstrap, production configuration, and production traces. It may use only synthetic fixtures. It must record requested and provider-reported model identities, API version, request ID, usage, documented error code, latency, and sanitized metric outcomes. Raw prompts, candidates, headers, account data, and credentials remain local and gitignored.

Recommended live policy starts with concurrency 1, at least 10 repetitions per normal case when budget permits, two attempts only for typed transient failures, and no provider/model fallback. It terminates at its total deadline.

## Result labels

```text
OFFLINE_BENCHMARK_RESULT: PASSED
LIVE_BENCHMARK_RESULT: NOT AVAILABLE
LIVE_BENCHMARK_NOT_RUN: credentials and explicit authorization unavailable
```
