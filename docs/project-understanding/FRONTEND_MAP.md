# YuJiDi Frontend Map

## App Shell And Context

- `App.tsx` defines routes and protected layout.
- `AuthContext.tsx` calls `/api/auth/me`, login/register/logout/refresh flows, and stores current user.
- `WebSocketContext.tsx` opens the authenticated app WebSocket, manages monitor subscriptions, live prices, alerts, and trade events.
- `api/client.ts` configures Axios base URL and cookies.

## TradingWorkflow Page

Main file: `yujidi-client/src/pages/TradingWorkflow.tsx`.

State:

- `plans`: all user TradePlans.
- `selectedPlanId`: controls plan-scoped summary and lifecycle panels.
- `scoreChecks`: global pre-plan candidates.
- `setups`, `activeTrades`, `results`, `journals`: loaded for selected plan.
- `planSummary`: `/api/trade-plans/:id/dashboard-summary`.
- `reviews`: AI review cache keyed by journal id.
- `activeTab`: `setups`, `active`, or `review`.
- modal state for reset risk and restart plan.

Initial load:

```txt
listTradePlans()
listScoreChecks()
select active/first plan
loadSelectedPlanContext(selectedPlanId)
```

Selected plan context calls:

- `GET /api/trade-plans/:id/trade-setups`
- `GET /api/trade-plans/:id/active-trades`
- `GET /api/trade-plans/:id/trade-events`
- `GET /api/trade-plans/:id/trade-results`
- `GET /api/trade-plans/:id/trade-journals`
- `GET /api/trade-plans/:id/dashboard-summary`

## TradePlanPanel

File: `components/trading/TradePlanPanel.tsx`.

Buttons/API:

- New plan -> `POST /api/trade-plans`
- Select plan -> local `selectedPlanId`
- Activate -> `POST /api/trade-plans/:id/activate`
- Update -> `PATCH /api/trade-plans/:id`
- Delete -> `DELETE /api/trade-plans/:id`

Rules:

- DRAFT plans can be activated.
- ACTIVE plans support safe edits only.
- Selected plan controls ScoreCheck conversion and context panels.

## ScoreCheckPanel

File: `components/trading/ScoreCheckPanel.tsx`.

Buttons/API:

- Symbol search -> `GET /api/symbols/search`
- Run -> `POST /api/score-checks`
- Convert -> `POST /api/score-checks/:id/convert-to-trade-setup` with selected plan id.
- Retry rejected setup -> `POST /api/trade-setups/:id/retry-risk-check`
- Delete score -> `DELETE /api/score-checks/:id`

Rules:

- Convert is blocked if selected plan is missing, DRAFT/non-active, scope mismatch, expired, missing snapshot, or already converted.
- If already converted to rejected setup, UI offers retry instead of duplicate conversion.

## TradeSetupPanel

File: `components/trading/TradeSetupPanel.tsx`.

Buttons/API:

- Confirm -> `POST /api/trade-setups/:id/confirm-actual-trade`
- Retry rejected setup -> `POST /api/trade-setups/:id/retry-risk-check`
- Cancel -> `POST /api/trade-setups/:id/cancel`
- Delete -> `DELETE /api/trade-setups/:id`

Rules:

- Only approved setups can be confirmed.
- Rejected setups can retry risk check.
- Executed setups cannot be deleted/cancelled by normal planned-trade controls.

## ActiveTradePanel

File: `components/trading/ActiveTradePanel.tsx`.

Buttons/API:

- Evaluate -> `POST /api/active-trades/:id/evaluate`
- Close -> `POST /api/active-trades/:id/close`
- Cancel active trade -> `POST /api/active-trades/:id/cancel`

Rules:

- Manual evaluation creates deterministic events only.
- Close creates TradeResult and projects risk state.

## TradeReviewPanel

File: `components/trading/TradeReviewPanel.tsx`.

Buttons/API:

- Create journal -> `POST /api/trade-results/:id/journal`
- Update journal -> `PATCH /api/trade-journals/:id`
- Save/finalize -> `POST /api/trade-journals/:id/finalize`
- Generate AI review -> `POST /api/trade-journals/:id/ai-review`

Rules:

- Journal finalization requires complete reflection fields.
- AI review is coaching only and cannot mutate risk/trade data.

## Dashboard Monitor UI

Files: `Dashboard.tsx`, `DashboardSidebar.tsx`, `components/dashboard/AddMonitorModal.tsx`, `AlertFeed.tsx`.

Backend calls:

- monitors -> `/api/monitors`
- symbols -> `/api/monitors/symbols`, `/api/symbols/search`
- alerts -> `/api/alerts`
- details -> `/api/alerts/:id`
- LTP -> `/api/alerts/ltp/:symbol`

WebSocket:

- Sends `UPDATE_SUBSCRIPTIONS`.
- Receives `TICKER_UPDATE`, `NEW_ALERT`, and provider-normalized market tick data.

