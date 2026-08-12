import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { StaticFactorRegistry } from "../../../src/registries/factor.registry.js";
import { EvidenceFactorCompatibilityService } from "../../../src/services/evidence/evidence-factor-compatibility.service.js";
import type { CreateEvidenceObservationInput } from "../../../src/types/evidence.types.js";
import type {
  FactorDefinition,
  FactorRegistry,
} from "../../../src/types/factor-registry.types.js";

const T0 = new Date("2026-07-30T14:00:00.000Z");
const at = (ageMs: number) => new Date(T0.getTime() + ageMs);

const observation = (
  overrides: Partial<CreateEvidenceObservationInput> = {},
): CreateEvidenceObservationInput => ({
  evidenceId: "EVIDENCE-1",
  recordType: "OBSERVATION",
  factorKey: "MARKET.PRICE",
  deduplicationKey: "DEDUP-PRIVATE",
  subject: {
    type: "INSTRUMENT",
    key: "CRYPTO:BINANCE:BTCUSDT",
  },
  provenance: {
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
  },
  value: {
    type: "NUMBER",
    numberValue: 100,
    unit: "USDT",
  },
  observedAt: T0,
  schemaVersion: "1.0",
  ...overrides,
});

const factorDefinition = (
  overrides: Partial<FactorDefinition> = {},
): FactorDefinition => ({
  factorKey: "MARKET.PRICE",
  version: 1,
  displayName: "Market Price",
  description: "Latest observed tradable market price for an instrument.",
  status: "ACTIVE",
  valueTypes: ["NUMBER"],
  subjectTypes: ["INSTRUMENT"],
  unit: { policy: "REQUIRED" },
  freshness: { kind: "MAX_AGE", maxAgeMs: 10_000 },
  scoringEligibility: "ELIGIBLE",
  ...overrides,
});

const serviceWith = (definition = factorDefinition()) =>
  new EvidenceFactorCompatibilityService({
    factorRegistry: new StaticFactorRegistry([definition]),
  });

test("returns compatible MARKET.PRICE with exact freshness metadata", () => {
  const result = serviceWith().evaluate({
    evidence: observation(),
    asOf: at(7_000),
  });
  assert.deepEqual(result, {
    compatible: true,
    evidenceId: "EVIDENCE-1",
    factorKey: "MARKET.PRICE",
    factorDefinitionVersion: 1,
    scoringEligibility: "ELIGIBLE",
    evaluatedAt: at(7_000),
    freshness: {
      status: "FRESH",
      ageMs: 7_000,
      maxAgeMs: 10_000,
    },
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /DEDUP-PRIVATE|numberValue|provenance|provider/i,
  );
});

test("MAX_AGE accepts zero and exact boundary but rejects one millisecond over", () => {
  for (const ageMs of [0, 10_000]) {
    const result = serviceWith().evaluate({
      evidence: observation(),
      asOf: at(ageMs),
    });
    assert.equal(result.compatible, true);
    if (result.compatible) assert.equal(result.freshness.status, "FRESH");
  }
  const stale = serviceWith().evaluate({
    evidence: observation(),
    asOf: at(10_001),
  });
  assert.deepEqual(stale, {
    compatible: false,
    evidenceId: "EVIDENCE-1",
    factorKey: "MARKET.PRICE",
    code: "STALE_EVIDENCE",
    factorDefinitionVersion: 1,
    evaluatedAt: at(10_001),
    freshness: {
      status: "STALE",
      ageMs: 10_001,
      maxAgeMs: 10_000,
    },
  });
});

test("rejects observations recorded in the future", () => {
  const result = serviceWith().evaluate({
    evidence: observation({ observedAt: at(1) }),
    asOf: T0,
  });
  assert.equal(result.compatible, false);
  if (!result.compatible) assert.equal(result.code, "OBSERVED_IN_FUTURE");
});

test("unknown factors fail closed without a definition version", () => {
  const result = serviceWith().evaluate({
    evidence: observation({ factorKey: "market.price" }),
    asOf: T0,
  });
  assert.equal(result.compatible, false);
  if (!result.compatible) {
    assert.equal(result.code, "UNKNOWN_FACTOR");
    assert.equal(result.factorDefinitionVersion, null);
  }
});

test("revocations are rejected before registry calls", () => {
  let getCalls = 0;
  let validationCalls = 0;
  const service = new EvidenceFactorCompatibilityService({
    factorRegistry: {
      get: () => {
        getCalls += 1;
        return null;
      },
      validateCompatibility: () => {
        validationCalls += 1;
        throw new Error("must not run");
      },
    },
  });
  const result = service.evaluate({
    evidence: {
      evidenceId: "REVOCATION-1",
      recordType: "REVOCATION",
      factorKey: "MARKET.PRICE",
      subject: { type: "INSTRUMENT" },
      observedAt: T0,
    },
    asOf: T0,
  });
  assert.equal(result.compatible, false);
  if (!result.compatible) assert.equal(result.code, "REVOCATION_NOT_SUPPORTED");
  assert.deepEqual({ getCalls, validationCalls }, { getCalls: 0, validationCalls: 0 });
});

test("malformed Evidence returns INVALID_EVIDENCE without registry calls", () => {
  let calls = 0;
  const service = new EvidenceFactorCompatibilityService({
    factorRegistry: {
      get: () => {
        calls += 1;
        return null;
      },
      validateCompatibility: () => {
        calls += 1;
        throw new Error("must not run");
      },
    },
  });
  const invalidEvidence: unknown[] = [
    null,
    undefined,
    "evidence",
    { ...observation(), evidenceId: undefined },
    { ...observation(), factorKey: undefined },
    { ...observation(), observedAt: undefined },
    { ...observation(), observedAt: new Date("invalid") },
    { ...observation(), subject: {} },
    { ...observation(), value: {} },
    {
      ...observation(),
      value: { type: "NUMBER", numberValue: 1, unit: 42 },
    },
  ];
  for (const evidence of invalidEvidence) {
    const result = service.evaluate({ evidence, asOf: T0 });
    assert.equal(result.compatible, false);
    if (!result.compatible) assert.equal(result.code, "INVALID_EVIDENCE");
  }
  assert.equal(calls, 0);
});

test("invalid asOf returns INVALID_AS_OF without registry calls", () => {
  for (const asOf of [new Date("invalid"), "2026-07-30", 1]) {
    let calls = 0;
    const service = new EvidenceFactorCompatibilityService({
      factorRegistry: {
        get: () => {
          calls += 1;
          return null;
        },
        validateCompatibility: () => {
          calls += 1;
          throw new Error("must not run");
        },
      },
    });
    const result = service.evaluate({
      evidence: observation(),
      asOf: asOf as Date,
    });
    assert.equal(result.compatible, false);
    if (!result.compatible) {
      assert.equal(result.code, "INVALID_AS_OF");
      assert.equal(result.evaluatedAt, null);
    }
    assert.equal(calls, 0);
  }
});

test("uses inclusive validity boundaries and deterministic temporal failures", () => {
  const bounded = observation({
    validFrom: at(2_000),
    validUntil: at(9_000),
  });
  const cases = [
    { asOf: at(1_999), code: "NOT_YET_VALID" },
    { asOf: at(2_000), compatible: true },
    { asOf: at(9_000), compatible: true },
    { asOf: at(9_001), code: "EXPIRED" },
  ] as const;
  for (const expected of cases) {
    const result = serviceWith().evaluate({ evidence: bounded, asOf: expected.asOf });
    if ("compatible" in expected) {
      assert.equal(result.compatible, expected.compatible);
    } else {
      assert.equal(result.compatible, false);
      if (!result.compatible) assert.equal(result.code, expected.code);
    }
  }
});

test("temporal validity can pass while freshness fails", () => {
  const result = serviceWith().evaluate({
    evidence: observation({
      validFrom: T0,
      validUntil: at(60_000),
    }),
    asOf: at(30_000),
  });
  assert.equal(result.compatible, false);
  if (!result.compatible) assert.equal(result.code, "STALE_EVIDENCE");
});

test("maps registry value, subject, and required-unit failures", () => {
  const cases = [
    {
      evidence: observation({
        value: { type: "BOOLEAN", booleanValue: true },
      }),
      code: "VALUE_TYPE_NOT_ALLOWED",
    },
    {
      evidence: observation({
        subject: { type: "MARKET", key: "CRYPTO" },
      }),
      code: "SUBJECT_TYPE_NOT_ALLOWED",
    },
    {
      evidence: observation({
        value: { type: "NUMBER", numberValue: 1 },
      }),
      code: "UNIT_REQUIRED",
    },
  ] as const;
  for (const expected of cases) {
    const result = serviceWith().evaluate({
      evidence: expected.evidence,
      asOf: T0,
    });
    assert.equal(result.compatible, false);
    if (!result.compatible) {
      assert.equal(result.code, expected.code);
      assert.equal(result.factorDefinitionVersion, 1);
    }
  }
});

test("maps forbidden and allow-list unit failures", () => {
  const forbidden = serviceWith(factorDefinition({
    unit: { policy: "FORBIDDEN" },
  })).evaluate({ evidence: observation(), asOf: T0 });
  assert.equal(forbidden.compatible, false);
  if (!forbidden.compatible) assert.equal(forbidden.code, "UNIT_FORBIDDEN");

  const allowList = serviceWith(factorDefinition({
    unit: { policy: "ALLOW_LIST", allowedUnits: ["USD"] },
  })).evaluate({ evidence: observation(), asOf: T0 });
  assert.equal(allowList.compatible, false);
  if (!allowList.compatible) assert.equal(allowList.code, "UNIT_NOT_ALLOWED");
});

test("deprecated factors require explicit allowance and disabled factors always fail", () => {
  const deprecated = serviceWith(factorDefinition({ status: "DEPRECATED" }));
  const rejected = deprecated.evaluate({ evidence: observation(), asOf: T0 });
  assert.equal(rejected.compatible, false);
  if (!rejected.compatible) assert.equal(rejected.code, "INACTIVE_FACTOR");
  assert.equal(deprecated.evaluate({
    evidence: observation(),
    asOf: T0,
    allowDeprecatedFactor: true,
  }).compatible, true);

  const disabled = serviceWith(factorDefinition({ status: "DISABLED" }));
  const disabledResult = disabled.evaluate({
    evidence: observation(),
    asOf: T0,
    allowDeprecatedFactor: true,
  });
  assert.equal(disabledResult.compatible, false);
  if (!disabledResult.compatible) assert.equal(disabledResult.code, "INACTIVE_FACTOR");
});

test("validity-interval and non-expiring policies are not independently aged", () => {
  for (const kind of ["VALIDITY_INTERVAL", "NON_EXPIRING"] as const) {
    const result = serviceWith(factorDefinition({
      freshness: { kind },
    })).evaluate({
      evidence: observation(),
      asOf: at(60_000),
    });
    assert.equal(result.compatible, true);
    if (result.compatible) {
      assert.deepEqual(result.freshness, {
        status: "NOT_APPLICABLE",
        policy: kind,
      });
    }
  }
});

test("malformed runtime freshness metadata fails closed", () => {
  const malformed = {
    ...factorDefinition(),
    freshness: { kind: "MALICIOUS" },
  } as unknown as FactorDefinition;
  const registry: Pick<FactorRegistry, "get" | "validateCompatibility"> = {
    get: () => malformed,
    validateCompatibility: () => ({
      valid: true,
      definition: malformed,
    }),
  };
  const result = new EvidenceFactorCompatibilityService({
    factorRegistry: registry,
  }).evaluate({ evidence: observation(), asOf: T0 });
  assert.equal(result.compatible, false);
  if (!result.compatible) assert.equal(result.code, "INVALID_FRESHNESS_POLICY");
});

test("delegates structural compatibility exactly once with extracted primitives", () => {
  let validationCalls = 0;
  let received: unknown;
  const definition = factorDefinition();
  const service = new EvidenceFactorCompatibilityService({
    factorRegistry: {
      get: () => definition,
      validateCompatibility: (params) => {
        validationCalls += 1;
        received = params;
        return { valid: true, definition };
      },
    },
  });
  service.evaluate({
    evidence: observation(),
    asOf: T0,
    allowDeprecatedFactor: true,
  });
  assert.equal(validationCalls, 1);
  assert.deepEqual(received, {
    factorKey: "MARKET.PRICE",
    valueType: "NUMBER",
    subjectType: "INSTRUMENT",
    unit: "USDT",
    allowDeprecated: true,
  });
});

test("does not normalize factor keys or units", () => {
  for (const factorKey of [" MARKET.PRICE", "market.price", "MARKET.PRICE "]) {
    const result = serviceWith().evaluate({
      evidence: observation({ factorKey }),
      asOf: T0,
    });
    assert.equal(result.compatible, false);
  }
  for (const unit of [" USDT", "USDT "]) {
    const result = serviceWith().evaluate({
      evidence: observation({
        value: { type: "NUMBER", numberValue: 1, unit },
      }),
      asOf: T0,
    });
    assert.equal(result.compatible, false);
    if (!result.compatible) assert.equal(result.code, "UNIT_REQUIRED");
  }
  assert.equal(serviceWith().evaluate({
    evidence: observation({
      value: { type: "NUMBER", numberValue: 1, unit: "usdt" },
    }),
    asOf: T0,
  }).compatible, true);
});

test("does not mutate inputs and returns independent evaluation dates", () => {
  const evidence = observation();
  Object.freeze(evidence.value);
  Object.freeze(evidence.subject);
  Object.freeze(evidence);
  const asOf = at(1_000);
  const service = serviceWith();
  const first = service.evaluate({ evidence, asOf });
  assert.equal(first.compatible, true);
  first.evaluatedAt?.setUTCFullYear(2030);
  const second = service.evaluate({ evidence, asOf });
  assert.equal(second.evaluatedAt?.toISOString(), at(1_000).toISOString());
  assert.equal(asOf.toISOString(), at(1_000).toISOString());
});

test("fixed inputs produce deterministic results", () => {
  const service = serviceWith();
  assert.deepEqual(
    service.evaluate({ evidence: observation(), asOf: at(5_000) }),
    service.evaluate({ evidence: observation(), asOf: at(5_000) }),
  );
});

test("service has no repository, lifecycle, runtime, or scoring imports", () => {
  const source = readFileSync(
    "src/services/evidence/evidence-factor-compatibility.service.ts",
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /evidence\.repository|evidence-read|lifecycle-resolver|provider-runner|scoring-engine|evaluator-registry|controllers|schedulers|analyzer|frontend/i,
  );
});
