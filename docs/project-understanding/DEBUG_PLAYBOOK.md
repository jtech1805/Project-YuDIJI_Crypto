# YuJiDi Debug Playbook

## ScoreCheck Not Converting

Start with:

- Frontend: `TradingWorkflow.tsx`, `ScoreCheckPanel.tsx`, `api/scoreChecks.ts`.
- Backend route: `POST /api/score-checks/:id/convert-to-trade-setup`.
- Backend service: `TradeSetupService.convertScoreCheckToTradeSetup`.

Check:

- Is the selected `tradePlanId` sent?
- Is ScoreCheck `READY` or `READY_WITH_STALE_DATA`?
- Is `tradeScoreSnapshotId` present?
- Is ScoreCheck already converted?
- Does selected TradePlan exist, belong to user, and have `status === ACTIVE`?
- Do marketType/tradeStyle/instrumentType match between plan and score?
- Does RiskGovernor return `STOP_TRADING`, `REJECT`, `WAIT`, or approved permission?

## STOP_TRADING Active

Start with:

- `TradePlanService.getTradePlanDashboardSummary`
- `TradePlanRiskState`
- `UserDailyRiskState`
- `RiskStateProjectionService`

Check:

- Selected plan id in frontend.
- `TradePlanRiskState.riskMode` for that exact `tradePlanId`.
- Daily risk state for current `riskBucketKey` and date.
- Recent finalized `TradeResult` projection status.
- Consecutive loss and daily loss limits.
- Whether `reset-risk-lock` was called with plan/daily reset flags.

## Market Snapshot Stale

Start with:

- `MarketSnapshotService`
- `MarketQuoteService`
- `ScoringContextService`
- `scoring-context.controller.ts`

Check:

- Symbol provider/exchange/instrumentToken.
- Whether quote provider returned data.
- Snapshot timestamp/staleness threshold.
- Broker login for Angel symbols.
- Frontend symbol selected versus backend symbol id.

## CVD / OrderBook Missing

Start with:

- `AnalyzerEngine` runtime snapshot via `/api/monitors/debug/engine-state`.
- `websocket.service.ts`.
- Binance/Angel stream subscription status.

Check:

- Is the symbol subscribed?
- Are `aggTrade` ticks arriving for CVD?
- Are depth messages arriving for order book?
- For Angel, does the user have an ACTIVE broker connection and session subscription?
- Did monitor cache contain the symbol/user scope?

## TradePlan Risk Bucket Exists

Start with:

- `TradePlanService.activateTradePlan`
- `TradePlanRiskStateModel` indexes
- `trade-plan.service.test.ts`

Check:

- Current intended rule: risk state must be isolated per `tradePlanId`.
- Unique index should be `userId + tradePlanId`, not broad user/market/style/instrument.
- Activation should not block because another same-scope plan is ACTIVE.
- Existing old DB indexes may need migration if Mongo still has stale unique indexes.

## ActiveTrade Not Receiving Events

Start with:

- `ActiveTradeSubscriptionService`
- `ActiveTradeLiveMonitorService`
- `MarketSubscriptionRouterService`
- `TradeMonitoringService`
- `TradeEventDeliveryService`

Check:

- Is ActiveTrade status `ACTIVE` or `PARTIALLY_EXITED`?
- Does subscription key match provider/exchange/token/user rules?
- Binance keys are public; Angel keys are user-scoped.
- Is tick stale or cooldown-blocked?
- Does price actually cross stop/target/+1R/near-stop rules?
- Was event idempotency key already created?
- Did WebSocket delivery fail after persistence?

## Journal Not Created

Start with:

- `POST /api/trade-results/:id/journal`
- `TradeJournalService.createFromTradeResult`
- `TradeResult`
- `TradeJournal`

Check:

- TradeResult belongs to user and is `FINALIZED`.
- There is not already a journal for that `tradeResultId`.
- Required lifecycle links exist: plan, setup, active trade, symbol snapshot.
- If finalization fails, required reflection fields include entry/exit/outcome quality, followedPlan, and mistakeTags.

