# ADR-001: Legacy Scoring Remains Authoritative

Status:
ACCEPTED

Date:
2026-07-28

Phase:
Phase 0B

Context:
YUDIJI already has a production scoring path that resolves a scoring template, runs `ScoringEngineService`, dispatches through `ScoringRuleEvaluatorRegistryService`, executes existing evaluators, aggregates section results, and returns score, permission, status, confidence, reasons, warnings, and breakdown. Future phases will introduce Evidence, Factor Registry, and generic evaluators, but those capabilities do not yet replace the current path.

Decision:
The existing scoring engine, evaluator registry, evaluator implementations, system templates, and public scoring outputs remain authoritative during the migration.

Consequences:
- Existing scoring behavior cannot be changed casually.
- Phase 0A characterization tests define the current scoring baseline.
- New capabilities must initially be additive.
- Production behavior remains legacy-first while new flags are disabled.
- Existing evaluator keys and system templates remain supported.
- Any future replacement requires an explicit migration ADR.

Alternatives considered:
- Rewrite the scoring engine directly.
- Replace system templates with the future rulebook architecture immediately.
- Treat characterization tests as optional.

Why rejected:
- A direct rewrite would make regression risk too high.
- Immediate replacement would break the approved incremental migration path.
- Optional characterization tests would weaken the baseline lock needed for later phases.

Migration and rollback:
This decision is introduced by documenting the current authority boundary and requiring characterization coverage before later scoring changes. Rollback for future additive work is performed by disabling new architecture feature flags and continuing to execute the legacy path. Any move away from this authority model requires a superseding ADR.

Related artifacts:
- Phase 0A scoring characterization suite.
- `tests/unit/services/scoring-engine.characterization.test.ts`
- `src/services/scoring-engine.service.ts`
- `src/services/scoring-rule-evaluator-registry.service.ts`
- `src/services/scoring-template-registry.service.ts`
- `PHASE_LOG.md`
