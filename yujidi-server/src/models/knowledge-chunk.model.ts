import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { KNOWLEDGE_CHUNK_TYPES, KNOWLEDGE_EXAMPLE_CLASSIFICATIONS } from "../types/knowledge-chunk.types.js";

const id = { type: String, required: true, trim: true, maxlength: 160 } as const;
const version = { type: Number, required: true, min: 1 } as const;
const identity = new Schema({ chunkId: id, chunkVersion: version }, { _id: false, strict: true });
const documentIdentity = new Schema({ documentId: id, documentVersion: version }, { _id: false, strict: true });
const span = new Schema({ pageStart: Number, pageEnd: Number, sectionPath: [String], paragraphStart: Number, paragraphEnd: Number, characterStart: Number, characterEnd: Number, tableId: String, rowIds: [String], timestampStartMs: Number, timestampEndMs: Number }, { _id: false, strict: true });
const factor = new Schema({ factorKey: id, factorVersion: version }, { _id: false, strict: true });
export const knowledgeChunkSchema = new Schema({
  chunkId: id, chunkVersion: version, documentIdentity: { type: documentIdentity, required: true }, strategy: { _id: false, strategyId: id, strategyVersion: version }, chunkType: { type: String, enum: KNOWLEDGE_CHUNK_TYPES, required: true }, ordinal: { type: Number, required: true, min: 0 }, content: { type: String, required: true, maxlength: 30_000 }, sourceSpan: { type: span, required: true }, parent: { type: identity },
  metadata: { _id: false, factors: [factor], relationshipTypes: [String], subjectTypes: [String], markets: [String], topics: [String], exampleClassification: { type: String, enum: KNOWLEDGE_EXAMPLE_CLASSIFICATIONS }, validationCodes: [String], adr: { _id: false, number: Number, status: String } }, contentDigest: { type: String, required: true, minlength: 64, maxlength: 64 },
}, { strict: true, versionKey: false, timestamps: { createdAt: true, updatedAt: false } });
knowledgeChunkSchema.index({ chunkId: 1, chunkVersion: 1 }, { unique: true });
knowledgeChunkSchema.index({ "documentIdentity.documentId": 1, "documentIdentity.documentVersion": 1, "strategy.strategyId": 1, "strategy.strategyVersion": 1, ordinal: 1 }, { unique: true });
export type KnowledgeChunkPersistence = InferSchemaType<typeof knowledgeChunkSchema>;
export type KnowledgeChunkDocument = HydratedDocument<KnowledgeChunkPersistence>;
export const KnowledgeChunkModel = model<KnowledgeChunkPersistence>("KnowledgeChunk", knowledgeChunkSchema);
