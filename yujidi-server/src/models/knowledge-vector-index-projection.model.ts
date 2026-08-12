import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { KNOWLEDGE_CHUNK_TYPES, KNOWLEDGE_EXAMPLE_CLASSIFICATIONS } from "../types/knowledge-chunk.types.js";
import { KNOWLEDGE_TRUST_LEVELS, PLATFORM_KNOWLEDGE_DOCUMENT_TYPES } from "../types/knowledge-document.types.js";

const id = { type: String, required: true, trim: true, maxlength: 160 } as const;
const version = { type: Number, required: true, min: 1 } as const;
const digest = { type: String, required: true, match: /^[a-f0-9]{64}$/ } as const;
const stringArray = { type: [String], required: true, default: undefined } as const;

export const knowledgeVectorIndexProjectionSchema = new Schema({
  indexEntryId: id,
  indexEntryVersion: version,
  indexId: id,
  indexVersion: version,
  namespace: { type: String, required: true, trim: true, maxlength: 200 },
  metadataSchema: { _id: false, metadataSchemaId: id, metadataSchemaVersion: version },
  embeddingIdentity: { _id: false, embeddingId: id, embeddingVersion: version },
  embeddingSchema: { _id: false, embeddingSchemaId: id, embeddingSchemaVersion: version },
  purpose: { type: String, enum: ["RETRIEVAL_DOCUMENT"], required: true },
  normalizationStrategy: { _id: false, normalizationStrategyId: id, normalizationStrategyVersion: version },
  vectorDimension: { type: Number, required: true, min: 1, max: 4_096 },
  similarityMetric: { type: String, enum: ["COSINE"], required: true },
  vectorDigest: digest,
  vector: { type: [Number], required: true, validate: (values: number[]) => values.length > 0 && values.length <= 4_096 && values.every(Number.isFinite) },
  documentIdentity: { _id: false, documentId: id, documentVersion: version },
  chunkSetIdentity: { _id: false, chunkSetId: id, chunkSetVersion: version },
  chunkIdentity: { _id: false, chunkId: id, chunkVersion: version },
  chunkDigest: digest,
  corpus: { type: String, enum: ["PLATFORM_KNOWLEDGE"], required: true },
  trustLevel: { type: String, enum: KNOWLEDGE_TRUST_LEVELS, required: true },
  searchableMetadata: {
    _id: false,
    documentType: { type: String, enum: PLATFORM_KNOWLEDGE_DOCUMENT_TYPES, required: true },
    chunkType: { type: String, enum: KNOWLEDGE_CHUNK_TYPES, required: true },
    factors: { type: [{ _id: false, factorKey: id, factorVersion: version }], required: true, default: undefined },
    relationshipTypes: stringArray,
    subjectTypes: stringArray,
    topics: stringArray,
    validationCodes: stringArray,
    exampleClassification: { type: String, enum: KNOWLEDGE_EXAMPLE_CLASSIFICATIONS },
    adr: { _id: false, number: Number, status: String },
    effectiveFrom: Date,
    effectiveUntil: Date,
  },
  projectionDigest: digest,
}, {
  strict: "throw",
  versionKey: false,
  timestamps: { createdAt: true, updatedAt: false },
});

knowledgeVectorIndexProjectionSchema.index({ indexEntryId: 1, indexEntryVersion: 1 }, { unique: true });
knowledgeVectorIndexProjectionSchema.index({ indexId: 1, indexVersion: 1, namespace: 1, "embeddingIdentity.embeddingId": 1, "embeddingIdentity.embeddingVersion": 1 }, { unique: true });
knowledgeVectorIndexProjectionSchema.pre("validate", function () {
  const vector = this.get("vector") as number[] | undefined;
  if (vector && vector.length !== this.get("vectorDimension")) this.invalidate("vectorDimension", "vectorDimension must equal vector length");
  const from = this.get("searchableMetadata.effectiveFrom") as Date | undefined;
  const until = this.get("searchableMetadata.effectiveUntil") as Date | undefined;
  if (from && until && from.getTime() >= until.getTime()) this.invalidate("searchableMetadata.effectiveUntil", "effective interval must be ordered");
});

export type KnowledgeVectorIndexProjectionPersistence = InferSchemaType<typeof knowledgeVectorIndexProjectionSchema>;
export type KnowledgeVectorIndexProjectionDocument = HydratedDocument<KnowledgeVectorIndexProjectionPersistence>;
export const KnowledgeVectorIndexProjectionModel = model<KnowledgeVectorIndexProjectionPersistence>("KnowledgeVectorIndexProjection", knowledgeVectorIndexProjectionSchema);
