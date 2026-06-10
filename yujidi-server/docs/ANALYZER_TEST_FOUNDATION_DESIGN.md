# Analyzer Test Foundation Design

## Feature Name

Analyzer test foundation.

## Business Goal

Protect the core alert trigger behavior before larger provider and market-data refactors.

## Current Behavior

Analyzer threshold decisions are embedded inside `analyzer.service.ts`. The project has backend typechecking but no automated analyzer tests yet.

## Proposed Behavior

Move deterministic analyzer decision rules into small pure helpers and test those helpers with Node's built-in test runner.

This first test layer avoids MongoDB, Binance, WebSocket, news, and LLM dependencies.

## Affected Areas

Backend services:

- `src/services/analyzer.service.ts`
- `src/services/analyzer.rules.ts`

Tests:

- `src/services/analyzer.rules.test.ts`

Docs:

- `docs/TESTING_STRATEGY.md`
- `document/PROJECT_CONTEXT.md`
- `document/PROJECT_MASTER_CONTEXT.md`

## Data Model Changes

None.

## API/WebSocket Changes

None.

## Risks

- Pure unit tests do not prove the full MongoDB/WebSocket/LLM pipeline.
- The first layer should be followed by integration-style tests around `AnalyzerEngine`.

## Rollout Plan

1. Add pure threshold/cache helper functions.
2. Wire analyzer to use the threshold helper.
3. Add Node test scripts.
4. Add unit tests for drop, spike, invalid triggers, and cache snapshot metadata.
5. Run `npm test` and `npm run typecheck`.

## Verification

```bash
npm test
npm run typecheck
```
