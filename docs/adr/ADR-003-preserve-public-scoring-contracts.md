# ADR-003: Preserve Public Scoring Contracts

Status:
ACCEPTED

Date:
2026-07-28

Phase:
Phase 0B

Context:
Frontend and backend consumers rely on the current scoring response shape. The migration toward Evidence and generic evaluators must not silently redefine the public fields that users and existing flows already depend on.

Decision:
The following public output fields remain backward compatible:

```text
score
permission
scoreStatus
dataConfidence
reasonCodes
warnings
breakdown
```

Consequences:
- These fields cannot be removed or silently redefined.
- Additional fields must initially be optional.
- Existing frontend consumers must remain functional.
- Any breaking contract change requires versioning and migration.
- New scoring architecture must adapt to the existing response contract while it is running beside legacy scoring.

Alternatives considered:
- Replace the response shape with a new Evidence-first contract.
- Add required new fields immediately.
- Allow frontend and backend consumers to migrate opportunistically.

Why rejected:
- A replacement response would break current consumers.
- Required new fields would force a migration before the future architecture is proven.
- Opportunistic migration would create inconsistent behavior across clients.

Migration and rollback:
Introduce any new fields as optional additions. Keep the existing fields present and semantically compatible. Rollback means clients continue reading the existing fields and ignore optional additions. A future breaking contract requires a versioned API plan and a superseding ADR.

Related artifacts:
- ADR-001
- ADR-002
- Phase 0A characterization suite.
- `src/services/scoring-engine.service.ts`
- `PHASE_LOG.md`
