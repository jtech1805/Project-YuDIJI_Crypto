import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VERSIONED_FACTOR_DEFINITIONS } from "../../../src/registries/versioned-factor-definition.registry.js";
import { DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS } from "../../../src/registries/versioned-evaluator-declaration.registry.js";
import { BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER } from "../../../src/registries/provider-authority.registry.js";
import { BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING } from "../../../src/registries/btc-etf-flow-characterization.authorities.js";
import { TemplateDraftRegistryProjectionService } from "../../../src/services/copilot/template-draft-registry-projection.service.js";
import { TemplateDraftCandidateValidatorService } from "../../../src/services/copilot/template-draft-candidate-validator.service.js";
import { TemplateDraftPromptContextService } from "../../../src/services/copilot/template-draft-prompt-context.service.js";
import { TemplateDraftReviewReportService } from "../../../src/services/copilot/template-draft-review-report.service.js";
import { TemplateDraftGenerationService } from "../../../src/services/copilot/template-draft-generation.service.js";
import { DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY } from "../../../src/types/template-draft-candidate.types.js";
const authorities: any = {
  projectionId: "DRAFT_REGISTRY",
  projectionVersion: 1,
  factors: DEFAULT_VERSIONED_FACTOR_DEFINITIONS,
  evaluatorDeclarations: DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS,
  providerAuthorities: [BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER],
  compilationMappings: [BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING],
  validationPolicy: DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY,
  capabilities: { weightProposalsEnabled: false, ragEnabled: false },
};
const projection = new TemplateDraftRegistryProjectionService().create(
  authorities,
);
const concept = (conceptId = "ETF", text = "ETF flow") => ({
  conceptId,
  text,
  categoryHint: "FACTOR",
});
const request = (concepts: any[] = [concept()]): any => ({
  requestId: "REQUEST_1",
  requestVersion: 1,
  userPrompt: "Create template",
  operation: "CREATE_TEMPLATE",
  requestedConcepts: concepts,
  projectionIdentity: {
    projectionId: projection.projectionId,
    projectionVersion: 1,
    projectionDigest: projection.canonicalDigest,
  },
});
const candidate = (change: any = {}): any => ({
  candidateId: "CANDIDATE_1",
  candidateSchemaVersion: 1,
  requestId: "REQUEST_1",
  interpretedRequest: { title: "ETF flow" },
  requestedConceptIds: ["ETF"],
  proposedBindings: [
    {
      bindingCandidateId: "BINDING_1",
      requestedConceptIds: ["ETF"],
      factorReference: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 },
      relationship: "DIRECT",
      subjectBinding: { type: "ASSET", key: "BTC" },
      valueType: "NUMBER",
      unit: "USD",
      missingDataPolicy: "BLOCK",
      proposedWeight: 100,
      modelSupportClaim: "SUPPORTED",
    },
  ],
  proposedUnresolvedConcepts: [],
  proposedClarificationQuestions: [],
  generationWarnings: [],
  generationLineage: {
    generationAttemptId: "ATTEMPT_1",
    modelProvider: "FAKE",
    modelName: "FAKE_MODEL",
    promptId: "TEMPLATE_DRAFT_REGISTRY_GROUNDED",
    promptVersion: 1,
    registryProjectionId: projection.projectionId,
    registryProjectionVersion: 1,
    registryProjectionDigest: projection.canonicalDigest,
  },
  ...change,
});
const generationRequest = (draft = request()): any => ({
  requestId: "REQUEST_1",
  generationAttemptId: "ATTEMPT_1",
  traceId: "TRACE_1",
  draftingRequest: draft,
  registryProjection: projection,
  currentAuthorities: authorities,
  promptIdentity: {
    promptId: "TEMPLATE_DRAFT_REGISTRY_GROUNDED",
    promptVersion: 1,
  },
  candidateSchemaVersion: 1,
  requestedAt: new Date("2026-08-05T00:00:00Z"),
});
const harness = (output: any, enabled = true, traceReject = false) => {
  let calls = 0;
  const traces: any[] = [];
  const service = new TemplateDraftGenerationService({
    flags: { isEnabled: () => enabled } as any,
    port: {
      generate: async () => {
        calls++;
        return typeof output === "object" && output.completed !== undefined
          ? output
          : {
              completed: true,
              output,
              provider: "FAKE",
              model: "FAKE_MODEL",
              completedAt: new Date("2026-08-05T00:00:01Z"),
            };
      },
    },
    prompts: new TemplateDraftPromptContextService(),
    validator: new TemplateDraftCandidateValidatorService(),
    reviews: new TemplateDraftReviewReportService(),
    traces: {
      record: async (i: any) => {
        traces.push(i);
        if (traceReject) throw new Error("trace");
      },
    },
  });
  return { service, traces, calls: () => calls };
};
test("feature disabled makes no provider call or trace and default flag remains false", async () => {
  const h = harness(candidate(), false);
  const result = await h.service.generate(generationRequest());
  assert.equal(result.status, "FEATURE_DISABLED");
  assert.equal(h.calls(), 0);
  assert.equal(h.traces.length, 0);
});
test("ETF flow invokes once, validates once semantically, rejects weight and returns immutable PARTIAL report", async () => {
  const h = harness(candidate());
  const input = generationRequest(),
    before = structuredClone(input);
  const a = await h.service.generate(input),
    b = await harness(candidate()).service.generate(input);
  assert.equal(a.status, "PARTIAL");
  assert.deepEqual(a, b);
  assert.equal(h.calls(), 1);
  assert.equal(h.traces.length, 1);
  assert.equal(h.traces[0].status, "COMPLETED");
  assert(!JSON.stringify(h.traces[0]).includes("Create template"));
  assert(!JSON.stringify(h.traces[0]).includes("proposedBindings"));
  if (a.status === "PARTIAL") {
    assert.equal(
      a.validatedCandidate.supportedBindings[0]!.factorReference.factorKey,
      "CRYPTO.ETF_NET_FLOW",
    );
    assert.equal(a.reviewReport.supportedBindings[0]!.providerAvailable, true);
    assert.equal(
      a.reviewReport.supportedBindings[0]!.compilationSupport,
      "SUPPORTED",
    );
    assert(a.reviewReport.limitations.includes("WEIGHTS_REQUIRE_USER_INPUT"));
    assert(Object.isFrozen(a) && Object.isFrozen(a.reviewReport));
  }
  assert.deepEqual(input, before);
});
test("provider, empty, malformed and schema-invalid output map without retry", async () => {
  for (const [output, status, reason] of [
    [
      {
        completed: false,
        code: "PROVIDER_FAILED",
        provider: "FAKE",
        model: null,
        completedAt: new Date("2026-08-05T00:00:01Z"),
      },
      "PROVIDER_FAILED",
      "PROVIDER_FAILED",
    ],
    [
      {
        completed: false,
        code: "EMPTY_RESPONSE",
        provider: "FAKE",
        model: null,
        completedAt: new Date("2026-08-05T00:00:01Z"),
      },
      "PROVIDER_FAILED",
      "EMPTY_RESPONSE",
    ],
    ["{bad", "VALIDATION_FAILED", "MALFORMED_MODEL_OUTPUT"],
    [{}, "VALIDATION_FAILED", "MODEL_SCHEMA_INVALID"],
  ] as any[]) {
    const h = harness(output);
    const r: any = await h.service.generate(generationRequest());
    assert.equal(r.status, status);
    assert.equal(r.reasonCode, reason);
    assert.equal(h.calls(), 1);
    assert.equal(h.traces.length, 1);
  }
});
test("hallucinated identities never become supported", async () => {
  for (const change of [
    {
      proposedBindings: [
        {
          ...candidate().proposedBindings[0],
          factorReference: { factorKey: "INVENTED.FACTOR", factorVersion: 1 },
        },
      ],
    },
    {
      proposedBindings: [
        {
          ...candidate().proposedBindings[0],
          factorReference: {
            factorKey: "CRYPTO.ETF_NET_FLOW",
            factorVersion: 99,
          },
        },
      ],
    },
    {
      proposedBindings: [
        { ...candidate().proposedBindings[0], relationship: "VETO" },
      ],
    },
    { requestId: "OTHER" },
    {
      generationLineage: {
        ...candidate().generationLineage,
        registryProjectionDigest: "0".repeat(64),
      },
    },
  ]) {
    const r: any = await harness(candidate(change)).service.generate(
      generationRequest(),
    );
    assert(!r.reviewReport || r.reviewReport.supportedBindings.length === 0);
  }
});
test("Tata Steel preserves every unsupported concept with no invented authority", async () => {
  const concepts = [
    concept("LONG", "long buildup"),
    concept("SHORT", "short buildup"),
    concept("RESULTS", "quarterly results"),
    concept("RESEARCH", "broker research"),
  ];
  const draft = request(concepts);
  const unresolved = concepts.map((c) => ({
    conceptId: c.conceptId,
    requirements: ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"],
  }));
  const model = candidate({
    interpretedRequest: {
      title: "Tata Steel",
      subject: { type: "COMPANY", key: "TATA_STEEL" },
    },
    requestedConceptIds: concepts.map((c) => c.conceptId),
    proposedBindings: [],
    proposedUnresolvedConcepts: unresolved,
  });
  const r: any = await harness(model).service.generate(
    generationRequest(draft),
  );
  assert.equal(r.status, "UNSUPPORTED_REQUEST");
  assert.equal(r.reviewReport.requestedConcepts.length, 4);
  assert.equal(r.reviewReport.supportedBindings.length, 0);
  assert(!JSON.stringify(r).includes("MARKET.PRICE"));
});
test("trace persistence failure is isolated from successful generation", async () => {
  const r = await harness(candidate(), true, true).service.generate(
    generationRequest(),
  );
  assert.equal(r.status, "PARTIAL");
});
