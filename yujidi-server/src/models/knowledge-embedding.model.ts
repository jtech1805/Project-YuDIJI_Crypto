import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { KNOWLEDGE_CORPORA, KNOWLEDGE_TRUST_LEVELS } from "../types/knowledge-document.types.js";

const id = { type: String, required: true, trim: true, maxlength: 160 } as const;
const version = { type: Number, required: true, min: 1 } as const;
const digest = { type: String, required: true, minlength: 64, maxlength: 64 } as const;
const vector = {
  type: [Number],
  required: true,
  validate: {
    validator: (values: number[]) => values.length > 0 && values.length <= 4_096 && values.every(Number.isFinite),
    message: "vector must contain bounded finite values",
  },
} as const;

export const knowledgeEmbeddingSchema = new Schema({
  embeddingId: id,
  embeddingVersion: version,
  chunkSetIdentity: { _id: false, chunkSetId: id, chunkSetVersion: version },
  documentIdentity: { _id: false, documentId: id, documentVersion: version },
  chunkIdentity: { _id: false, chunkId: id, chunkVersion: version },
  chunkContentDigest: digest,
  embeddingTextProjector: { _id: false, projectorId: id, projectorVersion: version },
  embeddingTextDigest: digest,
  provider: { _id: false, providerId: id, providerVersion: version },
  model: { _id: false, modelId: id, modelVersion: { type: String, required: true, trim: true, maxlength: 120 } },
  embeddingSchema: { _id: false, embeddingSchemaId: id, embeddingSchemaVersion: version },
  normalizationStrategy: { _id: false, normalizationStrategyId: id, normalizationStrategyVersion: version },
  vectorDimension: { type: Number, required: true, min: 1, max: 4_096 },
  vector,
  vectorDigest: digest,
  corpus: { type: String, enum: KNOWLEDGE_CORPORA, required: true },
  trustLevel: { type: String, enum: KNOWLEDGE_TRUST_LEVELS, required: true },
}, {
  strict: true,
  versionKey: false,
  timestamps: { createdAt: true, updatedAt: false },
});

knowledgeEmbeddingSchema.index({ embeddingId: 1, embeddingVersion: 1 }, { unique: true });
knowledgeEmbeddingSchema.index({
  "chunkIdentity.chunkId": 1,
  "chunkIdentity.chunkVersion": 1,
  "embeddingSchema.embeddingSchemaId": 1,
  "embeddingSchema.embeddingSchemaVersion": 1,
  "embeddingTextProjector.projectorId": 1,
  "embeddingTextProjector.projectorVersion": 1,
}, { unique: true });

knowledgeEmbeddingSchema.pre("validate", function () {
  const values = this.get("vector") as number[] | undefined;
  const dimension = this.get("vectorDimension") as number | undefined;
  if (values && dimension !== values.length) {
    this.invalidate("vectorDimension", "vectorDimension must equal vector length");
  }
});

export type KnowledgeEmbeddingPersistence = InferSchemaType<typeof knowledgeEmbeddingSchema>;
export type KnowledgeEmbeddingDocument = HydratedDocument<KnowledgeEmbeddingPersistence>;
export const KnowledgeEmbeddingModel = model<KnowledgeEmbeddingPersistence>(
  "KnowledgeEmbedding",
  knowledgeEmbeddingSchema,
);

