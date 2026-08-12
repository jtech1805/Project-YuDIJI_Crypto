# YuJiDi — Scoring Template Resource Snapshot Spec

## Final Concept

ScoringTemplate = base scoring model + resource configuration + allowed tradable symbols + section overrides + snapshot policy.

ScoreCheck = selected scoringTemplateId + selected tradable symbol + trade idea.

ScoreCheck creates temporary expirable ScoreCheckSnapshot for explanation.

If ScoreCheck is converted to TradeSetup, backend creates compact permanent TradeScoreSnapshot.

## Final Flow

1. User creates ScoringTemplate.
2. User selects base model, market regime resources, sector resource, related resources, and allowed tradable symbols.
3. User activates template.
4. User runs ScoreCheck using selected template and one allowed symbol.
5. Backend validates symbol belongs to template.
6. Backend resolves resources:
   - PRIMARY_SYMBOL
   - MARKET_INDEX
   - BANK_INDEX
   - VOLATILITY_INDEX
   - SECTOR_INDEX
   - RELATED_SYMBOLS
7. Backend reads live MarketSnapshotService summaries.
8. Backend calculates score from selected template.
9. Backend stores temporary ScoreCheckSnapshot with TTL.
10. Frontend shows explanation.
11. If converted, compact permanent TradeScoreSnapshot is created.
12. RiskGovernor remains final authority.

## Non-Negotiables

- No arbitrary user scoring code.
- No AI scoring.
- No order placement.
- No raw provider payload storage.
- No raw tick storage.
- No large candle/orderbook buffers.
- No historical ScoreCheck recalculation.
- RiskGovernor remains final authority.
- Existing Binance, Angel MCX, NSE, NFO must not break.
- Existing tests must pass.

## Required Objects

### ScoringTemplate

Must support:

- resourceConfig
- allowedTradableSymbols
- sectionOverrides
- snapshotPolicy

### ScoreCheckSnapshot

Temporary TTL document.

Stores:

- scoreCheckId
- userId
- scoringTemplateId/name/version
- selectedSymbol
- resolvedResources
- resourceSnapshots summary only
- sectionBreakdown
- finalScore
- permission
- scoreStatus
- dataConfidence
- warnings
- blockers
- expiresAt

TTL index:

expiresAt with expireAfterSeconds: 0

### TradeScoreSnapshot

Permanent compact copy only when ScoreCheck converts to TradeSetup.

## Phase Order

18C-1: Template Resource Configuration + Allowed Tradable Symbols  
18C-2: ScoreCheck Template Symbol Validation  
18C-3: Multi-Symbol Resource Snapshot Builder  
18C-4: Expirable ScoreCheckSnapshot  
18C-5: Score Explanation Panel UI  
18C-6: Permanent TradeScoreSnapshot on Conversion  
18C-7: Template Monitoring Warmup  
18C-8: Score Calibration Foundation  

## MVP Scope

Implement 18C-1 to 18C-6 first.

## Verification Every Phase

Backend:
npm run typecheck
npm test
git diff --check

Frontend:
npm run build