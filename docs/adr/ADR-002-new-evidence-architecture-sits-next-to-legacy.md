# ADR-002: New Evidence Architecture Sits Next To Legacy

Status:
ACCEPTED

Date:
2026-07-28

Phase:
Phase 0B

Context:
Future YUDIJI scoring architecture will add append-only Evidence, provider adapters, Factor Registry, generic evaluators, source resolution, immutable compiled rulebooks, cluster and conflict handling, optional decision axes, event intelligence, RAG-assisted template drafting, and effectiveness calibration. These capabilities are planned, not current production behavior.

Decision:
The Evidence, Factor Registry, and generic-evaluator architecture will be introduced beside the legacy path rather than through a direct scoring-engine rewrite.

Consequences:
- Early Evidence writes may be write-only or observational.
- Generic evaluator dispatch must be additive.
- Legacy evaluators must remain available.
- Existing templates continue to execute.
- Rollback is performed by disabling new feature flags.
- New architecture may only become authoritative through a future approved ADR.

Alternatives considered:
- Replace the legacy evaluator registry immediately.
- Build Evidence directly into the current scoring engine as required runtime input.
- Delay all Evidence work until the legacy path is removed.

Why rejected:
- Immediate replacement would bypass the baseline lock.
- Making Evidence mandatory too early would risk breaking existing scoring.
- Delaying all Evidence work would prevent safe observational validation beside production behavior.

Migration and rollback:
Introduce new Evidence and generic-evaluator components beside the legacy path with feature flags defaulting OFF. When disabled, the current scoring path must behave as it does today. Rollback means disabling the new flags and leaving legacy scoring authoritative. Promotion of the new path requires a later accepted ADR.

Related artifacts:
- ADR-001
- ADR-004
- ADR-005
- Phase 1 Evidence Foundation
- `PHASE_LOG.md`
