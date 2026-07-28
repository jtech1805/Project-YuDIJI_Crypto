# YuJiDi Architecture Guardrails

## Dependency Direction

Allowed backend direction:

```txt
routes -> controllers -> services -> models
services -> ports/integrations/utils/types
models -> types only
controllers -> schemas/services/errors only
```

Frontend direction:

```txt
pages -> components -> api/hooks/types
components -> api only through passed handlers where practical
api -> client/types
contexts -> api and shared types
```

## Forbidden / Risky Imports

- Models should not import controllers, routes, services, or Express.
- Controllers should not contain domain-heavy business logic.
- Routes should not directly mutate models except small validation/middleware concerns.
- Frontend components should not read backend `.env` or secrets.
- LLM providers must not be imported directly into domain services except through existing provider/factory seams.
- Broker credential fields must not be imported into UI types or response DTOs.
- AnalyzerEngine should not import trade workflow services.
- Trade workflow services should not mutate AnalyzerEngine state.

## Business Rules

- RiskGovernor is final authority for managed trade permission.
- ScoreCheck cannot mutate risk state.
- TradeSetup conversion must use the selected TradePlan id.
- TradePlanRiskState is plan-scoped; user-owned queries must include `userId`.
- TradeResult is the only normal source of risk-state projection.
- TradeEvent does not close trades and does not mutate risk state.
- Journal does not mutate TradeResult, ActiveTrade, or risk state.
- AI Review is post-trade coaching only.
- AI cannot score, approve, reject, place orders, calculate official P&L, or change risk mode.
- Broker login is user-specific; global symbols do not imply live-data permission.
- Angel market-data subscriptions are user-scoped.
- Binance market-data subscriptions are public/global.
- Backward-compatible fields such as `dropPercentage` must not be removed without migration.

## Data Ownership

- User-owned records must always be scoped by authenticated `userId`.
- Global reference data: `Symbol`, provider scrip master rows.
- User-owned data: monitors, alerts, broker connections, score checks, trade plans, setups, active trades, events, results, journals, AI explanations, chat sessions.
- Snapshots preserve historical symbol/trade facts and should not be retroactively rewritten for normal display changes.

## Runtime Boundaries

- Analyzer state is in memory; do not assume multi-instance safety.
- WebSocket subscriptions must be reference-counted/provider-aware.
- External provider failures should be non-fatal when possible.
- Do not log secrets, JWTs, cookies, broker tokens, raw credential payloads, or `.env` values.

## Testing Guardrails

- Deterministic domain services should have service-level tests.
- Do not call real Angel/Binance/Groq APIs in tests.
- Use pure helpers for mapper/parser/tokenizer tests.
- Any change to risk, score, trade lifecycle, or ownership must add focused regression tests.

