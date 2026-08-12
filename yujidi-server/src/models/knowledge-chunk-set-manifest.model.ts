import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const id = { type: String, required: true, trim: true, maxlength: 160 } as const;
const version = { type: Number, required: true, min: 1 } as const;
const digest = { type: String, required: true, minlength: 64, maxlength: 64 } as const;

const orderedChunkSchema = new Schema({
  ordinal: { type: Number, required: true, min: 0 },
  chunkId: id,
  chunkVersion: version,
  chunkDigest: digest,
}, { _id: false, strict: true });

export const knowledgeChunkSetManifestSchema = new Schema({
  chunkSetId: id,
  chunkSetVersion: version,
  documentIdentity: {
    _id: false,
    documentId: id,
    documentVersion: version,
  },
  strategy: {
    _id: false,
    strategyId: id,
    strategyVersion: version,
  },
  expectedChunkCount: { type: Number, required: true, min: 1, max: 1_000 },
  orderedChunks: { type: [orderedChunkSchema], required: true },
  chunkSetDigest: digest,
  publicationPolicy: {
    _id: false,
    policyId: id,
    policyVersion: version,
  },
}, {
  strict: true,
  versionKey: false,
  timestamps: { createdAt: true, updatedAt: false },
});

knowledgeChunkSetManifestSchema.index(
  { chunkSetId: 1, chunkSetVersion: 1 },
  { unique: true },
);
knowledgeChunkSetManifestSchema.index({
  "documentIdentity.documentId": 1,
  "documentIdentity.documentVersion": 1,
  "strategy.strategyId": 1,
  "strategy.strategyVersion": 1,
}, { unique: true });

export type KnowledgeChunkSetManifestPersistence = InferSchemaType<typeof knowledgeChunkSetManifestSchema>;
export type KnowledgeChunkSetManifestDocument = HydratedDocument<KnowledgeChunkSetManifestPersistence>;
export const KnowledgeChunkSetManifestModel = model<KnowledgeChunkSetManifestPersistence>(
  "KnowledgeChunkSetManifest",
  knowledgeChunkSetManifestSchema,
);

