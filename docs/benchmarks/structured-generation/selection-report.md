# Structured-generation provider selection report

Verdict: `INCONCLUSIVE`

## Evidence classification

- `OFFICIAL_DOCUMENTATION_FACT`: recorded in `provider-research.md` with primary sources.
- `ACCOUNT_VERIFIED_FACT`: none; no provider accounts or credentials were supplied.
- `BENCHMARK_OBSERVATION`: deterministic offline evaluation behavior and sanitized response-contract classifications passed. No live provider behavior was observed.
- `ARCHITECTURAL_INFERENCE`: all three providers appear technically plausible, but documentation alone cannot establish YUDIJI schema reliability, safety proposal rates, latency, cost, quotas, regional behavior, or account privacy settings.
- `RECOMMENDATION`: do not select a provider/model until the controlled live benchmark and approvals complete.

## Lineage and policy

Dataset `YUDIJI_STRUCTURED_GENERATION_GOLDEN` v1 contains 10 synthetic cases. Prompt `TEMPLATE_DRAFT_REGISTRY_GROUNDED` v1, candidate schema `TEMPLATE_DRAFT_CANDIDATE` v1, and decision policy `STRUCTURED_GENERATION_PROVIDER_SELECTION` v1 are exact inputs. The policy uses 10 repetitions per normal case, concurrency 1, bounded retries only for typed transient failures, a 30-second request timeout, a 15-minute total deadline, 300-request cap, unit bounds, and a USD 100 hard cap. A real run may lower these bounds but may not exceed them without a new policy version.

Weights sum to 100: structured output 18, deterministic safety 18, injection 10, citations 8, latency 8, cost 8, privacy 12, model stability 6, operations 5, API quality 4, region 3. Hard gates remain separate: strict schema support, exact lineage, zero unsafe system acceptance, acceptable privacy path, complete typed error mapping, no `latest`, and representative live evidence. Weighted scores cannot override them.

## Offline result

The evaluator proves deterministic subject digests, immutable bounded policies, versioned pricing calculations, distinct parse/schema/correlation/safety/citation/injection/latency/usage metrics, insufficient-p99 labeling, hard-gate precedence, all four verdicts, canonical tie handling, and no forced winner. There are 30 sanitized provider-contract classifications: 10 each for OpenAI, Anthropic, and Gemini.

Offline fixtures do not measure provider-call completion, parse/schema rates, semantic proposal safety, latency, rate-limit recovery, or cost. Accordingly, no numeric provider comparison or weighted winner is reported.

## Privacy and security

All providers are approved only for a future synthetic benchmark. PLATFORM_KNOWLEDGE staging remains conditional on provider/product-specific retention and training review, region selection, ZDR/enterprise eligibility where required, account verification, security approval, and legal approval. Real user prompts, private data, market research, positions, database content, and personal information remain prohibited.

## Decision

Selected provider: none.

Selected exact model: none.

OpenAI `gpt-5.1-2025-11-13`, a current account-supported exact dated Anthropic model, and Google `gemini-3.6-flash` plus provider-reported version are documentary candidates only. None passes the representative-evidence hard gate. OpenAI remains ADR-061's live contract-test lead, but familiarity and documentation are insufficient approval.

Blocking actions:

1. Obtain benchmark-only paid-account credentials and explicit live authorization for all three providers.
2. Confirm exact stable model access, API version, retention configuration, region, quotas, and current pricing.
3. Run the guarded synthetic dataset within the approved policy and preserve sanitized summaries.
4. Complete SDK-versus-REST, dependency, security, privacy, and legal reviews.
5. Recompute hard gates and weighted results. Select only if one exact subject is `APPROVED` or its explicit conditional implementation policy permits C-B1B.

Track C-B1B remains blocked. No production adapter or runtime registration was created.
