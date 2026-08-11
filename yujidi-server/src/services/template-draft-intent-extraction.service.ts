import { z } from "zod";
import {
  TEMPLATE_DRAFT_INTENT_CONCEPT_VOCABULARY,
  TEMPLATE_DRAFT_INTENT_SUBJECT_VOCABULARY,
} from "../registries/template-draft-intent-vocabulary.registry.js";
import { DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY } from "../types/template-draft-candidate.types.js";
import type {
  TemplateDraftIntentConcept,
  TemplateDraftIntentExtractionRequest,
  TemplateDraftIntentExtractionResult,
  TemplateDraftIntentModelOutput,
  TemplateDraftIntentModelPort,
} from "../types/template-draft-intent.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";

const identifier = z.string().trim().min(1).max(120);
const DRAFT_OPERATION_TERMS = new Set([
  "create",
  "draft",
  "strategy",
  "template",
  "trading strategy",
  "scoring template",
]);
export const templateDraftIntentModelSchema = z
  .object({
    subject: z
      .object({
        type: identifier,
        key: z.string().trim().min(1).max(160),
        displayName: z.string().trim().min(1).max(200).optional(),
      })
      .strict()
      .nullable(),
    concepts: z
      .array(
        z
          .object({
            sourceText: z.string().trim().min(1).max(500),
            candidateConceptId: identifier.nullable(),
          })
          .strict(),
      )
      .max(DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY.maxRequestedConcepts),
    clarificationQuestions: z
      .array(z.string().trim().min(1).max(500))
      .max(DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY.maxClarificationQuestions),
  })
  .strict();

export class TemplateDraftIntentExtractionService {
  public constructor(private readonly model: TemplateDraftIntentModelPort) {}

  public async extract(
    request: TemplateDraftIntentExtractionRequest,
    signal?: AbortSignal,
  ): Promise<TemplateDraftIntentExtractionResult> {
    if (
      !request ||
      !/^[A-Z0-9_.:-]{1,120}$/.test(request.requestId) ||
      typeof request.prompt !== "string" ||
      request.prompt.trim().length === 0 ||
      request.prompt.length > DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY.maxPromptCharacters
    )
      return Object.freeze({ status: "FAILED", code: "INVALID_REQUEST" });
    const response = await this.model.extract(
      {
        correlationId: request.requestId,
        prompt: request.prompt,
        conceptVocabulary: TEMPLATE_DRAFT_INTENT_CONCEPT_VOCABULARY,
        subjectVocabulary: TEMPLATE_DRAFT_INTENT_SUBJECT_VOCABULARY,
      },
      signal ? { signal } : undefined,
    );
    if (!response.completed)
      return Object.freeze({ status: "FAILED", code: response.code });
    const parsed = templateDraftIntentModelSchema.safeParse(response.output);
    if (!parsed.success)
      return Object.freeze({ status: "FAILED", code: "SCHEMA_INVALID" });
    return this.validate(parsed.data);
  }

  private validate(
    output: TemplateDraftIntentModelOutput,
  ): TemplateDraftIntentExtractionResult {
    const subject = output.subject
      ? TEMPLATE_DRAFT_INTENT_SUBJECT_VOCABULARY.find(
          (entry) =>
            entry.type === output.subject?.type && entry.key === output.subject.key,
        )
      : undefined;
    const concepts = canonicalConcepts(output.concepts);
    const questions = [...new Set(output.clarificationQuestions)];
    if (!subject) {
      if (questions.length === 0)
        questions.push("Which supported asset or instrument should this template apply to?");
      return freezeClone({
        status: "NEEDS_CLARIFICATION" as const,
        clarificationQuestions: questions,
        partialIntent: { requestedConcepts: concepts },
      });
    }
    if (concepts.length === 0) {
      if (questions.length === 0)
        questions.push("Which factors or concepts should this template use?");
      return freezeClone({
        status: "NEEDS_CLARIFICATION" as const,
        clarificationQuestions: questions,
        partialIntent: {
          subject: projectSubject(subject),
          requestedConcepts: concepts,
        },
      });
    }
    const unresolvedConcepts = concepts.filter((concept) => !concept.registered);
    return freezeClone({
      status: unresolvedConcepts.length ? "UNSUPPORTED_REQUEST" : "COMPLETED",
      subject: projectSubject(subject),
      requestedConcepts: concepts,
      unresolvedConcepts,
    });
  }
}

const canonicalConcepts = (
  concepts: TemplateDraftIntentModelOutput["concepts"],
): readonly TemplateDraftIntentConcept[] => {
  const values = new Map<string, TemplateDraftIntentConcept>();
  for (const concept of concepts) {
    const normalized = normalize(concept.sourceText);
    if (DRAFT_OPERATION_TERMS.has(normalized)) continue;
    const registered = TEMPLATE_DRAFT_INTENT_CONCEPT_VOCABULARY.find((entry) =>
      entry.labels.some((label) => normalize(label) === normalized),
    );
    const conceptId = registered?.conceptId ?? unresolvedId(concept.sourceText);
    if (!values.has(conceptId))
      values.set(conceptId, {
        conceptId,
        label: concept.sourceText.trim(),
        registered: registered !== undefined,
      });
  }
  return [...values.values()];
};

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
const unresolvedId = (value: string): string => {
  const id = normalize(value).toUpperCase().replace(/ /g, "_").slice(0, 120);
  return id || "UNRESOLVED_CONCEPT";
};
const projectSubject = (
  value: (typeof TEMPLATE_DRAFT_INTENT_SUBJECT_VOCABULARY)[number],
) => ({ type: value.type, key: value.key, displayName: value.displayName });
