You are right to pause here, because the new architecture can look disconnected from the existing template flow if we describe only the new phases separately.

The important point is:

> **The existing template-driven scoring flow does not disappear.**
> The new architecture strengthens what happens behind the template.

Your current business flow remains:

```text
User creates/selects a template
→ template defines what must be monitored
→ user selects an instrument
→ system collects required data
→ evaluators score each condition
→ final score/decision is produced
```

The new architecture changes this into a more explicit, reliable, provider-independent and auditable version.

# 1. Existing flow today

Using your example:

```text
Template:
METAL_SECTOR_INTRADAY

Trading instrument:
TATA_STEEL

Template monitors:
NIFTY
NIFTY_METAL
TATA_STEEL price
VWAP
CVD
order book
volume
market breadth
possibly DXY/global metals
```

The current template may conceptually contain rules such as:

```ts
{
  templateId: "METAL_SECTOR_INTRADAY",

  instruments: [
    "TATA_STEEL",
    "JSW_STEEL",
    "HINDALCO",
    "SAIL"
  ],

  monitoringRules: [
    "NIFTY_TREND",
    "METAL_INDEX_TREND",
    "PRICE_ABOVE_VWAP",
    "CVD_DIRECTION",
    "ORDER_BOOK_IMBALANCE",
    "VOLUME_EXPANSION"
  ]
}
```

When the user selects:

```text
Template = METAL_SECTOR_INTRADAY
Instrument = TATA_STEEL
```

the system gathers data and scores:

```text
NIFTY trend              +1
Metal index trend        +2
Tata Steel above VWAP    +2
CVD positive             +1
Order book bullish       +1
Volume expansion         +1
--------------------------------
Total score               8
```

The problem is that, in a traditional implementation, many things can remain implicit:

```text
Which exact provider supplied NIFTY data?

What happens if that provider fails?

Which version of the VWAP evaluator was used?

What exact rules existed when the score was calculated?

Was an alternate or proxy provider used?

Was data stale?

Were correlated factors counted multiple times?

Can we reproduce the same score one month later?
```

The planned architecture solves those problems without removing the template concept.

# 2. The new high-level flow

The new architecture becomes:

```text
User selects template
        ↓
Template is resolved or compiled into an exact rulebook
        ↓
Rulebook declares required factors
        ↓
For each factor, provider resolution chooses a source
        ↓
Selected provider creates Evidence
        ↓
Evidence is validated, deduplicated and stored
        ↓
Factor inputs are assembled from Evidence
        ↓
Factor evaluators calculate contributions
        ↓
Related factors are grouped and conflicts handled
        ↓
Decision axes are derived
        ↓
Final score, decision and explanation are returned
        ↓
Result is stored for later effectiveness analysis
```

The merged roadmap expects templates, factors, providers, compiled rulebooks, cluster/conflict handling, decision axes and later effectiveness analysis to become connected parts of one system. 

# 3. The core distinction: template vs factor vs Evidence

This is the most important connection.

## Template

A template answers:

> What should be monitored for this trading strategy?

Example:

```text
METAL_SECTOR_INTRADAY
```

It may require:

```text
Market context
Sector context
Instrument context
Execution context
Risk context
```

## Factor

A factor answers:

> What is one measurable thing the template needs?

Examples:

```text
MARKET.NIFTY_TREND
SECTOR.METAL_INDEX_TREND
INSTRUMENT.PRICE_VS_VWAP
INSTRUMENT.CVD_DIRECTION
INSTRUMENT.ORDER_BOOK_IMBALANCE
INSTRUMENT.VOLUME_EXPANSION
MACRO.DXY_TREND
GLOBAL.METALS_SENTIMENT
```

## Evidence

Evidence answers:

> What observation do we currently have for that factor?

Example:

```ts
{
  factorKey: "SECTOR.METAL_INDEX_TREND",

  subject: {
    type: "INDEX",
    key: "NIFTY_METAL"
  },

  value: {
    type: "NUMBER",
    value: 1.25,
    unit: "PERCENT_CHANGE"
  },

  provider: "NSE_MARKET_DATA",

  observedAt:
    "2026-08-02T09:25:00+05:30"
}
```

The template does not contain the market value.

It contains the requirement:

```text
I need SECTOR.METAL_INDEX_TREND.
```

The Evidence layer supplies the observation.

# 4. How the metal-sector template should look conceptually

A future template should become more declarative.

```ts
{
  templateId: "METAL_SECTOR_INTRADAY",
  version: 4,

  marketScope: {
    marketType: "EQUITY",
    exchange: "NSE",
    sector: "METALS"
  },

  supportedInstruments: [
    "TATA_STEEL",
    "JSW_STEEL",
    "HINDALCO",
    "SAIL"
  ],

  factorRequirements: [
    {
      factorKey: "MARKET.NIFTY_TREND",
      role: "CONTEXT"
    },
    {
      factorKey: "SECTOR.METAL_INDEX_TREND",
      role: "CONTEXT"
    },
    {
      factorKey: "INSTRUMENT.PRICE_VS_VWAP",
      role: "DIRECTIONAL"
    },
    {
      factorKey: "INSTRUMENT.CVD_DIRECTION",
      role: "CONFIRMATION"
    },
    {
      factorKey: "INSTRUMENT.ORDER_BOOK_IMBALANCE",
      role: "EXECUTION"
    },
    {
      factorKey: "INSTRUMENT.VOLUME_EXPANSION",
      role: "CONFIRMATION"
    },
    {
      factorKey: "MACRO.DXY_TREND",
      role: "RISK"
    }
  ]
}
```

The template still controls what is monitored.

The difference is that those monitored items now reference stable factor keys instead of ad hoc service logic.

# 5. Phase-by-phase connection to the template flow

## Phase 1 — Evidence foundation

Phase 1 provides the trusted observation layer.

For Tata Steel, possible Evidence records are:

```text
NIFTY trend observation
NIFTY Metal trend observation
Tata Steel price observation
Tata Steel VWAP observation
Tata Steel CVD observation
Tata Steel order-book observation
Tata Steel volume observation
DXY observation
```

Each observation includes:

```text
factor
subject
provider
source
value
unit
observed time
publication time where relevant
confidence
lifecycle state
```

This gives you a provider-independent, append-only and auditable data layer.

## Phase 2 — Factor evaluation

Phase 2 receives one selected Evidence observation and converts it into a safe factor input.

Example:

```ts
{
  factorKey: "INSTRUMENT.PRICE_VS_VWAP",

  subject: {
    type: "INSTRUMENT",
    key: "TATA_STEEL"
  },

  value: {
    price: 158.40,
    vwap: 157.80,
    deviationPercent: 0.38
  }
}
```

An evaluator may return:

```ts
{
  outcome: "PASS",

  contribution: {
    points: 2,
    minimumPoints: -2,
    maximumPoints: 2
  },

  reasonCodes: [
    "PRICE_ABOVE_VWAP"
  ]
}
```

Phase 2 currently proves this architecture for a single factor. It covers input assembly, evaluator execution, contribution aggregation, normalization and semantic classification.

## Phase 3 — Provider selection and execution

Phase 3 determines where each factor’s Evidence comes from.

Example factor:

```text
SECTOR.METAL_INDEX_TREND
```

Provider order:

```text
1. NSE_PRIMARY_MARKET_DATA
2. BROKER_MARKET_DATA
3. APPROVED_INDEX_PROXY
```

Health:

```text
NSE_PRIMARY_MARKET_DATA = UNAVAILABLE
BROKER_MARKET_DATA      = HEALTHY
APPROVED_INDEX_PROXY    = HEALTHY
```

Resolution:

```text
Selected provider:
BROKER_MARKET_DATA

Status:
FALLBACK_USED

Warning:
Preferred NSE provider unavailable
```

Only the broker provider executes.

The resulting Evidence enters Phase 1.

Phase 3 does not score the factor. It only chooses and executes the approved source.

## Phase 4 — Compiled rulebooks

Phase 4 connects the template to exact factor/evaluator/provider versions.

This is the phase that should make the new architecture feel connected to your existing template flow.

Today, a template may conceptually say:

```text
Monitor VWAP.
```

A compiled rulebook will say:

```text
Use factor INSTRUMENT.PRICE_VS_VWAP version 2
Use evaluator PRICE_VS_VWAP_EVALUATOR version 3
Use evaluator configuration version 5
Use provider binding policy VWAP_MARKET_PROVIDER_POLICY version 2
Use weight 1.5
Use aggregation policy METAL_INTRADAY_AGGREGATION version 4
```

The roadmap defines compiled rulebooks as an optional deterministic execution path that records exact resolved factor/provider/weight bindings. 

Example:

```ts
{
  rulebookId: "METAL_SECTOR_INTRADAY_COMPILED",
  rulebookVersion: 1,

  sourceTemplateId: "METAL_SECTOR_INTRADAY",
  sourceTemplateVersion: 4,

  factorBindings: [
    {
      factorKey: "MARKET.NIFTY_TREND",
      factorVersion: 1,

      evaluatorId:
        "NIFTY_TREND_EVALUATOR",

      evaluatorVersion: 2,
      configurationVersion: 3,

      weight: 1.5,

      providerBindingId:
        "NIFTY_MARKET_PROVIDER_BINDING",

      providerResolutionPolicyId:
        "NIFTY_PROVIDER_RESOLUTION_POLICY",

      providerResolutionPolicyVersion: 1
    },
    {
      factorKey:
        "SECTOR.METAL_INDEX_TREND",

      factorVersion: 1,

      evaluatorId:
        "METAL_INDEX_TREND_EVALUATOR",

      evaluatorVersion: 1,
      configurationVersion: 2,

      weight: 2
    },
    {
      factorKey:
        "INSTRUMENT.PRICE_VS_VWAP",

      factorVersion: 2,

      evaluatorId:
        "PRICE_VS_VWAP_EVALUATOR",

      evaluatorVersion: 3,
      configurationVersion: 5,

      weight: 2
    }
  ]
}
```

The compiled rulebook is essentially:

> The executable, version-frozen form of the user’s template.

# 6. What happens when the user selects the template

Assume:

```text
User:
Jigar

Template:
METAL_SECTOR_INTRADAY

Instrument:
TATA_STEEL

Trade side under consideration:
LONG

Time:
09:32 IST
```

## Step 1 — Start a score check

The frontend calls a score-check endpoint.

Proposed API:

```http
POST /api/score-checks
```

Request:

```json
{
  "templateId": "METAL_SECTOR_INTRADAY",
  "instrumentId": "TATA_STEEL",
  "tradeDirection": "LONG",
  "timeframe": "INTRADAY"
}
```

The backend resolves:

```text
active template version
or
compiled rulebook version
```

Response may initially be:

```json
{
  "scoreCheckId": "sc_20260802_001",
  "status": "COLLECTING_EVIDENCE",
  "templateId": "METAL_SECTOR_INTRADAY",
  "templateVersion": 4,
  "rulebookId": "METAL_SECTOR_INTRADAY_COMPILED",
  "rulebookVersion": 1
}
```

# 7. Rulebook expands required data

The rulebook determines the full factor requirement list.

```text
MARKET.NIFTY_TREND
SECTOR.METAL_INDEX_TREND
INSTRUMENT.PRICE_VS_VWAP
INSTRUMENT.CVD_DIRECTION
INSTRUMENT.ORDER_BOOK_IMBALANCE
INSTRUMENT.VOLUME_EXPANSION
MACRO.DXY_TREND
```

The system also resolves each factor’s subject.

```text
MARKET.NIFTY_TREND
subject = NIFTY_50

SECTOR.METAL_INDEX_TREND
subject = NIFTY_METAL

INSTRUMENT.PRICE_VS_VWAP
subject = TATA_STEEL

INSTRUMENT.CVD_DIRECTION
subject = TATA_STEEL

MACRO.DXY_TREND
subject = DXY
```

This subject-resolution step is important because the template may define factor roles abstractly, while the score-check instance provides the concrete instrument.

# 8. Provider resolution for each factor

Each factor may have its own provider binding.

## NIFTY trend

```text
Preferred:
NSE_MARKET_DATA

Fallback:
BROKER_INDEX_FEED
```

## Tata Steel order book

```text
Preferred:
USER_CONNECTED_BROKER

No public fallback
```

## DXY

```text
Preferred:
FRED or approved market provider

Fallback:
approved proxy
```

Phase 3A–3D runs separately for each factor/provider requirement.

Example output:

```ts
[
  {
    factorKey: "MARKET.NIFTY_TREND",
    selectedProviderKey: "NSE_MARKET_DATA",
    resolutionStatus: "RESOLVED"
  },
  {
    factorKey: "SECTOR.METAL_INDEX_TREND",
    selectedProviderKey: "BROKER_INDEX_FEED",
    resolutionStatus: "FALLBACK_USED"
  },
  {
    factorKey: "INSTRUMENT.ORDER_BOOK_IMBALANCE",
    selectedProviderKey: "ANGEL_ONE_USER_FEED",
    resolutionStatus: "RESOLVED"
  },
  {
    factorKey: "MACRO.DXY_TREND",
    selectedProviderKey: "DXY_PROXY_PROVIDER",
    resolutionStatus: "PROXY_USED"
  }
]
```

# 9. Provider execution and Evidence ingestion

Phase 3E executes each already-selected provider runner.

Example:

```text
NSE provider runner
→ fetches NIFTY data

Broker provider runner
→ fetches NIFTY Metal and Tata Steel order book

Internal calculator
→ calculates VWAP/CVD from market stream

DXY provider
→ fetches DXY observation
```

Each becomes Evidence.

```ts
[
  {
    evidenceId: "ev_nifty_001",
    factorKey: "MARKET.NIFTY_TREND",
    subjectKey: "NIFTY_50",
    value: "POSITIVE",
    provider: "NSE"
  },
  {
    evidenceId: "ev_metal_001",
    factorKey: "SECTOR.METAL_INDEX_TREND",
    subjectKey: "NIFTY_METAL",
    value: 1.15,
    unit: "PERCENT_CHANGE",
    provider: "BROKER_INDEX_FEED"
  },
  {
    evidenceId: "ev_vwap_001",
    factorKey: "INSTRUMENT.PRICE_VS_VWAP",
    subjectKey: "TATA_STEEL",
    value: 0.38,
    unit: "PERCENT_ABOVE_VWAP"
  }
]
```

# 10. Evidence bundle/read side

For one score-check execution, the system needs a complete factor Evidence bundle.

Example:

```ts
{
  scoreCheckId: "sc_20260802_001",

  asOf: "2026-08-02T09:32:10+05:30",

  factors: {
    "MARKET.NIFTY_TREND":
      "ev_nifty_001",

    "SECTOR.METAL_INDEX_TREND":
      "ev_metal_001",

    "INSTRUMENT.PRICE_VS_VWAP":
      "ev_vwap_001",

    "INSTRUMENT.CVD_DIRECTION":
      "ev_cvd_001",

    "INSTRUMENT.ORDER_BOOK_IMBALANCE":
      "ev_orderbook_001"
  }
}
```

For each factor, Phase 2B and 2C verify:

```text
factor compatibility
subject compatibility
unit compatibility
freshness
lifecycle activity
source authority
```

If multiple Evidence observations exist, Phase 2C selects the authoritative one.

# 11. Factor evaluation

Each selected Evidence record is turned into an assembled factor input.

## NIFTY trend

```text
NIFTY above VWAP
NIFTY short-term trend positive
```

Evaluator result:

```text
PASS
+1
```

## Metal index trend

```text
NIFTY Metal +1.15%
above sector VWAP
```

Result:

```text
PASS
+2
```

## Tata Steel price vs VWAP

```text
Price 0.38% above VWAP
```

Result:

```text
PASS
+2
```

## CVD

```text
CVD slightly positive
```

Result:

```text
PASS
+1
```

## Order book

```text
Buy-side imbalance 1.7x
```

Result:

```text
PASS
+1
```

## Volume

```text
Volume only 0.9x average
```

Result:

```text
NEUTRAL
0
```

## DXY

```text
DXY strong upward move
```

Potential result:

```text
RISK warning
or
negative macro contribution
```

The exact semantic model for risk-only and veto factors is one of the remaining reconciliation decisions.

# 12. Phase 6 — Cluster and conflict engine

The merged roadmap places cluster/conflict handling and three-axis decision derivation after real macro adapters are available. 

This is important because factors can overlap.

Example:

```text
Price above VWAP
CVD positive
Order-book bullish
Volume expanding
Momentum positive
```

These may all be partially correlated execution/technical signals.

Without cluster control:

```text
VWAP               +2
CVD                +2
Order book         +2
Volume             +2
Momentum           +2
----------------------
Technical subtotal +10
```

This can overcount one underlying market move.

The roadmap’s cluster-collapse rule expects correlated signals to be grouped so combined influence is controlled rather than blindly summed. 

Example:

```text
Technical execution cluster:
VWAP +2
CVD +1
Order book +1
Volume 0

Cluster result:
maximum or bounded combined contribution = +2
```

Meanwhile:

```text
Market context cluster:
NIFTY +1

Sector cluster:
NIFTY Metal +2

Macro risk:
DXY -1
```

# 13. Three-axis decision

The future decision is not only a single total score.

The roadmap proposes decision dimensions such as:

```text
contextBias
executionReadiness
riskState
evidenceAgreement
```

Example:

```ts
{
  contextBias: "POSITIVE",

  executionReadiness: "READY",

  riskState: "ELEVATED",

  evidenceAgreement: "MOSTLY_ALIGNED"
}
```

Interpretation:

```text
Market and sector support Tata Steel long.
Execution data supports entry.
But DXY/global risk increases caution.
```

This is more useful than only:

```text
Score = 8
```

The final product could still show a score, but it also explains the structure behind the score.

# 14. Final score-check output

A future score-check response could look like:

```json
{
  "scoreCheckId": "sc_20260802_001",

  "template": {
    "templateId": "METAL_SECTOR_INTRADAY",
    "templateVersion": 4,
    "rulebookId": "METAL_SECTOR_INTRADAY_COMPILED",
    "rulebookVersion": 1
  },

  "instrument": {
    "symbol": "TATA_STEEL",
    "exchange": "NSE"
  },

  "status": "COMPLETED",

  "score": {
    "raw": 5,
    "normalized": 72
  },

  "decision": {
    "contextBias": "POSITIVE",
    "executionReadiness": "READY",
    "riskState": "ELEVATED",
    "evidenceAgreement": "MOSTLY_ALIGNED"
  },

  "factorResults": [
    {
      "factorKey": "MARKET.NIFTY_TREND",
      "outcome": "PASS",
      "points": 1
    },
    {
      "factorKey": "SECTOR.METAL_INDEX_TREND",
      "outcome": "PASS",
      "points": 2,
      "providerResolutionStatus": "FALLBACK_USED"
    },
    {
      "factorKey": "INSTRUMENT.PRICE_VS_VWAP",
      "outcome": "PASS",
      "points": 2
    },
    {
      "factorKey": "INSTRUMENT.CVD_DIRECTION",
      "outcome": "PASS",
      "points": 1
    },
    {
      "factorKey": "INSTRUMENT.VOLUME_EXPANSION",
      "outcome": "NEUTRAL",
      "points": 0
    }
  ],

  "warnings": [
    "Nifty Metal data came from a fallback provider.",
    "DXY risk is elevated."
  ],

  "explanation": {
    "positive": [
      "Nifty trend is positive.",
      "Metal index is outperforming.",
      "Tata Steel is trading above VWAP.",
      "CVD and order book support buyers."
    ],
    "negative": [
      "Volume expansion is not confirmed.",
      "DXY is strengthening."
    ]
  }
}
```

# 15. Main data touchpoints

## Template storage

Stores:

```text
template identity
template version
supported market/instruments
factor requirements
weights
sections
thresholds
permissions
status: DRAFT/ACTIVE
```

## Compiled rulebook storage

Stores:

```text
source template version
factor versions
evaluator versions
configuration versions
provider-binding versions
resolution-policy versions
aggregation policy
normalization policy
decision-band policy
```

## Provider registry/catalog

Stores or defines:

```text
provider identity
provider type
supported factors
enabled status
authority metadata
cost metadata
```

## Provider health data

Stores or receives:

```text
attempt count
success count
failure count
consecutive failures
latency
latest success
operator disablement
```

Currently Phase 3B accepts aggregated telemetry supplied by the caller; automatic telemetry materialization remains future work.

## Evidence storage

Stores append-only:

```text
factor
subject
value
unit
provider
source
observedAt
publishedAt
confidence
supersession/revocation lifecycle
deduplication identity
```

## Score-check storage

Should eventually store:

```text
user
template version
rulebook version
instrument
asOf
Evidence IDs used
factor results
cluster results
decision axes
score
warnings
provider-resolution lineage
```

## Trade-result storage

Stores:

```text
entry
exit
direction
quantity
fees
P&L
result
```

Phase 9 later joins score checks with trade results to calculate effectiveness and propose draft weight changes. 

# 16. API surface required

The exact existing API names need repository inspection, but conceptually the system needs the following API groups.

## A. Template APIs

```http
POST   /api/scoring-templates
GET    /api/scoring-templates
GET    /api/scoring-templates/:templateId
PATCH  /api/scoring-templates/:templateId
POST   /api/scoring-templates/:templateId/activate
POST   /api/scoring-templates/:templateId/archive
```

Create template request:

```json
{
  "name": "Metal Sector Intraday",
  "marketType": "EQUITY",
  "exchange": "NSE",
  "instrumentSelection": {
    "mode": "SECTOR",
    "sector": "METALS"
  },
  "factorRequirements": [
    {
      "factorKey": "MARKET.NIFTY_TREND",
      "weight": 1
    },
    {
      "factorKey": "SECTOR.METAL_INDEX_TREND",
      "weight": 2
    },
    {
      "factorKey": "INSTRUMENT.PRICE_VS_VWAP",
      "weight": 2
    }
  ]
}
```

## B. Factor Registry APIs

These may initially be read-only.

```http
GET /api/factors
GET /api/factors/:factorKey
```

Response:

```json
{
  "factorKey": "INSTRUMENT.PRICE_VS_VWAP",
  "valueType": "NUMBER",
  "subjectType": "INSTRUMENT",
  "allowedUnits": ["PERCENT"],
  "freshnessPolicy": {
    "maximumAgeMs": 5000
  }
}
```

## C. Template compatibility/compile APIs

```http
POST /api/scoring-templates/:templateId/validate
POST /api/scoring-templates/:templateId/compile
GET  /api/scoring-templates/:templateId/compiled-rulebooks
GET  /api/compiled-rulebooks/:rulebookId
```

Compile request:

```json
{
  "templateVersion": 4
}
```

Compile response:

```json
{
  "rulebookId": "rb_metal_intraday_v1",
  "rulebookVersion": 1,
  "status": "COMPILED",
  "factorBindings": 7
}
```

Phase 4 in the roadmap introduces the compiler, compatibility service and compiled rulebook repository. 

## D. Provider health/admin APIs

These should likely be protected/admin-only.

```http
GET  /api/providers
GET  /api/providers/:providerKey/health
POST /api/providers/:providerKey/health/assess
POST /api/providers/:providerKey/disable
POST /api/providers/:providerKey/enable
```

However, your current Phase 3 implementation intentionally has no API or runtime wiring. These are future orchestration endpoints, not yet approved.

## E. Provider resolution preview API

Useful for debugging and template validation:

```http
POST /api/provider-resolution/preview
```

Request:

```json
{
  "factorKey": "SECTOR.METAL_INDEX_TREND",
  "bindingId": "METAL_INDEX_PROVIDER_BINDING",
  "policyId": "METAL_INDEX_RESOLUTION_POLICY"
}
```

Response:

```json
{
  "requestedProviderKey": "NSE_MARKET_DATA",
  "selectedProviderKey": "BROKER_INDEX_FEED",
  "resolutionStatus": "FALLBACK_USED",
  "warnings": [
    "PREFERRED_PROVIDER_UNAVAILABLE",
    "FALLBACK_PROVIDER_SELECTED"
  ]
}
```

This should initially be internal/admin-only, not a public trading API.

## F. Score-check APIs

This is the primary user flow.

```http
POST /api/score-checks
GET  /api/score-checks/:scoreCheckId
GET  /api/score-checks
POST /api/score-checks/:scoreCheckId/refresh
```

Start request:

```json
{
  "templateId": "METAL_SECTOR_INTRADAY",
  "instrumentId": "TATA_STEEL",
  "tradeDirection": "LONG"
}
```

The backend should:

```text
load template/rulebook
resolve subjects
collect required Evidence
evaluate factors
derive decision
persist ScoreCheck
return result
```

## G. Evidence debugging APIs

Likely internal/admin-only:

```http
GET /api/evidence
GET /api/evidence/:evidenceId
GET /api/evidence/factors/:factorKey
GET /api/evidence/subjects/:subjectType/:subjectKey
```

These should not expose provider credentials or unsafe raw payloads.

## H. Decision explanation API

After Phase 6:

```http
GET /api/score-checks/:scoreCheckId/explanation
```

Response:

```json
{
  "contextBias": "POSITIVE",
  "executionReadiness": "READY",
  "riskState": "ELEVATED",
  "evidenceAgreement": "MOSTLY_ALIGNED",
  "positiveFactors": [],
  "negativeFactors": [],
  "conflicts": [],
  "providerWarnings": []
}
```

The roadmap plans an `explain_current_decision` MCP tool at the same point because decision axes are not meaningful before the cluster/conflict engine exists. 

## I. Event/document APIs

After Phase 7:

```http
POST /api/events/ingest
GET  /api/events
GET  /api/events/:eventId/classification
POST /api/events/:eventId/review
```

These support news/event classification, but event output remains read-only until safety and accuracy thresholds are satisfied. 

## J. RAG template drafting API

After Phase 8:

```http
POST /api/scoring-templates/draft-from-text
```

Request:

```json
{
  "description": "I trade Tata Steel intraday. I monitor Nifty, Nifty Metal, VWAP, CVD, order book imbalance, volume and DXY."
}
```

The retriever/drafter/validator flow produces only a `DRAFT`, never an active template automatically. 

## K. Effectiveness APIs

After Phase 9:

```http
GET  /api/templates/:templateId/effectiveness
GET  /api/factors/:factorKey/effectiveness
POST /api/templates/:templateId/weight-proposals
```

Weight proposals should create only a new draft version and must never mutate an active template automatically. 

# 17. Important orchestration service still needed

The phases built so far are bounded domain services.

You will eventually need one application-level orchestrator, conceptually:

```text
ScoreCheckExecutionService
```

It would coordinate:

```text
load compiled rulebook
resolve factor subjects
resolve providers
execute providers
collect Evidence
assemble inputs
execute evaluators
aggregate factors
run cluster/conflict engine
derive decision
persist score check
build response
```

This orchestrator must stay thin.

It should not contain:

```text
provider-selection rules
health calculations
factor calculations
aggregation formulas
normalization formulas
decision-band formulas
```

Those responsibilities stay in the phase-specific services already built.

Conceptual pseudocode:

```ts
async executeScoreCheck(request) {
  const rulebook =
    await compiledRulebookRepository.getActiveForTemplate(
      request.templateId
    );

  const factorInstances =
    subjectResolver.resolve({
      rulebook,
      instrumentId: request.instrumentId
    });

  const evidenceBundle = await evidenceCoordinator.collect({
    factorInstances,
    rulebook,
    asOf: request.asOf
  });

  const factorResults = [];

  for (const factorBinding of rulebook.factorBindings) {
    const input =
      factorInputAssemblyService.assemble({
        factorBinding,
        evidenceBundle
      });

    const result =
      deterministicFactorPipeline.execute({
        input,
        evaluatorPlan:
          factorBinding.evaluatorPlan,
        aggregationPolicy:
          factorBinding.aggregationPolicy,
        normalizationPolicy:
          factorBinding.normalizationPolicy,
        decisionBandPolicy:
          factorBinding.decisionBandPolicy
      });

    factorResults.push(result);
  }

  const clustered =
    clusterConflictEngine.evaluate({
      factorResults,
      clusterPolicy: rulebook.clusterPolicy
    });

  const decision =
    decisionDerivationService.derive({
      clustered,
      decisionPolicy: rulebook.decisionPolicy
    });

  return scoreCheckRepository.save({
    request,
    rulebook,
    evidenceBundle,
    factorResults,
    clustered,
    decision
  });
}
```

# 18. Final mental model

Your template remains the product-level starting point.

The new system should be understood like this:

```text
Template
“What should be monitored?”
        ↓
Compiled rulebook
“Which exact versions and rules should execute?”
        ↓
Factor requirements
“What measurable observations are required?”
        ↓
Provider resolution
“Where should each observation come from?”
        ↓
Evidence
“What was actually observed?”
        ↓
Factor evaluators
“What does each observation mean?”
        ↓
Aggregation and normalization
“How strong is each factor result?”
        ↓
Cluster/conflict engine
“Are we double-counting or seeing disagreement?”
        ↓
Decision axes
“Is context favorable, execution ready, and risk acceptable?”
        ↓
Score check
“Should the trader consider this setup, and why?”
```

For your Tata Steel example:

```text
Metal Sector Intraday template selected
→ Tata Steel chosen
→ compiled rulebook loads
→ Nifty, Metal index, VWAP, CVD, order book, volume and DXY factors resolved
→ approved providers selected
→ Evidence collected
→ each factor evaluated
→ correlated technical signals collapsed
→ macro/sector/technical conflicts detected
→ contextBias, executionReadiness and riskState derived
→ final score and explanation returned
```

The next design step should be to freeze this orchestration model before Phase 4, because compiled rulebooks need to know exactly what they are compiling for: a concrete score-check execution flow, not just isolated factor contracts.
