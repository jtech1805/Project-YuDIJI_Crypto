# ADR-064: Current User Role Authority and Composed Caller Cancellation

Status: ACCEPTED

Date: 2026-08-11

Phase: Track C-E0

## Context

Track C-D proves a governed, default-off, shadow-only RAG runtime. C-E requires an authenticated internal application boundary, but existing JWT authentication establishes only a current user ID. The User authority previously had no closed INTERNAL or ADMIN role, and the runtime deadline did not accept upstream HTTP caller cancellation.

Internal access cannot safely be inferred from email, headers, request material, environment allowlists, or stale JWT claims. Caller disconnect cancellation must compose with, rather than replace, the C-D3 request deadline.

## Decision

### Current application-role authority

The current User record is authoritative for the closed, multi-valued role vocabulary:

```text
USER
INTERNAL
ADMIN
```

Roles are non-empty, unique, and canonically ordered as USER, INTERNAL, ADMIN. USER remains present. New users receive the storage default `["USER"]`. A legacy record with no role field resolves at read time as `["USER"]` without a bulk migration. The Mongoose storage default may safely materialize `["USER"]` when that legacy User document is subsequently written through the model; authorization reads themselves perform no write. Malformed stored roles fail closed.

### Authentication and authorization separation

JWTs remain identity-only and continue to establish `sub` and token type. JWT role claims, if supplied, are non-authoritative. Authorization rereads the current User authority on every protected request, so role revocation affects the next request even when the same JWT remains valid.

`requireAuth` continues to populate `req.user.id`. A separate reusable role middleware resolves a detached application principal. USER alone is unauthorized for future internal routes; INTERNAL and ADMIN are authorized. Application roles authorize route access only and cannot bypass feature flags, kill switch, exact publication binding, budgets, concurrency, circuits, deadlines, or rollout mode.

Role assignment and revocation have no public application API in this phase. No automatic privileged bootstrap exists.

### Caller cancellation

The shadow-runtime request accepts an optional caller `AbortSignal`. The runtime continues to own one request deadline and one effective downstream controller. Caller cancellation and runtime deadline are composed; the first terminal cause wins.

Caller cancellation is reported as `CALLER_CANCELLED`, distinct from `DEADLINE_EXCEEDED` and provider-attempt timeout. It propagates to embedding, Atlas retrieval, and generation, suppresses later stages, does not retry, does not affect provider circuit health, preserves the authoritative result, releases concurrency, and clears the deadline timer.

Future Express integration must create a request-scoped controller from verified disconnect semantics. It must not treat every response `close` event as an aborted request after normal completion.

## Consequences

- C-E internal route authorization can use current, revocable User roles without a second authentication system.
- Existing User records and JWTs remain compatible.
- The model is intentionally a coarse three-role authority, not generalized IAM, RBAC policy DSL, ABAC, OAuth scope, or tenant inheritance.
- C-E routes, public APIs, privileged role-management APIs, and production RAG activation remain outside this phase.
