import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VERSIONED_FACTOR_DEFINITIONS } from "../../../src/registries/versioned-factor-definition.registry.js";
import { DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS } from "../../../src/registries/versioned-evaluator-declaration.registry.js";
import { BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER } from "../../../src/registries/provider-authority.registry.js";
import { BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING } from "../../../src/registries/btc-etf-flow-characterization.authorities.js";
import { TemplateDraftRegistryProjectionService } from "../../../src/services/template-draft-registry-projection.service.js";
import { TemplateDraftCandidateValidatorService } from "../../../src/services/template-draft-candidate-validator.service.js";
import { DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY } from "../../../src/types/template-draft-candidate.types.js";

const authorities = (change: Record<string, unknown> = {}): any => ({ projectionId: "DEFAULT_TEMPLATE_DRAFT_REGISTRY", projectionVersion: 1,
  factors: DEFAULT_VERSIONED_FACTOR_DEFINITIONS, evaluatorDeclarations: DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS,
  providerAuthorities: [BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER], compilationMappings: [BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING],
  validationPolicy: DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY, capabilities: { weightProposalsEnabled: false, ragEnabled: false }, ...change });
const setup = () => { const currentAuthorities = authorities(); const projection = new TemplateDraftRegistryProjectionService().create(currentAuthorities); return { currentAuthorities, projection }; };
const concept = (conceptId = "ETF_FLOW", text = "BTC ETF net flow") => ({ conceptId, text, categoryHint: "FACTOR" as const });
const request = (projection: any, change: Record<string, unknown> = {}): any => ({ requestId: "DRAFT_REQUEST_1", requestVersion: 1, userPrompt: "Create a BTC ETF flow template", operation: "CREATE_TEMPLATE", requestedConcepts: [concept()], projectionIdentity: { projectionId: projection.projectionId, projectionVersion: projection.projectionVersion, projectionDigest: projection.canonicalDigest }, ...change });
const binding = (change: Record<string, unknown> = {}): any => ({ bindingCandidateId: "ETF_FLOW_BINDING", requestedConceptIds: ["ETF_FLOW"], factorReference: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, relationship: "DIRECT", subjectBinding: { type: "ASSET", key: "BTC" }, valueType: "NUMBER", unit: "USD", missingDataPolicy: "BLOCK", modelSupportClaim: "SUPPORTED", ...change });
const candidate = (projection: any, change: Record<string, unknown> = {}): any => ({ candidateId: "CANDIDATE_1", candidateSchemaVersion: 1, requestId: "DRAFT_REQUEST_1", interpretedRequest: { title: "BTC ETF flow" }, requestedConceptIds: ["ETF_FLOW"], proposedBindings: [binding()], proposedUnresolvedConcepts: [], proposedClarificationQuestions: [], generationWarnings: [], generationLineage: { generationAttemptId: "ATTEMPT_1", modelProvider: "TEST_PROVIDER", modelName: "TEST_MODEL", promptId: "TEMPLATE_DRAFT_PROMPT", promptVersion: 1, registryProjectionId: projection.projectionId, registryProjectionVersion: projection.projectionVersion, registryProjectionDigest: projection.canonicalDigest }, ...change });
const validate = (changes: { request?: any; candidate?: any; authorities?: any; projection?: any } = {}) => { const base = setup(); const draftingRequest = changes.request ?? request(base.projection); const model = changes.candidate ?? candidate(base.projection); return new TemplateDraftCandidateValidatorService().validate({ draftingRequest, candidate: model, projection: changes.projection ?? base.projection, currentAuthorities: changes.authorities ?? base.currentAuthorities, validationPolicy: DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY }); };

test("exact ETF-flow reference validates without scoring, compilation, persistence, or equal-weight assignment", () => {
  const base = setup(); const draftingRequest = request(base.projection); const model = candidate(base.projection); const before = structuredClone({ draftingRequest, model, projection: base.projection, authorities: base.currentAuthorities });
  const first = validate({ request: draftingRequest, candidate: model, projection: base.projection, authorities: base.currentAuthorities }); const second = validate({ request: draftingRequest, candidate: model, projection: base.projection, authorities: base.currentAuthorities });
  assert.deepEqual(first, second); assert.equal(first.report.outcome, "COMPLETED"); assert.equal(first.validatedCandidate.supportedBindings.length, 1);
  const accepted = first.validatedCandidate.supportedBindings[0]!; assert.deepEqual(accepted.factorReference, { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }); assert.deepEqual(accepted.subjectBinding, { type: "ASSET", key: "BTC" });
  assert.equal(accepted.relationship, "DIRECT"); assert.equal(accepted.compilationSupport, "SUPPORTED"); assert.equal(accepted.weightStatus, "REQUIRES_USER_INPUT"); assert(!Object.hasOwn(accepted, "weight"));
  assert(first.report.issues.some((issue) => issue.code === "WEIGHT_MISSING_USER_INPUT")); assert.deepEqual({ draftingRequest, model, projection: base.projection, authorities: base.currentAuthorities }, before);
  assert(Object.isFrozen(first) && Object.isFrozen(first.validatedCandidate.supportedBindings));
});

test("disabled model weight is reported, never accepted, and makes the concept partial", () => {
  const base = setup(); const result = validate({ candidate: candidate(base.projection, { proposedBindings: [binding({ proposedWeight: 100 })] }) });
  assert.equal(result.report.outcome, "PARTIAL"); assert(result.report.issues.some((issue) => issue.code === "WEIGHT_PROPOSAL_DISABLED"));
  assert.deepEqual(result.validatedCandidate.unresolvedConcepts[0]!.requirements, ["REQUIRES_USER_WEIGHT"]);
});

test("identity, projection, duplicate and bound invariants deterministically fail", () => {
  const base = setup();
  const cases = [
    candidate(base.projection, { requestId: "OTHER_REQUEST" }),
    candidate(base.projection, { generationLineage: { ...candidate(base.projection).generationLineage, registryProjectionDigest: "0".repeat(64) } }),
    candidate(base.projection, { proposedBindings: [binding(), binding()] }),
    candidate(base.projection, { requestedConceptIds: ["UNKNOWN"] }),
  ];
  for (const model of cases) assert.equal(validate({ candidate: model }).report.outcome, "VALIDATION_FAILED");
  const stale = authorities({ compilationMappings: [] }); assert.equal(validate({ authorities: stale }).report.outcome, "VALIDATION_FAILED");
});

test("unknown factors, wrong versions, incompatible subjects, units and policies remain unsupported", () => {
  const base = setup();
  const variants = [
    [binding({ factorReference: { factorKey: "INVENTED.FACTOR", factorVersion: 1 } }), "FACTOR_NOT_REGISTERED"],
    [binding({ factorReference: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 99 } }), "FACTOR_VERSION_NOT_FOUND"],
    [binding({ subjectBinding: { type: "INSTRUMENT", key: "BTCUSDT" } }), "SUBJECT_TYPE_NOT_ALLOWED"],
    [binding({ subjectBinding: { type: "ASSET" } }), "SUBJECT_KEY_REQUIRED"],
    [binding({ valueType: "BOOLEAN" }), "VALUE_TYPE_INCOMPATIBLE"],
    [binding({ unit: "BTC" }), "UNIT_INCOMPATIBLE"],
    [binding({ missingDataPolicy: "NEWEST" }), "MISSING_DATA_POLICY_INVALID"],
  ] as const;
  for (const [proposed, code] of variants) { const result = validate({ candidate: candidate(base.projection, { proposedBindings: [proposed] }) }); assert.equal(result.report.outcome, "UNSUPPORTED_REQUEST"); assert(result.report.issues.some((issue) => issue.code === code)); }
});

test("DIRECT is supported, deferred relationships remain unresolved, and unknown relationships fail", () => {
  const base = setup();
  assert.equal(validate().validatedCandidate.supportedBindings[0]!.relationship, "DIRECT");
  const inverse = validate({ candidate: candidate(base.projection, { proposedBindings: [binding({ relationship: "INVERSE" })] }) }); assert.equal(inverse.report.outcome, "PARTIAL"); assert.deepEqual(inverse.validatedCandidate.unresolvedConcepts[0]!.requirements, ["REQUIRES_COMPILATION_MAPPING"]);
  const deferred = validate({ candidate: candidate(base.projection, { proposedBindings: [binding({ relationship: "VETO" })] }) }); assert.equal(deferred.report.outcome, "UNSUPPORTED_REQUEST"); assert.deepEqual(deferred.validatedCandidate.unresolvedConcepts[0]!.requirements, ["REQUIRES_COMPILATION_MAPPING", "REQUIRES_NEW_RELATIONSHIP"]);
  const unknown = validate({ candidate: candidate(base.projection, { proposedBindings: [binding({ relationship: "LATEST" })] }) }); assert.equal(unknown.report.outcome, "VALIDATION_FAILED"); assert(unknown.report.issues.some((issue) => issue.code === "RELATIONSHIP_NOT_REGISTERED"));
});

test("provider and compilation gaps are reported separately from legacy draft support", () => {
  const base = setup();
  const noProviderAuthorities = authorities({ providerAuthorities: [] }); const noProviderProjection = new TemplateDraftRegistryProjectionService().create(noProviderAuthorities);
  const providerRequest = request(noProviderProjection); const providerCandidate = candidate(noProviderProjection);
  const provider = validate({ request: providerRequest, candidate: providerCandidate, projection: noProviderProjection, authorities: noProviderAuthorities });
  assert.equal(provider.validatedCandidate.supportedBindings[0]!.legacyDraftSupport, "SUPPORTED"); assert(provider.validatedCandidate.unresolvedConcepts[0]!.requirements.includes("REQUIRES_PROVIDER"));
  const noMappingAuthorities = authorities({ compilationMappings: [] }); const noMappingProjection = new TemplateDraftRegistryProjectionService().create(noMappingAuthorities);
  const mapping = validate({ request: request(noMappingProjection), candidate: candidate(noMappingProjection), projection: noMappingProjection, authorities: noMappingAuthorities });
  assert.equal(mapping.validatedCandidate.supportedBindings[0]!.compilationSupport, "REQUIRES_COMPILATION_MAPPING"); assert(mapping.validatedCandidate.unresolvedConcepts[0]!.requirements.includes("REQUIRES_COMPILATION_MAPPING"));
});

test("unresolved and clarification outcomes account for concepts while missing accounting fails", () => {
  const base = setup(); const concepts = [concept("ONE", "one"), concept("TWO", "two")]; const req = request(base.projection, { requestedConcepts: concepts });
  const lineage = candidate(base.projection).generationLineage;
  const partial = candidate(base.projection, { requestedConceptIds: ["ONE", "TWO"], proposedBindings: [binding({ requestedConceptIds: ["ONE"] })], proposedUnresolvedConcepts: [{ conceptId: "TWO", requirements: ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"] }] });
  const result = validate({ request: req, candidate: partial }); assert.equal(result.report.outcome, "PARTIAL"); assert.deepEqual(result.validatedCandidate.unresolvedConcepts[0]!.requirements, ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"]);
  const clarification = candidate(base.projection, { requestedConceptIds: ["ONE", "TWO"], proposedBindings: [binding({ requestedConceptIds: ["ONE"] })], proposedClarificationQuestions: [{ questionId: "QUESTION_1", requestedConceptIds: ["TWO"], question: "Which instrument?" }] });
  assert.equal(validate({ request: req, candidate: clarification }).report.outcome, "PARTIAL");
  const missing = candidate(base.projection, { requestedConceptIds: ["ONE", "TWO"], proposedBindings: [binding({ requestedConceptIds: ["ONE"] })], generationLineage: lineage });
  const failed = validate({ request: req, candidate: missing }); assert.equal(failed.report.outcome, "VALIDATION_FAILED"); assert(failed.report.issues.some((issue) => issue.code === "REQUESTED_CONCEPT_NOT_ACCOUNTED_FOR"));
});

test("Tata Steel unsupported concepts are preserved without invented factor or provider authority", () => {
  const base = setup(); const requestedConcepts = [concept("LONG_BUILDUP", "long buildup"), concept("SHORT_BUILDUP", "short buildup"), concept("QUARTERLY_RESULTS", "quarterly results"), concept("BROKER_RESEARCH", "broker research")];
  const req = request(base.projection, { userPrompt: "Create a Tata Steel swing-trading template using long buildup, short buildup, quarterly results and broker research", requestedSubject: { type: "COMPANY", key: "TATA_STEEL", displayName: "Tata Steel" }, requestedConcepts });
  const unresolved = [
    { conceptId: "LONG_BUILDUP", requirements: ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"] },
    { conceptId: "SHORT_BUILDUP", requirements: ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"] },
    { conceptId: "QUARTERLY_RESULTS", requirements: ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"] },
    { conceptId: "BROKER_RESEARCH", requirements: ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"] },
  ];
  const model = candidate(base.projection, { interpretedRequest: { title: "Tata Steel swing", subject: { type: "COMPANY", key: "TATA_STEEL" } }, requestedConceptIds: requestedConcepts.map((item) => item.conceptId), proposedBindings: [], proposedUnresolvedConcepts: unresolved });
  const result = validate({ request: req, candidate: model }); assert.equal(result.report.outcome, "UNSUPPORTED_REQUEST"); assert.equal(result.validatedCandidate.unresolvedConcepts.length, 4); assert.equal(result.validatedCandidate.supportedBindings.length, 0);
  assert(!JSON.stringify(result).includes("MARKET.PRICE")); assert(!JSON.stringify(result).includes("INVENTED"));
  for (const item of result.validatedCandidate.unresolvedConcepts) assert.deepEqual(item.requirements, ["REQUIRES_NEW_FACTOR", "REQUIRES_PROVIDER"]);
});
