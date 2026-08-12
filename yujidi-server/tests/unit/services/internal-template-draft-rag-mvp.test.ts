import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createInternalTemplateDraftRagController } from "../../../src/controllers/internal-template-draft-rag.controller.js";
import { InternalTemplateDraftRagApplicationService } from "../../../src/services/copilot/internal-template-draft-rag-application.service.js";
import { InternalTemplateDraftRagRequestAssemblyService } from "../../../src/services/copilot/internal-template-draft-rag-request-assembly.service.js";

const now = new Date("2026-08-11T10:00:00.000Z");
const request = {
  requestId: "INTERNAL_ETF_1",
  requestText: "Create a BTC template using ETF net flow",
  requestedConcepts: [{ conceptId: "ETF", label: "ETF net flow" }],
  subject: { type: "ASSET", key: "BTC" },
  runtimeBindingId: "YUDIJI_TEMPLATE_DRAFT_RAG_RUNTIME",
  runtimeBindingVersion: 1,
};

const resolved = {
  valid: true as const,
  binding: {
    bindingId: "YUDIJI_TEMPLATE_DRAFT_RAG_RUNTIME",
    bindingVersion: 1,
    promptId: "TEMPLATE_DRAFT_REGISTRY_GROUNDED",
    promptVersion: 1,
    candidateSchemaVersion: 1,
    retrievalPolicyId: "GEMINI_ATLAS_RAG_LIVE",
    retrievalPolicyVersion: 1,
    embeddingSchemaId: "YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING",
    embeddingSchemaVersion: 1,
  },
  indexPublication: {
    indexId: "YUDIJI_ATLAS_PLATFORM_KNOWLEDGE_GEMINI_768",
    indexVersion: 1,
  },
  corpusPublication: {
    documents: [
      { documentId: "DOC_A", documentVersion: 1 },
      { documentId: "DOC_B", documentVersion: 1 },
    ],
  },
};

const document = (id: string) => ({
  found: true as const,
  document: {
    identity: { documentId: id, documentVersion: 1 },
    corpus: "PLATFORM_KNOWLEDGE",
    trustLevel: "AUTHORITATIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
});

const assembly = () =>
  new InternalTemplateDraftRagRequestAssemblyService(
    { resolve: async () => resolved } as any,
    { findExact: async (id: string) => document(id) } as any,
    undefined,
    () => new Date(now),
    () => ({
      aiTemplateGenerationEnabled: true,
      knowledgeRetrievalEnabled: true,
      ragTemplateDraftingEnabled: true,
      killSwitch: false,
    }),
  );

test("assembly preserves structured intent and derives all authority server-side", async () => {
  const callerSignal = new AbortController().signal;
  const result = await assembly().assemble(
    request,
    {
      userId: "INTERNAL_USER",
      isInternal: true,
    },
    callerSignal,
  );
  assert.equal(result.assembled, true);
  if (!result.assembled) return;
  assert.deepEqual(
    result.execution.baselineRequest.draftingRequest.requestedConcepts,
    [{ conceptId: "ETF", text: "ETF net flow" }],
  );
  assert.deepEqual(result.execution.ragRequest.retrieval?.eligibleDocuments, [
    { documentId: "DOC_A", documentVersion: 1 },
    { documentId: "DOC_B", documentVersion: 1 },
  ]);
  assert.equal(
    result.execution.baselineRequest.registryProjection.factors.some(
      (factor) => factor.factorKey === "CRYPTO.ETF_NET_FLOW",
    ),
    true,
  );
  assert.equal(
    result.execution.requestedAt.toISOString(),
    result.execution.ragRequest.retrieval?.asOf.toISOString(),
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.execution.callerSignal, callerSignal);
});

test("unsupported Tata concepts remain unchanged through assembly", async () => {
  const concepts = [
    { conceptId: "LONG", label: "long buildup" },
    { conceptId: "SHORT", label: "short buildup" },
    { conceptId: "RESULTS", label: "quarterly results" },
    { conceptId: "RESEARCH", label: "broker research" },
  ];
  const result = await assembly().assemble(
    {
      ...request,
      requestId: "INTERNAL_TATA_1",
      requestedConcepts: concepts,
      subject: { type: "TRADED_INSTRUMENT", key: "TATASTEEL" },
    },
    { userId: "INTERNAL_USER", isInternal: true },
  );
  assert.equal(result.assembled, true);
  if (!result.assembled) return;
  assert.deepEqual(
    result.execution.baselineRequest.draftingRequest.requestedConcepts.map(
      (concept) => concept.text,
    ),
    concepts.map((concept) => concept.label),
  );
  assert.equal(
    result.execution.baselineRequest.draftingRequest.requestedConcepts.some(
      (concept) => concept.text === "MARKET.PRICE",
    ),
    false,
  );
});

test("assembly rejects duplicate concepts, malformed subjects, unknown binding, and authority injection", async () => {
  const duplicate = await assembly().assemble(
    {
      ...request,
      requestedConcepts: [
        request.requestedConcepts[0]!,
        request.requestedConcepts[0]!,
      ],
    },
    { userId: "U", isInternal: true },
  );
  assert.deepEqual(duplicate, {
    assembled: false,
    code: "DUPLICATE_CONCEPT",
  });
  const invalidSubject = await assembly().assemble(
    { ...request, subject: { type: "MADE_UP", key: "BTC" } },
    { userId: "U", isInternal: true },
  );
  assert.equal(invalidSubject.assembled, false);
  const unknown = new InternalTemplateDraftRagRequestAssemblyService({
    resolve: async () => ({ valid: false }),
  } as any);
  assert.deepEqual(
    await unknown.assemble(request, { userId: "U", isInternal: true }),
    { assembled: false, code: "RUNTIME_BINDING_UNAVAILABLE" },
  );
  const injected = await assembly().assemble(
    { ...request, registryProjection: {} } as any,
    { userId: "U", isInternal: true },
  );
  assert.deepEqual(injected, { assembled: false, code: "INVALID_REQUEST" });
});

test("application delegates once to governed dual path and returns bounded shadow result", async () => {
  let executions = 0;
  const events: any[] = [];
  const execution = {
    executionId: "E",
    bindingId: "B",
    bindingVersion: 1,
    requestedAt: now,
    baselineRequest: {
      registryProjection: { projectionId: "P", projectionVersion: 1 },
    },
    ragRequest: { retrieval: { eligibleDocuments: [{ documentId: "D" }] } },
  };
  const service = new InternalTemplateDraftRagApplicationService(
    { assemble: async () => ({ assembled: true, execution }) } as any,
    {
      execute: async () => {
        executions += 1;
        return {
          executionId: "E",
          status: "AUTHORITATIVE_AVAILABLE_SHADOW_FAILED",
          authoritativeResultUntouched: true,
          requestCountAdmission: 1,
          usage: [],
          authoritativeBaseline: { status: "PARTIAL" },
          shadow: { status: "FAILED" },
          telemetry: {
            budgetAdmission: "ALLOWED",
            concurrencyAdmission: "ACQUIRED",
            baselineOutcome: "PARTIAL",
            ragOutcome: "RETRIEVAL_FAILED",
            comparisonOutcome: "NOT_COMPARABLE",
            circuitStates: {},
            baselineGenerationLatencyMs: 1,
            embeddingLatencyMs: 1,
            retrievalLatencyMs: 1,
            contextAssemblyLatencyMs: null,
            ragGenerationLatencyMs: null,
            indexPublicationId: "INDEX",
            indexPublicationVersion: 1,
            totalLatencyMs: 2,
          },
        };
      },
    } as any,
    {
      info: (event: unknown) => events.push(event),
      warn: (event: unknown) => events.push(event),
    },
  );
  const result = await service.execute(request, { userId: "U" });
  assert.equal(executions, 1);
  assert.equal(result.shadowOnly, true);
  assert.equal(result.authoritativeBaseline?.status, "PARTIAL");
  assert.equal(result.ragShadow?.status, "FAILED");
  assert.equal(result.comparison, undefined);
  assert.deepEqual(
    events
      .filter((event) => event.event === "INTERNAL_RAG_STAGE_COMPLETED")
      .map((event) => event.stage),
    [
      "REQUEST_ASSEMBLY",
      "GOVERNANCE_ADMISSION",
      "BASELINE_GENERATION",
      "QUERY_EMBEDDING",
      "VECTOR_RETRIEVAL",
      "CONTEXT_ASSEMBLY",
      "RAG_GENERATION",
      "COMPARISON",
    ],
  );
  assert.equal(JSON.stringify(events).includes(request.requestText), false);
});

test("thin controller passes authenticated principal and caller signal without logging or persistence", async () => {
  let received: any;
  const handler = createInternalTemplateDraftRagController(() => ({
    execute: async (body, principal, signal) => {
      received = { body, principal, signal };
      return { executionId: "E", shadowOnly: true } as any;
    },
  }));
  const req = Object.assign(new EventEmitter(), {
    body: request,
    applicationPrincipal: { userId: "INTERNAL_USER", roles: ["INTERNAL"] },
  });
  let response: any;
  const res = Object.assign(new EventEmitter(), {
    writableEnded: false,
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      response = value;
      this.writableEnded = true;
      return this;
    },
  });
  await handler(req as any, res as any);
  assert.equal(res.statusCode, 200);
  assert.equal(received.principal.userId, "INTERNAL_USER");
  assert.equal(received.signal instanceof AbortSignal, true);
  assert.equal(response.data.shadowOnly, true);
});
