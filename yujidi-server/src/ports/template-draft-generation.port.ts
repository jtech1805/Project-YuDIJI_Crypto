import type { TemplateDraftModelRequest, TemplateDraftModelResult } from "../types/template-draft-generation.types.js";
export interface TemplateDraftGenerationPort { generate(request: TemplateDraftModelRequest): Promise<TemplateDraftModelResult> }
