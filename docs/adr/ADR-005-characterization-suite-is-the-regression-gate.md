# ADR-005: Characterization Suite Is The Regression Gate

Status:
ACCEPTED

Date:
2026-07-28

Phase:
Phase 0B

Context:
Phase 0A added scoring characterization tests to lock the behavior of the current scoring engine before the future Evidence and generic-evaluator migration. Those tests cover all seven system scoring templates, permission boundaries, missing-data policies, reward-risk rejection, system/user-template parity, custom user-template thresholds, and existing error behavior.

Decision:
The Phase 0A scoring characterization suite and complete backend tests are mandatory regression gates for every later scoring-related implementation.

Consequences:
- Every later Codex task must run the characterization suite and complete test suite.
- Existing test expectations cannot be changed merely to make implementation pass.
- A changed expectation requires an approved contract or superseding ADR.
- Compilation alone is not phase completion.
- Scoring-related changes must report characterization, full test, and typecheck results.

Alternatives considered:
- Rely only on TypeScript compilation.
- Run only targeted tests for later phases.
- Update characterization expectations whenever implementation changes.

Why rejected:
- Compilation does not verify scoring behavior.
- Targeted tests alone can miss regressions in legacy scoring semantics.
- Freely updating expectations would erase the baseline lock.

Migration and rollback:
The suite becomes a required gate immediately for scoring-related phases. Rollback for a failing future change means reverting or disabling the new behavior until characterization and full backend tests pass. If the intended behavior truly changes, create an approved contract decision or superseding ADR before updating expectations.

Related artifacts:
- Phase 0A scoring characterization suite.
- `tests/unit/services/scoring-engine.characterization.test.ts`
- ADR-001
- ADR-003
- `PHASE_LOG.md`
