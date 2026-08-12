import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DeterministicFactorEvaluator } from "../../../src/ports/deterministic-factor-evaluator.port.js";
import { ExplicitFactorEvaluatorExecutionService } from "../../../src/services/scoring/explicit-factor-evaluator-execution.service.js";
import type { FactorEvaluatorResultValidationResult } from "../../../src/types/factor-evaluator.types.js";
import type { AssembledFactorInput } from "../../../src/types/factor-input-assembly.types.js";

const input = (): AssembledFactorInput => ({
  factorKey: "MARKET.PRICE",
  factorDefinitionVersion: 1,
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  evidenceId: "E-1",
  value: { type: "NUMBER", value: 65000, unit: "USDT" },
  source: {
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
    priority: 100,
  },
  observedAt: new Date("2026-07-30T14:00:09.000Z"),
  evaluatedAt: new Date("2026-07-30T14:00:10.000Z"),
  confidence: 0.75,
  freshness: { status: "FRESH", ageMs: 1000, maxAgeMs: 10_000 },
});

const normalExecution = (assembled = input()) => ({
  evaluated: true as const,
  result: {
    evaluator: {
      evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
      evaluatorVersion: 2,
      configurationVersion: 3,
    },
    factorKey: assembled.factorKey,
    subject: { ...assembled.subject },
    outcome: "NEUTRAL" as const,
    contribution: { points: 0, minimumPoints: -2, maximumPoints: 2 },
    reasonCode: "NO_DIRECTIONAL_SIGNAL",
    evidence: {
      evidenceId: assembled.evidenceId,
      factorDefinitionVersion: assembled.factorDefinitionVersion,
      source: {
        sourceType: assembled.source.sourceType,
        provider: assembled.source.provider,
        sourceId: assembled.source.sourceId,
      },
      observedAt: new Date(assembled.observedAt),
      evaluatedAt: new Date(assembled.evaluatedAt),
    },
    diagnostics: {},
  },
});

type HarnessOptions = {
  resolved?: DeterministicFactorEvaluator | null;
  validation?: FactorEvaluatorResultValidationResult;
};

const harness = (options: HarnessOptions = {}) => {
  const assembled = input();
  const raw = normalExecution(assembled);
  const calls = { lookup: [] as string[], evaluate: [] as AssembledFactorInput[], validate: [] as unknown[] };
  const evaluator: DeterministicFactorEvaluator = options.resolved ?? {
    evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
    evaluatorVersion: 2,
    configurationVersion: 3,
    supportedFactorKeys: ["MARKET.PRICE"],
    evaluate(value) {
      calls.evaluate.push(value);
      return raw;
    },
  };
  const validated = Object.freeze({
    ...raw.result,
    evaluator: Object.freeze({ ...raw.result.evaluator }),
    subject: Object.freeze({ ...raw.result.subject }),
    contribution: Object.freeze({ ...raw.result.contribution }),
    evidence: Object.freeze({
      ...raw.result.evidence,
      source: Object.freeze({ ...raw.result.evidence.source }),
      observedAt: new Date(raw.result.evidence.observedAt),
      evaluatedAt: new Date(raw.result.evidence.evaluatedAt),
    }),
    diagnostics: Object.freeze({}),
  });
  const service = new ExplicitFactorEvaluatorExecutionService({
    evaluatorRegistry: {
      getById(id) {
        calls.lookup.push(id);
        return options.resolved === null ? null : evaluator;
      },
    },
    contractService: {
      validateResult(params) {
        calls.validate.push(params);
        return options.validation ?? { valid: true, result: validated };
      },
    },
  });
  return { assembled, raw, validated, evaluator, service, calls };
};

test("executes one exact evaluator and returns validated metadata and normal execution", () => {
  const value = harness();
  const result = value.service.execute({
    evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
    input: value.assembled,
  });
  assert.equal(result.executed, true);
  assert.deepEqual(value.calls.lookup, ["TEST_MARKET_PRICE_EVALUATOR_V1"]);
  assert.equal(value.calls.evaluate.length, 1);
  assert.equal(value.calls.evaluate[0], value.assembled);
  assert.equal(value.calls.validate.length, 1);
  assert.deepEqual(value.calls.validate[0], {
    evaluator: value.evaluator,
    input: value.assembled,
    execution: value.raw,
  });
  assert.deepEqual(result, {
    executed: true,
    evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
    evaluatorVersion: 2,
    configurationVersion: 3,
    factorKey: "MARKET.PRICE",
    execution: { evaluated: true, result: value.validated },
  });
});

test("preserves a contract-valid typed evaluator failure as successful execution", () => {
  const typedFailure = Object.freeze({
    evaluated: false as const,
    evaluatorId: "TEST_MARKET_PRICE_EVALUATOR_V1",
    factorKey: "MARKET.PRICE",
    code: "EVALUATION_FAILED" as const,
  });
  const value = harness({ validation: { valid: true, execution: typedFailure } });
  const result = value.service.execute({
    evaluatorId: value.evaluator.evaluatorId,
    input: value.assembled,
  });
  assert.deepEqual(result, {
    executed: true,
    evaluatorId: value.evaluator.evaluatorId,
    evaluatorVersion: 2,
    configurationVersion: 3,
    factorKey: "MARKET.PRICE",
    execution: typedFailure,
  });
});

test("rejects malformed requests before dependency calls", () => {
  for (const request of [
    null,
    {},
    { evaluatorId: "", input: input() },
    { evaluatorId: " TEST", input: input() },
    { evaluatorId: "TEST ", input: input() },
    { evaluatorId: 1, input: input() },
    { evaluatorId: "TEST", input: null },
    { evaluatorId: "TEST", input: { ...input(), factorKey: undefined } },
    { evaluatorId: "TEST", input: { ...input(), subject: undefined } },
    { evaluatorId: "TEST", input: { ...input(), evidenceId: undefined } },
    { evaluatorId: "TEST", input: { ...input(), value: undefined } },
  ]) {
    const value = harness();
    assert.deepEqual(value.service.execute(request as never), {
      executed: false,
      evaluatorId: null,
      factorKey: null,
      code: "INVALID_REQUEST",
    });
    assert.equal(value.calls.lookup.length, 0);
    assert.equal(value.calls.evaluate.length, 0);
    assert.equal(value.calls.validate.length, 0);
  }
});

test("fails closed when exact evaluator is not registered", () => {
  const value = harness({ resolved: null });
  assert.deepEqual(value.service.execute({
    evaluatorId: "MISSING_EVALUATOR",
    input: value.assembled,
  }), {
    executed: false,
    evaluatorId: "MISSING_EVALUATOR",
    factorKey: "MARKET.PRICE",
    code: "EVALUATOR_NOT_FOUND",
  });
  assert.deepEqual(value.calls.lookup, ["MISSING_EVALUATOR"]);
  assert.equal(value.calls.validate.length, 0);
});

test("rejects unsupported factors before evaluator or validator invocation", () => {
  const value = harness();
  const mismatched = { ...value.assembled, factorKey: "RUNTIME.BYPASS" } as never;
  assert.deepEqual(value.service.execute({
    evaluatorId: value.evaluator.evaluatorId,
    input: mismatched,
  }), {
    executed: false,
    evaluatorId: value.evaluator.evaluatorId,
    factorKey: "RUNTIME.BYPASS",
    code: "UNSUPPORTED_FACTOR",
  });
  assert.equal(value.calls.evaluate.length, 0);
  assert.equal(value.calls.validate.length, 0);
});

test("sanitizes Error and non-Error throws without retry or validation", () => {
  for (const thrown of [new Error("secret"), "secret", 7, { secret: true }, null]) {
    let calls = 0;
    const evaluator = {
      ...harness().evaluator,
      evaluate() {
        calls += 1;
        throw thrown;
      },
    };
    const value = harness({ resolved: evaluator });
    const result = value.service.execute({
      evaluatorId: evaluator.evaluatorId,
      input: value.assembled,
    });
    assert.deepEqual(result, {
      executed: false,
      evaluatorId: evaluator.evaluatorId,
      factorKey: "MARKET.PRICE",
      code: "EVALUATOR_EXECUTION_FAILED",
    });
    assert.equal(calls, 1);
    assert.equal(value.calls.validate.length, 0);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  }
});

test("rejects Promise and thenable returns without awaiting or validating", () => {
  for (const returned of [Promise.resolve(normalExecution()), { then() {} }]) {
    let calls = 0;
    const evaluator = {
      ...harness().evaluator,
      evaluate() {
        calls += 1;
        return returned as never;
      },
    };
    const value = harness({ resolved: evaluator });
    assert.deepEqual(value.service.execute({
      evaluatorId: evaluator.evaluatorId,
      input: value.assembled,
    }), {
      executed: false,
      evaluatorId: evaluator.evaluatorId,
      factorKey: "MARKET.PRICE",
      code: "INVALID_EVALUATOR_EXECUTION",
    });
    assert.equal(calls, 1);
    assert.equal(value.calls.validate.length, 0);
  }
});

test("fails closed on Phase 2E rejection without retrying or leaking raw output", () => {
  const value = harness({ validation: { valid: false, code: "INVALID_RESULT" } });
  const result = value.service.execute({
    evaluatorId: value.evaluator.evaluatorId,
    input: value.assembled,
  });
  assert.deepEqual(result, {
    executed: false,
    evaluatorId: value.evaluator.evaluatorId,
    factorKey: "MARKET.PRICE",
    code: "INVALID_EVALUATOR_EXECUTION",
  });
  assert.equal(value.calls.evaluate.length, 1);
  assert.equal(value.calls.validate.length, 1);
  assert.equal("execution" in result, false);
});

test("does not mutate deeply frozen inputs or declarations", () => {
  const value = harness();
  Object.freeze(value.assembled.subject);
  Object.freeze(value.assembled.value);
  Object.freeze(value.assembled.source);
  Object.freeze(value.assembled.freshness);
  Object.freeze(value.assembled.observedAt);
  Object.freeze(value.assembled.evaluatedAt);
  Object.freeze(value.assembled);
  Object.freeze(value.evaluator.supportedFactorKeys);
  Object.freeze(value.evaluator);
  const request = Object.freeze({
    evaluatorId: value.evaluator.evaluatorId,
    input: value.assembled,
  });
  assert.equal(value.service.execute(request).executed, true);
});

test("returns frozen boundary objects and does not generate runtime fields", () => {
  const value = harness();
  const first = value.service.execute({
    evaluatorId: value.evaluator.evaluatorId,
    input: value.assembled,
  });
  const second = value.service.execute({
    evaluatorId: value.evaluator.evaluatorId,
    input: value.assembled,
  });
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen((first as { execution: object }).execution), true);
  for (const field of ["executionId", "createdAt", "durationMs"]) {
    assert.equal(field in first, false);
  }
});

test("new execution files do not import forbidden I/O, assembly, legacy, or runtime modules", () => {
  const files = [
    "src/types/factor-evaluator-execution.types.ts",
    "src/services/scoring/explicit-factor-evaluator-execution.service.ts",
  ];
  const forbidden = [
    "factor-input-assembly.service", "evidence.repository", "evidence-read.service",
    "provider", "mongoose", "axios", "scoring-rule-evaluator", "scoring-engine",
    "controller", "scheduler", "llm", "frontend",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8").toLowerCase();
    for (const token of forbidden) assert.equal(source.includes(token), false, `${file}: ${token}`);
  }
});
