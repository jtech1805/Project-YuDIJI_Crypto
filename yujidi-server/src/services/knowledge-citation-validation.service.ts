import { freezeClone } from "./knowledge-document-admission.service.js";
import type { KnowledgeRetrievalContext } from "../types/knowledge-context.types.js";
import type { KnowledgeCitationValidation } from "../types/knowledge-citation.types.js";
export class KnowledgeCitationValidationService { public validate(handles:readonly string[],context:KnowledgeRetrievalContext):readonly KnowledgeCitationValidation[]{const seen=new Set<string>();const selected=new Set(context.passages.map(x=>x.citationHandle));return freezeClone(handles.map(handle=>{if(seen.has(handle))return{handle,status:"DUPLICATE_HANDLE" as const};seen.add(handle);return{handle,status:selected.has(handle)?"VALID" as const:"UNKNOWN_HANDLE" as const};}));} }
