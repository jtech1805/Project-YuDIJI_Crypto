import type { KnowledgeDocumentAdmissionRequest, KnowledgeDocumentServiceResult } from "../types/knowledge-admission.types.js";
import { KnowledgeDocumentAdmissionService } from "./knowledge-document-admission.service.js";
import { KnowledgeDocumentRepository } from "../repositories/knowledge-document.repository.js";
export class KnowledgeDocumentService {
  public constructor(private readonly admission = new KnowledgeDocumentAdmissionService(), private readonly repository = new KnowledgeDocumentRepository()) {}
  public async create(request: KnowledgeDocumentAdmissionRequest): Promise<KnowledgeDocumentServiceResult> {
    const admitted = this.admission.admit(request); if (!admitted.admitted) return Object.freeze({ status: "VALIDATION_FAILED", code: admitted.code });
    const inserted = await this.repository.insert(admitted.document); if (inserted.inserted) return Object.freeze({ status: "CREATED", document: inserted.document });
    if (inserted.code === "ALREADY_EXISTS" && inserted.document) return Object.freeze({ status: "ALREADY_EXISTS", document: inserted.document });
    return Object.freeze({ status: inserted.code === "ALREADY_EXISTS" ? "INVARIANT_VIOLATION" : inserted.code });
  }
}
