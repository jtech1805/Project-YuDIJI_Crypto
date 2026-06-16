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
| R-022 | Angel provider documentation or version mismatch | High | Medium | Open |
| R-026 | Angel secret leakage | Critical | Medium | Open |
| R-027 | Incorrect Angel symbol normalization | High | Medium | Mitigating |
| R-028 | Duplicate or unstable universal symbol identity | High | Medium | Open |
| R-029 | Binance monitor compatibility during symbol evolution | High | Medium | Mitigating |
| R-030 | Provider-specific fields leaking into analyzer through symbol registry | Medium | Medium | Mitigating |
| R-031 | Broker-required symbols appearing before live broker support | Medium | Medium | Mitigating |
| R-032 | Broker credential storage risk | Critical | Medium | Mitigating |
| R-036 | Weak broker credential encryption key risk | Critical | Medium | Open |
| R-037 | Angel session expiry risk | Medium | High | Open |
| R-038 | Angel quote rate limit risk | Medium | High | Open |
| R-039 | Angel quote response field drift | Medium | Medium | Open |
| R-040 | REST quote polling used for high-frequency monitoring | High | Medium | Open |
| R-041 | Quote API secret/header leakage risk | Critical | Low | Mitigating |
| R-042 | Universal monitor changes break legacy Binance monitor creation | High | Medium | Mitigating |
| R-043 | Monitor symbol snapshot becomes stale | Medium | Medium | Open |
| R-044 | Missing broker validation for provider-gated symbols | High | Medium | Mitigating |
| R-045 | Provider/exchange/token mismatch in monitor snapshots | High | Medium | Open |
| R-046 | Analyzer still uses legacy symbol key during universal monitor transition | High | Medium | Open |
| R-047 | Angel WebSocket auth failure | High | Medium | Open |
| R-048 | Angel WebSocket token leakage in logs | Critical | Low | Mitigating |
| R-049 | Angel LTP binary parser offset bug | High | Medium | Mitigating |
| R-050 | Runaway Angel WebSocket reconnect loop | High | Low | Mitigating |
| R-051 | Angel WebSocket connection/subscription quota exceeded | High | Medium | Open |
| R-052 | Stale Angel subscriptions not cleaned up | Medium | Medium | Open |
| R-053 | Provider-aware subscription resolves wrong symbol/provider | High | Medium | Mitigating |
| R-054 | Angel market ticks delivered to wrong user socket | Critical | Low | Mitigating |
| R-055 | Partial WebSocket subscription failures confuse frontend state | Medium | Medium | Mitigating |
| R-056 | Angel tick triggers wrong user's alert | Critical | Low | Mitigating |
| R-057 | Provider-aware analyzer cache key mismatch | High | Medium | Mitigating |
| R-058 | Duplicate analyzer processing for Angel ticks | Medium | Medium | Open |
| R-059 | Analyzer processing blocks frontend tick delivery | High | Low | Mitigating |
| R-060 | Illiquid Angel contracts are hard to validate live | Medium | High | Open |
| R-061 | Unindexed symbol search causes slow API responses | High | Medium | Mitigating |
| R-062 | Frontend loads too many symbols into memory | High | Medium | Mitigating |
| R-063 | Stale frontend symbol search responses override newer searches | Medium | Medium | Mitigating |
| R-064 | Symbol search ranking returns option contracts before intended futures/spot matches | Medium | Medium | Mitigating |
| R-065 | High symbol search request volume overloads backend | Medium | Medium | Mitigating |
| R-033 | Angel Scrip Master URL availability failure | Medium | Medium | Mitigating |
| R-034 | Huge Angel symbol sync load | Medium | Medium | Mitigating |
| R-035 | Reference sync confused with market-data permission | High | Medium | Mitigating |

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

### R-022: Angel Provider Documentation Or Version Mismatch

Severity: High

Likelihood: Medium

Status: Open

Description:

Angel SmartAPI authentication, instrument master, and WebSocket payload formats may differ from assumptions or change across versions.

Impact:

Incorrect assumptions can break session handling, instrument sync, or tick normalization.

Mitigation:

- Phase 0 adds scaffold only.
- Do not implement live Angel calls until official SmartAPI docs and payload examples are reviewed.
- Keep Angel code behind provider ports and adapters.

### R-023: Provider Payload Leaking Into Analyzer

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Raw Binance, Angel, or Kite payloads could leak into analyzer/domain logic and make multi-provider support fragile.

Impact:

Analyzer behavior would become coupled to provider-specific field names, units, symbols, or tokens.

Mitigation:

- Introduce `NormalizedMarketTick`.
- Keep future provider payload parsing inside normalizers/adapters.
- Existing Binance behavior remains unchanged until a safe analyzer bridge is designed.

### R-024: Instrument Token Mapping Errors

Severity: High

Likelihood: Medium

Status: Open

Description:

Angel/Kite-style providers depend on exchange-specific instrument tokens. Incorrect token mapping could subscribe to the wrong market object.

Impact:

Users may receive wrong prices or alerts for the wrong instrument.

Mitigation:

- Add `Instrument` model with provider/exchange/token identity.
- Add uniqueness index on provider + exchange + instrument token.
- Add validation and sync tests before enabling live provider subscriptions.

### R-025: Premature Order Placement

Severity: Critical

Likelihood: Low

Status: Open

Description:

Trading/order APIs could be added before read-only market data is stable and audited.

Impact:

Accidental or unauthorized order placement could cause financial harm.

Mitigation:

- Phase 0 explicitly forbids order placement, portfolio sync, and auto trading.
- Require explicit approval before any trading/order API work.
- Keep Angel Phase 1 limited to auth/session and instrument master sync.

### R-026: Angel Secret Leakage

Severity: Critical

Likelihood: Medium

Status: Open

Description:

Angel credentials, PIN, TOTP secret, JWTs, refresh tokens, or feed tokens could be logged or documented accidentally.

Impact:

Credential exposure could compromise broker access.

Mitigation:

- Do not read or print `.env` for Angel work.
- Document variable names only.
- Do not log Angel secrets, tokens, PINs, or TOTP secrets.
- Review logs before enabling any live Angel integration.

### R-027: Incorrect Angel Symbol Normalization

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Angel Scrip Master rows must be converted into YuJiDi universal symbols. Incorrect expiry, strike, option type, exchange, or symbol formatting can create invalid instruments.

Impact:

Users may monitor the wrong Angel instrument or fail to find the intended MCX/FNO contract.

Mitigation:

- Add pure Angel mapper before live sync.
- Cover MCX option sample mapping with tests.
- Keep raw provider row for audit/debugging.

### R-028: Duplicate Or Unstable Universal Symbol Identity

Severity: High

Likelihood: Medium

Status: Open

Description:

The legacy `Symbol` model used globally unique `symbol`, while universal symbols should be unique by provider, exchange, and instrument token.

Impact:

Duplicate symbols across providers or exchanges can block inserts or confuse monitor selection.

Mitigation:

- Add provider + exchange + instrumentToken unique schema index.
- Avoid destructive index changes in application code.
- Plan a database index migration to remove any old global unique `symbol` index if present.

### R-029: Binance Monitor Compatibility During Symbol Evolution

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Existing crypto monitor creation/listing expected `status: "TRADING"` and Binance-only symbol documents.

Impact:

Changing Binance sync to universal `ACTIVE` records could break `/api/monitors/symbols` or monitor creation.

Mitigation:

- Monitor service accepts both `TRADING` and `ACTIVE` during transition.
- Binance sync preserves old string symbols like `BTCUSDT`.
- Existing analyzer and monitor schemas remain symbol-string based.

### R-030: Provider-Specific Fields Leaking Into Analyzer Through Symbol Registry

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

Angel/Kite-specific token, expiry, strike, or exchange conventions could leak from `Symbol` records into analyzer logic.

Impact:

Analyzer behavior could become tied to provider-specific symbol formats.

Mitigation:

- Keep provider parsing inside mappers/adapters.
- Live data bridge uses `NormalizedMarketTick`.
- Analyzer normalized tick bridge reuses `processTick` instead of duplicating threshold logic.
- Add provider-specific parsing only inside mappers/adapters.

### R-031: Broker-Required Symbols Appearing Before Live Broker Support

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

Universal symbol search can show Angel instruments before user-specific Angel login and live data are implemented.

Impact:

Users could assume an Angel symbol monitor is live when no broker session or Angel WebSocket is connected.

Mitigation:

- Symbol records include `requiresBrokerLogin`.
- Frontend marks broker-required instruments.
- Monitor creation rejects broker-required symbols until broker login/live data support exists.
- Docs clearly state no live Angel connection exists yet.

### R-032: Broker Credential Storage Risk

Severity: Critical

Likelihood: Medium

Status: Open

Description:

Angel login stores sensitive credentials, tokens, or secrets encrypted at rest.

Impact:

Leaked broker credentials or tokens could expose user accounts and create financial risk.

Mitigation:

- Encrypt API key, PIN, optional TOTP secret, JWT, refresh token, and feed token at rest.
- Never return encrypted fields in API responses.
- Do not log credential-like fields or full Angel responses.
- Keep order placement out of scope and force `orderPlacement=false`.

### R-033: Angel Scrip Master URL Availability Failure

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

Angel's public Scrip Master URL may be down, slow, blocked, or return malformed data.

Impact:

Reference symbols may become stale or sync may fail.

Mitigation:

- Validate that the response is an array.
- Keep startup sync disabled by default.
- Optional startup sync is non-fatal and logs warning only.
- Manual sync prints summary counts only.

### R-034: Huge Angel Symbol Sync Load

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

The Angel Scrip Master can contain a large number of instruments. Syncing all rows could increase database load and slow symbol search.

Impact:

MongoDB write pressure, larger indexes, slower symbol lookup, and UI search noise.

Mitigation:

- Phase 2 filters to MCX.
- Default commodity names are restricted to `CRUDEOIL`, `GOLD`, `SILVER`, and `NATURALGAS`.
- Writes are batched.
- TODO: allow full MCX sync only after pagination/search/performance is validated.

### R-035: Reference Sync Confused With Market-Data Permission

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Angel symbols can be visible globally before a user has connected an Angel broker account.

Impact:

Users may think visible Angel symbols are already live-monitorable.

Mitigation:

- Angel symbols are marked `requiresBrokerLogin=true`.
- Monitor creation rejects broker-required symbols until live broker support exists.
- Docs state Scrip Master sync is reference data only.

### R-036: Weak Broker Credential Encryption Key Risk

Severity: Critical

Likelihood: Medium

Status: Open

Description:

Broker credential encryption depends on `BROKER_CREDENTIAL_ENCRYPTION_KEY`.

Impact:

A weak or leaked key can compromise encrypted broker credentials and session tokens.

Mitigation:

- Use a strong 32-byte base64 key in production.
- Do not reuse JWT secrets for broker encryption.
- Do not log or document real encryption keys.
- Rotate credentials if key exposure is suspected.

### R-037: Angel Session Expiry Risk

Severity: Medium

Likelihood: High

Status: Open

Description:

Angel sessions remain active until midnight unless the user logs out.

Impact:

Connections may become stale and require reauthentication or refresh.

Mitigation:

- Store `session.expiresAt`.
- Expose safe status APIs.
- Support reconnect using fresh TOTP or refresh token where available.
- Future live data phase must check session freshness before market-data subscription.

### R-038: Angel Quote Rate Limit Risk

Severity: Medium

Likelihood: High

Status: Open

Description:

Angel Quote API has a documented limit of one request per second and up to 50 symbols per request.

Impact:

Repeated UI refreshes, option-chain experiments, or polling loops could hit provider throttling and degrade the user experience.

Mitigation:

- Phase 4 implements single-symbol quote only.
- Do not call quote API in loops.
- Add provider-level rate limiter before batch quote or option-chain work.

### R-039: Angel Quote Response Field Drift

Severity: Medium

Likelihood: Medium

Status: Open

Description:

Angel may rename, omit, or change fields such as `opnInterest`, `depth`, `symbolToken`, or exchange timestamps.

Impact:

Normalized quote responses may miss fields or fail to map important market data.

Mitigation:

- Keep quote mapper tests for LTP, OHLC, and FULL responses.
- Treat missing optional fields as absent instead of fatal.
- Review provider docs and real payloads before monitor/analyzer integration.

### R-040: REST Quote Polling Used For High-Frequency Monitoring

Severity: High

Likelihood: Medium

Status: Open

Description:

Angel REST quote snapshots are useful for on-demand inspection, but they are not a replacement for provider WebSocket streaming.

Impact:

Using REST polling for live monitoring could hit rate limits, miss fast moves, and produce poor alert quality.

Mitigation:

- Phase 4 is explicitly read-only on-demand quote access.
- Monitor/analyzer integration remains out of scope.
- Use Angel WebSocket FULL mode in a later phase for live monitoring.

### R-041: Quote API Secret/Header Leakage Risk

Severity: Critical

Likelihood: Low

Status: Mitigating

Description:

Angel quote calls require the user's decrypted API key and JWT token in request headers.

Impact:

Logging headers, request objects, or errors carelessly could leak broker secrets or session tokens.

Mitigation:

- Quote service does not log API key, JWT, refresh token, feed token, PIN, or TOTP.
- API responses return only normalized market snapshots.
- Automated tests assert normalized snapshots do not include mocked secrets.

### R-042: Universal Monitor Changes Break Legacy Binance Monitor Creation

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Monitor creation now supports universal `symbolId`, but existing frontend and crypto flows still send plain Binance `symbol` values.

Impact:

If compatibility breaks, users cannot create normal Binance monitors.

Mitigation:

- Keep `symbol` creation path supported.
- Enrich legacy Binance monitors from `Symbol` when possible.
- Fallback to safe Binance defaults when a symbol document is missing.
- Add unit tests for legacy Binance monitor creation.

### R-043: Monitor Symbol Snapshot Becomes Stale

Severity: Medium

Likelihood: Medium

Status: Open

Description:

Monitors store a snapshot of symbol metadata. If the global `Symbol` record changes later, old monitors may retain outdated display name, expiry, instrument type, or token metadata.

Impact:

Future WebSocket/analyzer phases could subscribe using stale metadata.

Mitigation:

- Treat snapshots as intentional historical stability for now.
- Add future reconciliation tooling for expired contracts and symbol metadata refresh.
- Prefer provider/exchange/instrument token identity for live subscriptions.

### R-044: Missing Broker Validation For Provider-Gated Symbols

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Angel MCX symbols require active user-specific BrokerConnection. If monitor creation skips this validation, users could create monitors that cannot receive live data.

Impact:

Users may believe Angel monitoring is active when no broker session exists.

Mitigation:

- Monitor creation checks active broker connection for broker-required symbols.
- The check does not decrypt credentials or call Angel APIs.
- Unit tests cover Angel rejection when broker connection is missing.

### R-045: Provider/Exchange/Token Mismatch In Monitor Snapshots

Severity: High

Likelihood: Medium

Status: Open

Description:

Universal monitors depend on provider, exchange, and instrument token matching the intended market instrument.

Impact:

Future WebSocket subscription could attach to the wrong instrument if snapshot data is incorrect.

Mitigation:

- Store snapshot fields from the authoritative `Symbol` record when `symbolId` is used.
- Use provider/exchange/instrument token indexes.
- Add validation and reconciliation before enabling Angel WebSocket monitoring.

### R-046: Analyzer Still Uses Legacy Symbol Key During Universal Monitor Transition

Severity: High

Likelihood: Medium

Status: Open

Description:

The analyzer still primarily looks up active monitors by symbol string. Universal monitors now store provider-aware market identity, but analyzer provider-key processing is not implemented yet.

Impact:

Angel monitor creation can be stored, but live Angel WebSocket/analyzer integration still needs a provider-aware lookup path before alerts are reliable.

Mitigation:

- Added `getActiveMonitorsByMarketKey` helper for future provider-aware lookup.
- Added `buildMarketSubscriptionKey` helper.
- Keep analyzer refactor for a later phase.

### R-047: Angel WebSocket Auth Failure

Severity: High

Likelihood: Medium

Status: Open

Description:

Angel WebSocket authentication depends on the user's JWT token, feed token, client code, and API key.

Impact:

Expired or invalid tokens can prevent live LTP streaming for Angel monitors.

Mitigation:

- Session manager requires active BrokerConnection.
- Broker session expiry is checked before use.
- Debug route returns safe errors.
- Future phases should refresh or reauth before streaming when needed.

### R-048: Angel WebSocket Token Leakage In Logs

Severity: Critical

Likelihood: Low

Status: Mitigating

Description:

Angel WebSocket headers contain API key, JWT token, feed token, and client code.

Impact:

Logging headers or raw connection options could expose broker credentials/session tokens.

Mitigation:

- Provider logs only user id, exchange, instrument token, action, and safe status.
- Debug APIs return no tokens or encrypted fields.
- Tests avoid real credentials.

### R-049: Angel LTP Binary Parser Offset Bug

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Angel LTP packets are binary and offset-based. Incorrect offsets can produce wrong token, timestamp, or price values.

Impact:

Future analyzer integration could evaluate incorrect market prices.

Mitigation:

- Parser validates minimum packet size.
- Parser tests cover token, mode, exchange type, timestamp, and price scaling.
- Phase 6 only logs normalized ticks; analyzer integration is deferred.

### R-050: Runaway Angel WebSocket Reconnect Loop

Severity: High

Likelihood: Low

Status: Mitigating

Description:

Automatic reconnect loops can overload provider sessions or server resources.

Impact:

Users may hit Angel connection limits or backend resource pressure.

Mitigation:

- Phase 6 does not implement infinite reconnect.
- Closed sessions are reflected through status route.
- Reconnect policy should be designed explicitly in a later phase.

### R-051: Angel WebSocket Connection/Subscription Quota Exceeded

Severity: High

Likelihood: Medium

Status: Open

Description:

Angel limits each client code to 3 concurrent WebSocket connections and 1000 token subscriptions per session.

Impact:

Too many sessions or subscriptions can cause provider rejection.

Mitigation:

- Session manager reuses one Angel WebSocket per YuJiDi user.
- Future work should add per-client-code pooling, quotas, and subscription accounting.

### R-052: Stale Angel Subscriptions Not Cleaned Up

Severity: Medium

Likelihood: Medium

Status: Open

Description:

Debug subscriptions may remain active if a user does not call unsubscribe or if the process loses state.

Impact:

Backend may keep unused WebSocket sessions open until process restart or provider close.

Mitigation:

- Unsubscribe closes the user session when no subscriptions remain.
- Status route exposes active subscriptions.
- Future frontend/session lifecycle should clean up subscriptions automatically.

### R-053: Provider-Aware Subscription Resolves Wrong Symbol/Provider

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

The frontend sends only YuJiDi symbol strings. If backend resolution picks the wrong universal `Symbol` record or ignores provider metadata, it could route a subscription to the wrong provider or instrument token.

Impact:

Users could receive the wrong market data or fail to subscribe to the intended symbol.

Mitigation:

- Phase 6B resolves symbols through `MarketSubscriptionResolver`.
- Resolver requires active statuses only.
- Resolver builds provider-aware subscription keys from provider, exchange, user id where required, and instrument token.
- Unit tests cover Binance and Angel subscription key generation.
- Future tests should cover duplicate symbols across providers and stale symbol metadata.

### R-054: Angel Market Ticks Delivered To Wrong User Socket

Severity: Critical

Likelihood: Low

Status: Mitigating

Description:

Angel market streams are user-specific because they use the user's broker session. If subscription keys do not include user id or delivery checks ignore user-specific keys, one user's Angel ticks could be sent to another user's socket.

Impact:

This would violate user isolation and broker-session boundaries.

Mitigation:

- Angel subscription keys include user id: `ANGEL_ONE:<userId>:MCX:<instrumentToken>`.
- `MARKET_TICK` delivery checks the exact subscription key stored on each frontend socket.
- Frontend never receives Angel credentials, JWTs, feed tokens, or API keys.
- Future WebSocket manager tests should simulate two users subscribed to the same Angel instrument.

### R-055: Partial WebSocket Subscription Failures Confuse Frontend State

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

A mixed subscription request can partially succeed, for example `BTCUSDT` succeeds while an Angel symbol fails because the user has no active BrokerConnection.

Impact:

Frontend state can become inaccurate if it treats the entire update as success or only reads legacy `SUBSCRIPTION_ACK`.

Mitigation:

- Phase 6B emits `SUBSCRIPTION_UPDATE_RESULT` with separate `subscribed`, `unsubscribed`, and `failed` arrays.
- Legacy `SUBSCRIPTION_ACK` remains for compatibility.
- Frontend should prefer `SUBSCRIPTION_UPDATE_RESULT` for new mixed-provider UX.
- Future frontend work should display safe failure messages such as broker-login-required.

### R-056: Angel Tick Triggers Wrong User's Alert

Severity: Critical

Likelihood: Low

Status: Mitigating

Description:

Angel ticks are user-session scoped. If analyzer monitor lookup ignores user id, one user's broker stream could trigger another user's monitor.

Impact:

Users could receive alerts derived from another user's broker session.

Mitigation:

- Phase 7 monitor lookup uses user + provider + exchange + instrument token for Angel ticks.
- Analyzer tests cover user isolation.
- Angel analyzer cache keys include user id.

### R-057: Provider-Aware Analyzer Cache Key Mismatch

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

If analyzer price buffers and monitor cache use different keys, Angel threshold calculations may use one stream while monitor lookup uses another.

Impact:

Alerts can fail to trigger, trigger late, or trigger against the wrong price history.

Mitigation:

- Phase 7 uses `ANGEL_ONE:<userId>:MCX:<instrumentToken>` for Angel price buffer, CVD buffer, and monitor cache.
- Tests assert Angel cache and price buffer use the user-specific key.
- Existing Binance symbol-key path remains for backward compatibility.

### R-058: Duplicate Analyzer Processing For Angel Ticks

Severity: Medium

Likelihood: Medium

Status: Open

Description:

Debug subscriptions, normal frontend subscriptions, or multiple client sockets could cause the same provider tick to reach analyzer more than once.

Impact:

Analyzer work and LLM calls may duplicate, and alerts may be generated sooner than intended unless cooldown catches them.

Mitigation:

- Normal Phase 6B path processes the provider session tick once in `WebSocketManager`.
- Cooldowns limit repeated alert emission.
- Future work should add explicit tick de-duplication by provider/user/token/timestamp if needed.

### R-059: Analyzer Processing Blocks Frontend Tick Delivery

Severity: High

Likelihood: Low

Status: Mitigating

Description:

Analyzer alert generation can involve DB queries, news calls, and LLM calls. If that work blocks live tick delivery, frontend prices can lag.

Impact:

Users may see stale live rates during alert-generation work.

Mitigation:

- Phase 7 sends `MARKET_TICK` to frontend before starting analyzer work.
- Analyzer work runs asynchronously and errors are logged without breaking tick delivery.

### R-060: Illiquid Angel Contracts Are Hard To Validate Live

Severity: Medium

Likelihood: High

Status: Open

Description:

Some far-expiry MCX contracts may not produce frequent ticks, making manual live validation slow.

Impact:

Alert behavior may be hard to confirm from live market movement alone.

Mitigation:

- Phase 7 added unit tests for simulated normalized Angel ticks.
- Future dev-only analyzer simulation endpoint can be added behind an explicit debug flag if needed.

### R-061: Unindexed Symbol Search Causes Slow API Responses

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Universal symbols can grow to thousands or millions of records. Regex scans or unbounded symbol-list APIs can push search latency from milliseconds to seconds.

Impact:

Add-monitor workflows become slow and MongoDB load increases sharply.

Mitigation:

- Phase 9 added normalized search fields and indexed `autocompleteTokens`.
- New search route requires a minimum query length.
- Search returns a capped result set.
- Backfill script can populate search fields for existing records.

### R-062: Frontend Loads Too Many Symbols Into Memory

Severity: High

Likelihood: Medium

Status: Mitigating

Description:

Loading all symbols into add-monitor UI does not scale after Angel MCX and future equity/FNO reference data are added.

Impact:

The browser can become slow, network payloads become large, and modal open time can regress badly.

Mitigation:

- Phase 9 symbol pickers use debounced backend search.
- Frontend add-monitor flows no longer fetch the full symbol universe on open.

### R-063: Stale Frontend Symbol Search Responses Override Newer Searches

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

Fast typing can create overlapping search requests. Older responses may return after newer ones.

Impact:

The user could select from stale results.

Mitigation:

- Phase 9 `useSymbolSearch` uses debounce, `AbortController`, and latest-query checks.

### R-064: Symbol Search Ranking Returns Option Contracts Before Intended Futures/Spot Matches

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

Generic searches such as `gold` or `btc` can match many instruments. Poor ranking could surface distant options above the more likely future, spot, or cash instrument.

Impact:

Users may create monitors for the wrong instrument.

Mitigation:

- Phase 9 ranking boosts exact/prefix matches, active records, configured `searchRank`, and spot/cash/future instruments.
- Tests cover GOLD futures ranking above options.

### R-065: High Symbol Search Request Volume Overloads Backend

Severity: Medium

Likelihood: Medium

Status: Mitigating

Description:

Autocomplete search can generate many requests if not throttled.

Impact:

Backend and MongoDB can see avoidable load spikes.

Mitigation:

- Frontend search is debounced.
- Backend search uses a short LRU cache.
- `/api/symbols/search` has route-level rate limiting.

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
