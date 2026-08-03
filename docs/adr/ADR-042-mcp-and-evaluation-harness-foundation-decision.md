# ADR-042: MCP and Evaluation-Harness Foundation Decision

Status: Accepted

## Context and repository findings

The foundation roadmap expects read-only MCP inspection and a repeatable evaluation harness. Repository inspection found no MCP server, tool registration, transport, authentication/redaction boundary, MCP dependency, dedicated evaluation-manifest schema, or `eval:*` script. Deterministic behavior is currently exercised through the Node test runner and Phase-specific fixtures. Adding a server, dependency, production route, or speculative harness would exceed approved scope.

## Decision: Outcome B — formal deferral

Runtime MCP and the dedicated foundation evaluation harness are deferred. Their contracts are frozen below; implementation requires a separately approved phase. Existing Stage 3R-C ingestion proof, Stage 3R-E golden tests, and Stage 3R-F compatibility tests remain the executable deterministic evidence, but they are not relabeled as a new harness.

## MCP purpose, tools, and contracts

MCP is inspection-only and must never become an evaluator/provider execution path. The target inventory is:

- `get_factor_definition({ factorKey })`: returns only immutable safe registry metadata for one exact registered key.
- `list_templates({ scope?, status?, limit?, cursor? })`: returns bounded authorized summaries through a future read-only port.
- `get_score_check({ scoreCheckId })`: returns one user-authorized redacted summary through a future access-control port.
- `get_trade_journal({ journalId })`: returns one user-authorized redacted summary through a future access-control port.

`get_factor_definition` is the minimum first implementation. Its canonical example uses `CRYPTO.ETF_NET_FLOW`, not the roadmap alias. Safe output is limited to factor key/version, display name/description, status, value types, subject types, unit policy, freshness policy, and scoring eligibility. It exposes no Evidence, raw provider payload, credential, internal error, mutable registry object, or execution capability.

Unknown keys fail with a bounded categorical error. Inputs are exact, case-sensitive, length-bounded, and schema-validated. Outputs are detached and frozen before serialization. No tool may write data, invoke providers/evaluators/LLMs, change flags, or access a system clock for semantic behavior.

## Security and authorization prerequisites

Before MCP implementation, the project must approve: transport and lifecycle ownership; dependency choice or existing framework; authentication and user identity propagation; per-resource authorization; template visibility filtering; ScoreCheck/journal ownership checks; redaction and safe-error contracts; bounded pagination/rate limits; audit policy; deployment exposure; and threat-model tests. Factor metadata alone may be credential-free only in local/test scope until exposure policy is approved.

## Evaluation-harness contract

A future network-free `eval:foundation` manifest will execute immutable fixtures for Evidence compatibility, factor-input assembly, relationship evaluation, and legacy compatibility. Each entry contains fixture ID, contract/version identity, expected status, expected reason codes in exact order, expected score/contribution when applicable, and an executor identifier from a closed allow-list. Reports contain fixture ID, expected/actual status, pass/fail, reason-code match, score match, and safe diagnostics.

The harness must use explicit times, make no network/LLM/provider/database calls, preserve native precision, fail on unknown/duplicate fixtures, and produce deep-equal rerun output apart from explicitly excluded duration telemetry. It may be a Node-test-driven manifest if approved. It must not activate production registries or flags.

Prerequisites are: a versioned manifest schema, fixture ownership/location convention, closed executor registry, CLI/report format, deterministic serialization rules, CI budget and gate policy, package-script approval, and tests proving no network or production wiring. No new dependency is necessary unless separately justified and approved.

## Relationships and data restrictions

MCP reads Factor Registry and future authorized template/ScoreCheck/journal ports only. It does not orchestrate ScoreCheck, resolve providers, read raw Evidence, or execute compiled rulebooks. Trade-journal free text, private notes, brokerage identifiers, credentials, raw provider data, internal stack traces, and cross-user identifiers are prohibited unless a future field-level redaction contract explicitly permits them.

## Testing strategy and consequences

The future MCP gate must test known/unknown factors, safe-field allow-listing, detached output, authorization failures, redaction, bounds, no credentials/Evidence, and no production wiring. The future harness gate must test manifest loading, golden execution, exact reason/score comparison, deterministic rerun, and absence of network/LLM calls.

Outcome B prevents unsafe infrastructure invention while converting the roadmap item into executable future scope with explicit entry conditions. Phase 4 can proceed without pretending MCP/harness runtime exists.

## Rejected alternatives

Rejected: adding an MCP dependency silently, exposing HTTP controllers as tools, returning Mongoose documents or mutable registries, implementing ScoreCheck/journal reads without authorization, calling providers or LLMs, adding an `eval` script without a manifest contract, and calling ordinary unit tests a completed dedicated harness.
