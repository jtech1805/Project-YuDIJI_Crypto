import { z } from "zod";
import { DEFAULT_VERSIONED_FACTOR_DEFINITIONS } from "../../registries/versioned-factor-definition.registry.js";
import { DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS } from "../../registries/versioned-evaluator-declaration.registry.js";
import { DEFAULT_PROVIDER_AUTHORITY_REGISTRATIONS } from "../../registries/provider-authority.registry.js";
import { BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING } from "../../registries/btc-etf-flow-characterization.authorities.js";
import { EVIDENCE_SUBJECT_TYPES } from "../../types/evidence.types.js";
import { COMPILED_SUBJECT_BINDING_TYPES } from "../../types/compiled-rulebook.types.js";
import { DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY } from "../../types/template-draft-candidate.types.js";
import type {
  InternalTemplateDraftRequest,
  InternalTemplateDraftRagAssemblyResult,
} from "../../types/internal-template-draft-rag.types.js";
import { KnowledgeDocumentRepository } from "../../repositories/knowledge-document.repository.js";
import { TemplateDraftRegistryProjectionService } from "./template-draft-registry-projection.service.js";
import { TemplateDraftRagRuntimeBindingService } from "./template-draft-rag-runtime-binding.service.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";
import { sharedFeatureFlagService } from "../../config/feature-flags.js";
import type { RagRuntimeFeatures } from "../../types/template-draft-rag-shadow.types.js";
import type { TemplateDraftRegistryProjectionRequest } from "../../types/template-draft-registry-projection.types.js";

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Z0-9_.:-]+$/);
const requestSchema = z
  .object({
    requestId: identifier,
    requestText: z.string().trim().min(1).max(10_000).optional(),
    requestedConcepts: z
      .array(
        z
          .object({
            conceptId: identifier,
            label: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY.maxRequestedConcepts),
    subject: z
      .object({
        type: z.string().trim().min(1).max(120),
        key: z.string().trim().min(1).max(160),
        displayName: z.string().trim().min(1).max(200).optional(),
      })
      .strict(),
    runtimeBindingId: identifier,
    runtimeBindingVersion: z.number().int().positive(),
  })
  .strict();

export class InternalTemplateDraftRagRequestAssemblyService {
  public constructor(
    private readonly bindings = new TemplateDraftRagRuntimeBindingService(),
    private readonly documents = new KnowledgeDocumentRepository(),
    private readonly projections = new TemplateDraftRegistryProjectionService(),
    private readonly now: () => Date = () => new Date(),
    private readonly runtimeFeatures: () => RagRuntimeFeatures = () => ({
      aiTemplateGenerationEnabled: sharedFeatureFlagService.isEnabled(
        "AI_TEMPLATE_GENERATION_ENABLED",
      ),
      knowledgeRetrievalEnabled: sharedFeatureFlagService.isEnabled(
        "KNOWLEDGE_RETRIEVAL_ENABLED",
      ),
      ragTemplateDraftingEnabled: sharedFeatureFlagService.isEnabled(
        "RAG_TEMPLATE_DRAFTING_ENABLED",
      ),
      killSwitch: process.env.YUDIJI_RAG_KILL_SWITCH === "true",
    }),
  ) {}

  public async assemble(
    request: InternalTemplateDraftRequest,
    caller: Readonly<{ userId: string; isInternal: boolean }>,
    callerSignal?: AbortSignal,
  ): Promise<InternalTemplateDraftRagAssemblyResult> {
    const parsed = requestSchema.safeParse(request);
    if (!parsed.success)
      return Object.freeze({ assembled: false, code: "INVALID_REQUEST" });
    if (
      !(
        [
          ...EVIDENCE_SUBJECT_TYPES,
          ...COMPILED_SUBJECT_BINDING_TYPES,
        ] as readonly string[]
      ).includes(parsed.data.subject.type)
    )
      return Object.freeze({ assembled: false, code: "INVALID_SUBJECT" });
    const conceptIds = parsed.data.requestedConcepts.map(
      (concept) => concept.conceptId,
    );
    if (new Set(conceptIds).size !== conceptIds.length)
      return Object.freeze({ assembled: false, code: "DUPLICATE_CONCEPT" });
    const resolved = await this.bindings.resolve(
      parsed.data.runtimeBindingId,
      parsed.data.runtimeBindingVersion,
    );
    if (!resolved.valid)
      return Object.freeze({
        assembled: false,
        code: "RUNTIME_BINDING_UNAVAILABLE",
      });
    const asOf = this.now();
    if (!Number.isFinite(asOf.getTime()))
      return Object.freeze({ assembled: false, code: "INVALID_REQUEST" });
    const eligibleDocuments = [];
    for (const member of resolved.corpusPublication.documents) {
      const found = await this.documents.findExact(
        member.documentId,
        member.documentVersion,
      );
      if (!found.found)
        return Object.freeze({
          assembled: false,
          code: "PUBLICATION_UNAVAILABLE",
        });
      const document = found.document;
      if (
        document.corpus === "PLATFORM_KNOWLEDGE" &&
        ["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"].includes(
          document.trustLevel,
        ) &&
        (!document.effectiveFrom || document.effectiveFrom <= asOf) &&
        (!document.effectiveUntil || document.effectiveUntil > asOf)
      ) {
        eligibleDocuments.push(document.identity);
      }
    }
    if (eligibleDocuments.length === 0)
      return Object.freeze({
        assembled: false,
        code: "NO_ELIGIBLE_DOCUMENTS",
      });
    const authorities = createDefaultTemplateDraftAuthorities();
    const projection = this.projections.create(authorities);
    const executionId = `${parsed.data.requestId}_EXECUTION_1`;
    const draftingRequest = {
      requestId: parsed.data.requestId,
      requestVersion: 1,
      userPrompt:
        parsed.data.requestText ??
        parsed.data.requestedConcepts
          .map((concept) => concept.label)
          .join("; "),
      operation: "CREATE_TEMPLATE" as const,
      requestedSubject: {
        type: parsed.data.subject.type,
        key: parsed.data.subject.key,
        ...(parsed.data.subject.displayName
          ? { displayName: parsed.data.subject.displayName }
          : {}),
      },
      requestedConcepts: parsed.data.requestedConcepts.map((concept) => ({
        conceptId: concept.conceptId,
        text: concept.label,
      })),
      projectionIdentity: {
        projectionId: projection.projectionId,
        projectionVersion: projection.projectionVersion,
        projectionDigest: projection.canonicalDigest,
      },
    };
    const generation = {
      requestId: parsed.data.requestId,
      generationAttemptId: `${parsed.data.requestId}_GENERATION_1`,
      traceId: `${parsed.data.requestId}_TRACE_1`,
      draftingRequest,
      registryProjection: projection,
      currentAuthorities: authorities,
      promptIdentity: {
        promptId: resolved.binding.promptId,
        promptVersion: resolved.binding.promptVersion,
      },
      candidateSchemaVersion: resolved.binding.candidateSchemaVersion,
      requestedAt: new Date(asOf.getTime()),
    };
    const assembled: Extract<
      InternalTemplateDraftRagAssemblyResult,
      { assembled: true }
    > = freezeClone({
      assembled: true,
      execution: {
        executionId,
        bindingId: resolved.binding.bindingId,
        bindingVersion: resolved.binding.bindingVersion,
        caller,
        baselineRequest: generation,
        ragRequest: {
          requestId: parsed.data.requestId,
          requestVersion: 1,
          knowledgeMode: "REGISTRY_PLUS_PLATFORM_KNOWLEDGE" as const,
          drafting: generation,
          retrieval: {
            retrievalRequestId: `${parsed.data.requestId}_RETRIEVAL_1`,
            retrievalRequestVersion: 1,
            retrievalPolicyId: resolved.binding.retrievalPolicyId,
            retrievalPolicyVersion: resolved.binding.retrievalPolicyVersion,
            embeddingSchemaId: resolved.binding.embeddingSchemaId,
            embeddingSchemaVersion: resolved.binding.embeddingSchemaVersion,
            indexId: resolved.indexPublication.indexId,
            indexVersion: resolved.indexPublication.indexVersion,
            eligibleDocuments,
            trustLevels: ["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"],
            asOf: new Date(asOf.getTime()),
            contextId: `${parsed.data.requestId}_CONTEXT_1`,
            contextVersion: 1,
            fallbackPolicy: "FAIL",
          },
        },
        features: this.runtimeFeatures(),
        requestedAt: new Date(asOf.getTime()),
      },
    });
    return callerSignal
      ? Object.freeze({
          assembled: true,
          execution: Object.freeze({
            ...assembled.execution,
            callerSignal,
          }),
        })
      : assembled;
  }
}

export const createDefaultTemplateDraftAuthorities = (): TemplateDraftRegistryProjectionRequest =>
  freezeClone({
    projectionId: "DEFAULT_TEMPLATE_DRAFT_REGISTRY",
    projectionVersion: 1,
    factors: DEFAULT_VERSIONED_FACTOR_DEFINITIONS,
    evaluatorDeclarations: DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS,
    providerAuthorities: DEFAULT_PROVIDER_AUTHORITY_REGISTRATIONS,
    compilationMappings: [BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING],
    validationPolicy: DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY,
    capabilities: {
      weightProposalsEnabled: false as const,
      ragEnabled: false as const,
    },
  });
