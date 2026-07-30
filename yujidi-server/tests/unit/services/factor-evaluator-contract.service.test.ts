import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DeterministicFactorEvaluator } from "../../../src/ports/deterministic-factor-evaluator.port.js";
import {
  FactorEvaluatorContractService,
  supportsFactorInput,
} from "../../../src/services/factor-evaluator-contract.service.js";
import type {
  FactorEvaluationResult,
  FactorEvaluatorExecutionResult,
} from "../../../src/types/factor-evaluator.types.js";
import type { AssembledFactorInput } from "../../../src/types/factor-input-assembly.types.js";

const OBSERVED_AT = new Date("2026-07-30T14:00:09.000Z");
const EVALUATED_AT = new Date("2026-07-30T14:00:10.000Z");
const service = new FactorEvaluatorContractService();

const input = (
  overrides: Record<string, unknown> = {},
): AssembledFactorInput => ({
  factorKey: "MARKET.PRICE",
  factorDefinitionVersion: 1,
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  evidenceId: "E-1",
  value: { type: "NUMBER", value: 65000.123456, unit: "USDT" },
  source: {
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
    priority: 100,
  },
  observedAt: OBSERVED_AT,
  evaluatedAt: EVALUATED_AT,
  confidence: 0.75,
  freshness: { status: "FRESH", ageMs: 1000, maxAgeMs: 10_000 },
  ...overrides,
});

const evaluator = (
  overrides: Record<string, unknown> = {},
): DeterministicFactorEvaluator => ({
  evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
  evaluatorVersion: 1,
  configurationVersion: 1,
  supportedFactorKeys: ["MARKET.PRICE"],
  evaluate: () => ({ evaluated: false, evaluatorId: null, factorKey: null, code: "EVALUATION_FAILED" }),
  ...overrides,
}) as DeterministicFactorEvaluator;

const evaluationResult = (
  overrides: Record<string, unknown> = {},
): FactorEvaluationResult => ({
  evaluator: {
    evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
    evaluatorVersion: 1,
    configurationVersion: 1,
  },
  factorKey: "MARKET.PRICE",
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  outcome: "NEUTRAL",
  contribution: { points: 0, minimumPoints: -2, maximumPoints: 2 },
  reasonCode: "NO_DIRECTIONAL_SIGNAL",
  evidence: {
    evidenceId: "E-1",
    factorDefinitionVersion: 1,
    source: {
      sourceType: "MARKET_DATA",
      provider: "BINANCE",
      sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
    },
    observedAt: OBSERVED_AT,
    evaluatedAt: EVALUATED_AT,
  },
  diagnostics: {},
  ...overrides,
}) as FactorEvaluationResult;

const execution = (
  result = evaluationResult(),
): FactorEvaluatorExecutionResult => ({ evaluated: true, result });

test("accepts a valid evaluator declaration without invoking it", () => {
  let calls = 0;
  const declaration = evaluator({ evaluate: () => {
    calls += 1;
    return { evaluated: false, evaluatorId: null, factorKey: null, code: "EVALUATION_FAILED" };
  } });
  assert.deepEqual(service.validateEvaluator(declaration), {
    valid: true,
    evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
  });
  assert.equal(calls, 0);
});

test("rejects invalid evaluator identifiers", () => {
  for (const evaluatorId of [
    "", " TEST", "TEST ", "test", "TEST-ID", "A".repeat(121), 1,
  ]) {
    assert.deepEqual(service.validateEvaluator(evaluator({ evaluatorId })), {
      valid: false,
      code: "INVALID_EVALUATOR_ID",
    });
  }
});

test("rejects invalid evaluator and configuration versions", () => {
  for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(service.validateEvaluator(evaluator({ evaluatorVersion: value })), {
      valid: false,
      code: "INVALID_EVALUATOR_VERSION",
    });
    assert.deepEqual(service.validateEvaluator(evaluator({ configurationVersion: value })), {
      valid: false,
      code: "INVALID_CONFIGURATION_VERSION",
    });
  }
});

test("rejects empty, duplicate, unknown, or malformed supported factors", () => {
  const cases = [
    [[], "EMPTY_SUPPORTED_FACTORS"],
    [["MARKET.PRICE", "MARKET.PRICE"], "DUPLICATE_SUPPORTED_FACTOR"],
    [["OTHER"], "INVALID_SUPPORTED_FACTOR"],
    ["MARKET.PRICE", "INVALID_SUPPORTED_FACTOR"],
  ] as const;
  for (const [supportedFactorKeys, code] of cases) {
    assert.deepEqual(service.validateEvaluator(evaluator({ supportedFactorKeys })), {
      valid: false,
      code,
    });
  }
});

test("rejects a missing or non-function evaluate member", () => {
  assert.deepEqual(service.validateEvaluator(evaluator({ evaluate: undefined })), {
    valid: false,
    code: "INVALID_EVALUATE_FUNCTION",
  });
  assert.deepEqual(service.validateEvaluator(evaluator({ evaluate: "evaluate" })), {
    valid: false,
    code: "INVALID_EVALUATE_FUNCTION",
  });
});

test("support matching is exact and does not normalize", () => {
  const declaration = evaluator();
  assert.equal(supportsFactorInput(declaration, input()), true);
  for (const factorKey of ["market.price", " MARKET.PRICE", "MARKET.PRICE "]) {
    assert.equal(supportsFactorInput(declaration, input({ factorKey }) as never), false);
  }
});

test("accepts valid outcome and contribution combinations", () => {
  for (const [outcome, points] of [
    ["PASS", 0.25],
    ["FAIL", -0.25],
    ["NEUTRAL", 0],
    ["UNAVAILABLE", 0],
  ] as const) {
    const result = service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: execution(evaluationResult({
        outcome,
        contribution: { points, minimumPoints: -2, maximumPoints: 2 },
      })),
    });
    assert.equal(result.valid, true);
  }
});

test("rejects inconsistent outcome and contribution combinations", () => {
  const cases = [
    ["PASS", 0], ["PASS", -1],
    ["FAIL", 0], ["FAIL", 1],
    ["NEUTRAL", 1], ["UNAVAILABLE", -1],
  ] as const;
  for (const [outcome, points] of cases) {
    assert.deepEqual(service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: execution(evaluationResult({
        outcome,
        contribution: { points, minimumPoints: -2, maximumPoints: 2 },
      })),
    }), { valid: false, code: "INVALID_RESULT" });
  }
});

test("rejects invalid contribution numbers and bounds without rounding", () => {
  for (const contribution of [
    { points: Number.NaN, minimumPoints: -2, maximumPoints: 2 },
    { points: Number.POSITIVE_INFINITY, minimumPoints: -2, maximumPoints: 2 },
    { points: 0, minimumPoints: Number.NEGATIVE_INFINITY, maximumPoints: 2 },
    { points: 0, minimumPoints: 2, maximumPoints: -2 },
    { points: -3, minimumPoints: -2, maximumPoints: 2 },
    { points: 3, minimumPoints: -2, maximumPoints: 2 },
  ]) {
    assert.deepEqual(service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: execution(evaluationResult({ contribution })),
    }), { valid: false, code: "INVALID_RESULT" });
  }
});

test("rejects evaluator identity mismatches", () => {
  for (const identity of [
    { evaluatorId: "OTHER", evaluatorVersion: 1, configurationVersion: 1 },
    { evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1", evaluatorVersion: 2, configurationVersion: 1 },
    { evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1", evaluatorVersion: 1, configurationVersion: 2 },
  ]) {
    assert.deepEqual(service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: execution(evaluationResult({ evaluator: identity })),
    }), { valid: false, code: "INVALID_RESULT" });
  }
});

test("rejects factor, subject, Evidence, definition, and source mismatches", () => {
  const mismatches = [
    { factorKey: "OTHER" },
    { subject: { type: "INSTRUMENT", key: "ETHUSDT" } },
    { evidence: { ...evaluationResult().evidence, evidenceId: "E-2" } },
    { evidence: { ...evaluationResult().evidence, factorDefinitionVersion: 2 } },
    { evidence: { ...evaluationResult().evidence, source: { ...evaluationResult().evidence.source, provider: "OTHER" } } },
    { evidence: { ...evaluationResult().evidence, observedAt: new Date("2026-07-30T14:00:08Z") } },
    { evidence: { ...evaluationResult().evidence, evaluatedAt: new Date("2026-07-30T14:00:11Z") } },
  ];
  for (const mismatch of mismatches) {
    assert.deepEqual(service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: execution(evaluationResult(mismatch)),
    }), { valid: false, code: "INVALID_RESULT" });
  }
});

test("rejects invalid reason codes", () => {
  for (const reasonCode of [
    "", " REASON", "REASON ", "lowercase", "FREE FORM", "REASON-CODE",
    "A".repeat(161),
  ]) {
    assert.deepEqual(service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: execution(evaluationResult({ reasonCode })),
    }), { valid: false, code: "INVALID_RESULT" });
  }
});

test("accepts bounded primitive diagnostics", () => {
  const result = service.validateResult({
    evaluator: evaluator(),
    input: input(),
    execution: execution(evaluationResult({
      diagnostics: { text: "safe", numeric: 1.25, flag: false, absent: null },
    })),
  });
  assert.equal(result.valid, true);
});

test("rejects excessive or unsafe diagnostics", () => {
  const invalidDiagnostics = [
    Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`key${index}`, index])),
    { "": 1 },
    { " key": 1 },
    { key: "A".repeat(501) },
    { key: Number.NaN },
    { key: [] },
    { key: {} },
  ];
  for (const diagnostics of invalidDiagnostics) {
    assert.deepEqual(service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: execution(evaluationResult({ diagnostics })),
    }), { valid: false, code: "INVALID_RESULT" });
  }
});

test("accepts an approved sanitized failed execution", () => {
  assert.deepEqual(service.validateResult({
    evaluator: evaluator(),
    input: input(),
    execution: {
      evaluated: false,
      evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
      factorKey: "MARKET.PRICE",
      code: "EVALUATION_FAILED",
    },
  }), {
    valid: true,
    execution: {
      evaluated: false,
      evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
      factorKey: "MARKET.PRICE",
      code: "EVALUATION_FAILED",
    },
  });
});

test("rejects invalid failed executions and raw error leakage", () => {
  for (const failed of [
    { evaluated: false, evaluatorId: null, factorKey: null, code: "OTHER" },
    { evaluated: false, evaluatorId: "OTHER", factorKey: null, code: "EVALUATION_FAILED" },
    { evaluated: false, evaluatorId: null, factorKey: "OTHER", code: "EVALUATION_FAILED" },
    { evaluated: false, evaluatorId: null, factorKey: null, code: "EVALUATION_FAILED", error: "secret" },
    { evaluated: false, evaluatorId: null, factorKey: null, code: "EVALUATION_FAILED", stack: "secret" },
  ]) {
    assert.deepEqual(service.validateResult({
      evaluator: evaluator(),
      input: input(),
      execution: failed as never,
    }), { valid: false, code: "INVALID_RESULT" });
  }
});

test("rejects invalid inputs and unsupported factors before result acceptance", () => {
  assert.deepEqual(service.validateResult({
    evaluator: evaluator(),
    input: input({ evidenceId: "" }),
    execution: execution(),
  }), { valid: false, code: "INVALID_INPUT" });
  assert.deepEqual(service.validateResult({
    evaluator: evaluator({ supportedFactorKeys: ["MARKET.PRICE"] }),
    input: input({ factorKey: "OTHER" }) as never,
    execution: execution(),
  }), { valid: false, code: "UNSUPPORTED_FACTOR" });
  assert.deepEqual(service.validateResult({
    evaluator: evaluator(),
    input: input({ value: { type: "BOOLEAN", value: true } }) as never,
    execution: execution(),
  }), { valid: false, code: "UNSUPPORTED_VALUE_TYPE" });
});

test("valid results are cloned, frozen, date-safe, and deterministic", () => {
  const sourceInput = input();
  Object.freeze(sourceInput.subject);
  Object.freeze(sourceInput.value);
  Object.freeze(sourceInput.source);
  Object.freeze(sourceInput);
  const sourceExecution = execution(evaluationResult({ diagnostics: { safe: 1 } }));
  if (!sourceExecution.evaluated) throw new TypeError("test fixture must be evaluated");
  Object.freeze(sourceExecution.result.diagnostics);
  Object.freeze(sourceExecution.result);
  Object.freeze(sourceExecution);
  const declaration = evaluator();
  Object.freeze(declaration.supportedFactorKeys);
  Object.freeze(declaration);
  const first = service.validateResult({
    evaluator: declaration,
    input: sourceInput,
    execution: sourceExecution,
  });
  assert.equal(first.valid, true);
  if (!first.valid || !("result" in first)) return;
  assert.throws(() => ((first.result.diagnostics as Record<string, unknown>).safe = 2));
  first.result.evidence.observedAt.setUTCFullYear(2030);
  const second = service.validateResult({
    evaluator: declaration,
    input: sourceInput,
    execution: sourceExecution,
  });
  assert.equal(second.valid, true);
  if (second.valid && "result" in second) {
    assert.equal(second.result.evidence.observedAt.toISOString(), OBSERVED_AT.toISOString());
  }
  assert.deepEqual(
    service.validateResult({ evaluator: declaration, input: sourceInput, execution: sourceExecution }),
    second,
  );
});

test("the port is synchronous and new boundary has no I/O or legacy imports", () => {
  const port = readFileSync(
    new URL("../../../src/ports/deterministic-factor-evaluator.port.ts", import.meta.url),
    "utf8",
  );
  const contract = readFileSync(
    new URL("../../../src/services/factor-evaluator-contract.service.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(port, /Promise|async/);
  assert.doesNotMatch(
    `${port}\n${contract}`,
    /from\s+["'][^"']*(?:repositories|evidence-read|provider-runner|clients|axios|mongoose|scoring-rule-evaluator|scoring-engine|controllers|schedulers|llm|frontend)/i,
  );
});
