# Startup Resilience Design

## Feature Name

Startup resilience for external dependency failures.

## Business Goal

Keep the YuJiDi backend available during temporary DNS or external API failures.

The user problem:

If AWS DNS, MongoDB Atlas SRV lookup, Binance, or another external dependency briefly fails, the backend can crash or restart-loop. Users then lose dashboard/API availability even when the failure is temporary.

## Current Behavior

Current startup flow in `src/server.ts`:

```txt
load env
  -> mongoose.connect(MONGO_URI)
  -> app.listen(PORT)
  -> sharedWebsocketManager.initialize(server)
  -> syncBinanceSymbols()
```

Current failure behavior:

- If MongoDB connection fails, `startServer()` rejects and process exits.
- If Binance symbol sync fails, `startServer()` rejects and process exits.
- There is no retry/backoff around MongoDB connection.
- There is no non-fatal retry loop around Binance symbol sync.

This is risky because deployment logs have shown DNS resolver instability. YuJiDi depends on DNS for MongoDB Atlas and Binance.

## Proposed Behavior

MongoDB remains required before serving traffic.

New behavior:

```txt
load env
  -> connect MongoDB with retry/backoff
  -> start HTTP server
  -> initialize WebSocket manager
  -> run Binance symbol sync as non-fatal background task with retry
```

Rules:

- MongoDB startup connection should retry before failing the process.
- Binance symbol sync failure should not crash the server.
- Binance sync should retry in the background.
- Logs should clearly show attempt number, delay, and error.
- Existing route contracts should not change.

## Affected Areas

Backend models:

- None.

Backend services:

- `src/services/binance.service.ts` may remain unchanged.
- `src/server.ts` will orchestrate retry behavior.

Routes/controllers:

- None.

Frontend pages/components:

- None.

WebSocket contracts:

- None.

LLM prompts/schema:

- None.

Docs:

- `PROJECT_MASTER_CONTEXT.md`
- `PROJECT_CONTEXT.md`
- `RISK_REGISTER.md`
- this design doc

Tests:

- No automated test suite exists yet.
- Verify through `npm run typecheck`.

## Data Model Changes

None.

No database migrations are required.

## API/WebSocket Changes

None.

## Risks

Security:

- No new secrets or external services.

Data:

- If Binance symbol sync fails for a while, symbol list may be stale.
- Existing symbols remain available from MongoDB.

Performance:

- Retry loops must use bounded delays and avoid tight loops.

Operational:

- Server may start with stale symbol data if Binance is unavailable.
- This is preferred over total server crash.

Product:

- New users may not see newly listed symbols until sync succeeds.

## Rollout Plan

Step 1:

Add small retry helper functions in `src/server.ts`.

Step 2:

Wrap MongoDB connection in retry/backoff.

Step 3:

Move Binance symbol sync into a non-fatal background retry loop after the server starts.

Step 4:

Add structured logs for success/failure/retry.

Step 5:

Run backend typecheck.

Step 6:

Update context/risk docs.

## Verification

Run:

```bash
cd yujidi-server
npm run typecheck
```

Manual verification:

- Start backend normally.
- Confirm MongoDB connects.
- Confirm HTTP server starts.
- Confirm WebSocket manager initializes.
- Confirm Binance symbol sync success is logged.
- Simulate Binance failure if practical by temporarily blocking network or changing URL in a local-only test branch.
- Confirm server does not exit when Binance sync fails.
