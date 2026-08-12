import { type TemplateDraftGenerationRequest, type TemplateDraftPromptContext } from "../../types/template-draft-generation.types.js";
import { TEMPLATE_DRAFT_REGISTRY_GROUNDED_PROMPT } from "../../prompts/template-draft-registry-grounded.prompt.js";
const freeze = <T>(v: T): T => deepFreeze(structuredClone(v));
const deepFreeze = <T>(v: T): T => { if (v && typeof v === "object" && !Object.isFrozen(v)) { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; };
export class TemplateDraftPromptContextService {
  public build(request: TemplateDraftGenerationRequest): TemplateDraftPromptContext {
    return freeze({ promptId: request.promptIdentity.promptId, promptVersion: request.promptIdentity.promptVersion, candidateSchemaVersion: request.candidateSchemaVersion,
      request: { requestId: request.draftingRequest.requestId, userPrompt: request.draftingRequest.userPrompt, requestedConcepts: request.draftingRequest.requestedConcepts, requestedSubject: request.draftingRequest.requestedSubject ?? null },
      registryProjection: request.registryProjection, constraints: { exactReferencesOnly: true, preserveAllConcepts: true, weightsAccepted: false, ragEnabled: false } });
  }
  public messages(context: TemplateDraftPromptContext): readonly Readonly<{ role: "system" | "user"; content: string }>[] {
    return freeze([{ role: "system", content: TEMPLATE_DRAFT_REGISTRY_GROUNDED_PROMPT.systemInstruction }, { role: "user", content: JSON.stringify(context) }]);
  }
}
