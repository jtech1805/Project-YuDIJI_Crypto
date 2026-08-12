import { KnowledgeVectorIndexPublicationRepository } from "../../repositories/knowledge-vector-index-publication.repository.js";
import { KnowledgeCorpusPublicationRepository } from "../../repositories/knowledge-corpus-publication.repository.js";
import { TemplateDraftRagRuntimeBindingRegistry } from "../../registries/template-draft-rag-runtime-binding.registry.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";
export class TemplateDraftRagRuntimeBindingService {
  constructor(
    private bindings = new TemplateDraftRagRuntimeBindingRegistry(),
    private indexes = new KnowledgeVectorIndexPublicationRepository(),
    private corpora = new KnowledgeCorpusPublicationRepository(),
  ) {}
  async resolve(id: string, v: number) {
    const binding = this.bindings.getExact(id, v);
    if (!binding)
      return Object.freeze({
        valid: false as const,
        code: "RUNTIME_BINDING_INVALID",
      });
    const i = await this.indexes.findExact(
      binding.indexPublicationId,
      binding.indexPublicationVersion,
    );
    if (
      !i.found ||
      i.publication.embeddingSchemaId !== binding.embeddingSchemaId ||
      i.publication.embeddingSchemaVersion !== binding.embeddingSchemaVersion
    )
      return Object.freeze({
        valid: false as const,
        code: "RUNTIME_BINDING_INVALID",
      });
    const c = await this.corpora.findExact(
      i.publication.corpusPublicationId,
      i.publication.corpusPublicationVersion,
    );
    if (!c.found || c.publication.corpus !== binding.corpus)
      return Object.freeze({
        valid: false as const,
        code: "RUNTIME_BINDING_INVALID",
      });
    return freezeClone({
      valid: true as const,
      binding,
      indexPublication: i.publication,
      corpusPublication: c.publication,
    });
  }
}
