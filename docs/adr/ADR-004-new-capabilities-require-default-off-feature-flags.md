# ADR-004: New Capabilities Require Default-OFF Feature Flags

Status:
ACCEPTED

Date:
2026-07-28

Phase:
Phase 0B

Context:
Future scoring architecture phases will introduce meaningful behavior and data-flow changes. These changes must be safely observable, reversible, and unable to alter current production scoring while disabled.

Decision:
All meaningful future scoring architecture capabilities must be controlled by explicit feature flags defaulting to OFF.

Expected future flags:

```text
EVIDENCE_PIPELINE_ENABLED
GENERIC_EVALUATOR_ENABLED
SOURCE_RESOLVER_FALLBACK_ENABLED
COMPILED_RULEBOOK_EXECUTION
DECISION_AXES_ENABLED
EVENT_CLASSIFICATION_READONLY
EVENT_CLASSIFICATION_AFFECTS_RISK
RAG_TEMPLATE_DRAFTING_ENABLED
WEIGHT_PROPOSALS_ENABLED
```

Consequences:
- This ADR documents the flags but does not implement them.
- Disabled flags must preserve current production behavior.
- Every future phase must document enablement, rollback, and disabled behavior.
- No flag may default ON without an approved rollout decision.
- Feature flags become part of phase acceptance criteria when introduced.

Alternatives considered:
- Ship new scoring capabilities without flags.
- Use one broad migration flag for every future capability.
- Default new flags ON in development or production.

Why rejected:
- Shipping without flags weakens rollback.
- One broad flag makes behavior hard to isolate and verify.
- Default-ON behavior could silently change existing scoring.

Migration and rollback:
Each future capability must be introduced behind a named flag that defaults OFF. Rollback means disabling the relevant flag and confirming legacy scoring behavior through characterization and full backend tests. Enabling any flag by default requires a future rollout decision.

Related artifacts:
- ADR-001
- ADR-002
- ADR-005
- Future Phase 0D feature-flag scaffolding.
- `PHASE_LOG.md`
