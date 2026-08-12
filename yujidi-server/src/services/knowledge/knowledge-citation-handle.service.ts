import { CanonicalCompilationInputService } from "../compiled-rulebook/canonical-compilation-input.service.js";
import type { KnowledgeCitationMaterial } from "../../types/knowledge-citation.types.js";
export class KnowledgeCitationHandleService { public constructor(private readonly canonical=new CanonicalCompilationInputService()){} public create(material:KnowledgeCitationMaterial):string|null{const value=this.canonical.hash(material);return value.hashed?`ycit_v1_${value.hash}`:null;} }
