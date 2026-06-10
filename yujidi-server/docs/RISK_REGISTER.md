# Risk Register

This document tracks known technical, product, security, operational, and domain risks in the YuJiDi backend.

`PROJECT_CONTEXT.md` remains the high-level source of truth. This file is the detailed risk register.

Risk scoring:

- Severity: Low, Medium, High, Critical
- Likelihood: Low, Medium, High
- Status: Open, Mitigating, Accepted, Closed

## 1. Summary

Highest-priority current risks:

1. Analyzer allows monitor windows longer than its price buffer.
2. Analyzer state is in memory and not multi-instance safe.
3. Alert detail ownership lookup may be inconsistent.
4. MongoDB is queried on every aggTrade tick.
5. Failed LLM pipeline can still trigger cooldown.
6. Spike support needs automated regression tests.
7. Secrets and environment handling need production discipline.
8. WebSocket/local cookie behavior can fail under certain environments.

## 2. Risk Table

| ID | Risk | Severity | Likelihood | Status |
| --- | --- | --- | --- | --- |
| R-001 | Spike monitor support needs automated regression tests after implementation | Medium | Medium | Mitigating |
| R-002 | Monitor windows up to 24h are allowed while analyzer keeps 60m of price history | High | High | Open |
| R-003 | Analyzer state is in memory and lost on restart | High | High | Open |
| R-004 | Multi-instance deployment will produce inconsistent analyzer/WebSocket state | Critical | Medium | Open |
| R-005 | Analyzer active-monitor cache is in memory and process-local | Medium | Medium | Mitigating |
| R-006 | Cooldown starts before alert pipeline succeeds | Medium | High | Open |
| R-007 | Alert detail lookup may not correctly scope by authenticated user id | High | Medium | Open |
| R-008 | Alert model keeps legacy `dropPercentage` during compatibility migration | Medium | High | Mitigating |
| R-009 | CVD whale threshold is not normalized per symbol | Medium | High | Open |
| R-010 | Groq malformed JSON prevents alert creation | Medium | Medium | Open |
| R-011 | Real external APIs make local/dev behavior dependent on network and provider limits | Medium | Medium | Mitigating |
| R-012 | Secure cookie config may break local HTTP auth/WebSocket auth | Medium | Medium | Open |
| R-013 | Refresh token is stored directly instead of hashed | High | Medium | Open |
| R-014 | No automated backend tests currently visible | High | High | Open |
| R-015 | Failed alert attempts are not persisted | Medium | Medium | Open |
| R-016 | HTTP LTP ignition can add unmanaged subscriptions | Medium | Medium | Open |
| R-017 | Frontend `/engine` page describes architecture not implemented in backend | Medium | High | Open |
| R-018 | No alert pagination beyond latest 50 records | Low | Medium | Open |
| R-019 | Duplicate monitors for same user/symbol/trigger are allowed | Medium | Medium | Open |
| R-020 | Order-book support/resistance is heuristic and can be affected by spoofing/thin books | Medium | High | Open |

## 3. Detailed Risks

### R-001: Spike Monitor Regression Coverage

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

The analyzer now implements trigger-aware drop/spike logic, but automated regression tests still need to be added.

Impact:

Future analyzer changes could accidentally break spike behavior.

Mitigation:

- Add unit tests for spike trigger and non-trigger paths.
- Keep `ANALYZER_ENGINE.md` test cases current.

### R-002: Monitor Window Exceeds Analyzer Buffer

Severity: High

Likelihood: High

Status: Open

Description:

Monitor validation allows windows up to 24 hours, while the analyzer keeps only one hour of price ticks.

Impact:

Long-window monitors may never evaluate correctly.

Mitigation:

- Either cap monitor windows at 60 minutes.
- Or persist/stream historical price data beyond in-memory buffer.
- Add validation tests.

### R-003: Analyzer State Lost On Restart

Severity: High

Likelihood: High

Status: Open

Description:

Analyzer state lives in memory:

- price buffer
- CVD
- cooldowns
- order book

Impact:

After restart, monitors need time to rebuild history. Cooldowns disappear. Order-book context resets.

Mitigation:

- Accept for prototype.
- For production, move selected state to Redis or a dedicated ingestion service.

### R-004: Multi-Instance Deployment Is Not Safe

Severity: Critical

Likelihood: Medium

Status: Open

Description:

Multiple backend instances do not share WebSocket subscriptions, analyzer buffers, cooldowns, or order books.

Impact:

Users connected to different instances may get inconsistent alerts.

Mitigation:

- Run single instance until architecture is changed.
- Introduce shared Redis/pub-sub or separate market ingestion service.
- Add sticky sessions only as a partial mitigation.

### R-005: Process-Local Active Monitor Cache

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

The analyzer now uses a short TTL active monitor cache and invalidates cache entries on monitor create/update/delete. The cache is still process-local.

Impact:

Single-instance MongoDB read load is reduced. Multi-instance deployments can still have inconsistent local caches unless shared invalidation exists.

Mitigation:

- Short TTL cache is implemented.
- Explicit invalidation on monitor create/update/delete is implemented.
- Add shared cache or pub/sub invalidation before multi-instance deployment.

### R-006: Cooldown Starts Before Alert Success

Severity: Medium

Likelihood: High

Status: Open

Description:

Cooldown is set before news, LLM, and DB alert save complete.

Impact:

If the pipeline fails, the user may receive no alert while the monitor remains cooled down.

Mitigation:

- Set full cooldown only after alert save succeeds.
- Add shorter failure cooldown.
- Persist failed alert attempts.

### R-007: Alert Detail Ownership Lookup Risk

Severity: High

Likelihood: Medium

Status: Open

Description:

Alert list and alert detail appear to use different user object shapes.

Impact:

Valid alert detail requests may fail, or ownership checks may become fragile.

Mitigation:

- Normalize all protected controllers to use `req.user.id`.
- Add integration tests for User A/User B alert access.

### R-008: Legacy Alert Movement Field

Severity: Medium

Likelihood: High

Status: Mitigating

Description:

The alert model still stores `dropPercentage` for backward compatibility. New alerts also store `changePercentage`, `triggerType`, and `direction`.

Impact:

Developers may accidentally use `dropPercentage` for new movement semantics.

Mitigation:

- Frontend should prefer new fields and fallback to `dropPercentage`.
- Remove `dropPercentage` in a later explicit migration.
- Keep docs clear that `dropPercentage` is legacy absolute magnitude.

### R-009: CVD Threshold Is Not Asset-Normalized

Severity: Medium

Likelihood: High

Status: Open

Description:

`WHALE_THRESHOLD_BTC = 0.1` is applied to all symbols.

Impact:

The CVD filter may be too strict or too loose depending on asset unit price/supply.

Mitigation:

- Use notional value threshold in USDT.
- Or configure per-symbol thresholds.

### R-010: Groq JSON Failures Drop Alerts

Severity: Medium

Likelihood: Medium

Status: Open

Description:

Alert report parsing uses strict JSON parsing and Zod validation.

Impact:

Malformed responses prevent alert storage.

Mitigation:

- Keep strict validation.
- Add retry or JSON repair fallback.
- Persist failed alert attempts.

### R-011: External API Reliability

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

The backend depends on Binance, Groq, CryptoCompare, and MongoDB.

Impact:

Network/API outages can degrade symbol sync, LTP, news, LLM reports, or alert persistence.

Mitigation:

- MongoDB startup connection now uses bounded retry/backoff.
- Binance symbol sync now runs as a non-fatal background retry loop.
- Mock external APIs in tests.
- Add retries where appropriate.
- Add health checks and provider-specific fallback behavior.

### R-012: Secure Cookie Local Development Issues

Severity: Medium

Likelihood: Medium

Status: Open

Description:

Auth cookies use secure cross-site settings. Local HTTP development may not send/store cookies as expected.

Impact:

Login or WebSocket auth may appear broken locally.

Mitigation:

- Use environment-specific cookie settings.
- Document local HTTPS or dev cookie config.

### R-013: Refresh Token Stored Directly

Severity: High

Likelihood: Medium

Status: Open

Description:

The latest refresh token is stored directly on the user document.

Impact:

If database contents leak, active refresh tokens may be exposed.

Mitigation:

- Store a hash of the refresh token.
- Track session metadata.
- Allow session revocation.

### R-014: No Automated Backend Tests

Severity: High

Likelihood: High

Status: Open

Description:

There is no visible automated test script.

Impact:

Analyzer, auth, and ownership regressions can slip through.

Mitigation:

- Add test framework.
- Start with analyzer unit tests.
- Add route integration tests for ownership.

### R-015: Failed Alert Attempts Are Not Persisted

Severity: Medium

Likelihood: Medium

Status: Open

Description:

Only successful alerts are saved.

Impact:

Debugging missing alerts is harder.

Mitigation:

- Add alert pipeline status records.
- Or add a separate failed-alert collection/log.

### R-016: HTTP LTP Ignition Can Create Unmanaged Subscriptions

Severity: Medium

Likelihood: Medium

Status: Open

Description:

`addHttpSubscription` increments global symbol tracking without a matching lifecycle to decrement.

Impact:

Symbols may remain subscribed longer than intended.

Mitigation:

- Add TTL for HTTP-origin subscriptions.
- Track source of subscription counts.

### R-017: Documentation/Product Architecture Mismatch

Severity: Medium

Likelihood: High

Status: Open

Description:

The frontend `/engine` page mentions Redis, Kafka, pgvector, LangChain, SSE, OAuth, encryption, and other components not present in the backend.

Impact:

Confusion about current versus future architecture.

Mitigation:

- Clearly label future architecture in product pages.
- Keep `PROJECT_CONTEXT.md` current.

### R-018: Alert Pagination Missing

Severity: Low

Likelihood: Medium

Status: Open

Description:

Alert list returns latest 50 only.

Impact:

Older alerts become inaccessible in current UI/API.

Mitigation:

- Add pagination with cursor or page params.

### R-019: Duplicate Monitor Risk

Severity: Medium

Likelihood: Medium

Status: Open

Description:

The backend appears to allow duplicate monitors for the same user/symbol/trigger.

Impact:

Users can receive duplicate alerts for the same market event.

Mitigation:

- Decide if duplicates are valid.
- Add uniqueness rule if not valid.

### R-020: Order-Book Heuristic Risk

Severity: Medium

Likelihood: High

Status: Open

Description:

Support/resistance detection uses visible order book and average/multiplier heuristics.

Impact:

Thin books, spoof orders, and distant walls may produce misleading support/resistance values.

Mitigation:

- Treat walls as heuristic context, not certainty.
- Add distance filters.
- Consider notional value thresholds.
- Add tests for thin/spoof-like books.

### R-021: LLM Provider Lock-In

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

YuJiDi currently uses Groq for alert report generation and copilot chat. Direct provider coupling would make future OpenAI, Gemini, or other LLM provider changes risky.

Impact:

Provider-specific SDKs, response formats, and model behavior could leak into analyzer/chat logic and make testing or provider switching harder.

Mitigation:

- LLM calls now go through an application-owned `LLMProvider` port.
- Groq-specific SDK usage, request payloads, response parsing, and schema validation live inside the Groq adapter.
- Only Groq is implemented today.
- Add OpenAI/Gemini adapters later without changing analyzer/chat domain logic.

## 4. Review Cadence

This risk register should be reviewed:

- before production deployment
- after analyzer logic changes
- after auth/session changes
- after WebSocket scaling changes
- after LLM provider or prompt changes

When a risk is fixed:

1. Update status to `Closed`.
2. Link or describe the fix.
3. Add regression tests.
4. Update `PROJECT_CONTEXT.md` if the fix changes project direction or architecture.
