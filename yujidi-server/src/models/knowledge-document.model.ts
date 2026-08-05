import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { KNOWLEDGE_CORPORA, KNOWLEDGE_OWNER_TYPES, KNOWLEDGE_TRUST_LEVELS, NORMALIZED_KNOWLEDGE_BLOCK_TYPES, PLATFORM_KNOWLEDGE_DOCUMENT_TYPES } from "../types/knowledge-document.types.js";

const id = { type: String, required: true, trim: true, maxlength: 160 } as const;
const version = { type: Number, required: true, min: 1 } as const;
const identity = new Schema({ documentId: id, documentVersion: version }, { _id: false, strict: true });
const span = new Schema({ pageStart: Number, pageEnd: Number, sectionPath: [String], paragraphStart: Number, paragraphEnd: Number, characterStart: Number, characterEnd: Number, tableId: String, rowIds: [String], timestampStartMs: Number, timestampEndMs: Number }, { _id: false, strict: true });
const authority = new Schema({ authorityType: id, authorityId: id, authorityVersion: Number }, { _id: false, strict: true });
const tableRow = new Schema({ rowId: id, cells: [String] }, { _id: false, strict: true });
const block = new Schema({ blockId: id, ordinal: { type: Number, required: true, min: 0 }, blockType: { type: String, enum: NORMALIZED_KNOWLEDGE_BLOCK_TYPES, required: true }, text: String, table: { _id: false, headers: [String], rows: [tableRow] }, sectionPath: [String], sourceSpan: { type: span, required: true }, semanticLabels: [String], authorityReferences: [authority] }, { _id: false, strict: true });

export const knowledgeDocumentSchema = new Schema({
  documentId: id, documentVersion: version, corpus: { type: String, enum: KNOWLEDGE_CORPORA, required: true }, documentType: { type: String, enum: PLATFORM_KNOWLEDGE_DOCUMENT_TYPES, required: true }, title: { type: String, required: true, trim: true, maxlength: 240 },
  ownership: { _id: false, ownerType: { type: String, enum: KNOWLEDGE_OWNER_TYPES, required: true }, ownerId: String },
  source: { _id: false, sourceType: id, sourceIdentity: id, sourceUri: String }, trustLevel: { type: String, enum: KNOWLEDGE_TRUST_LEVELS, required: true }, effectiveFrom: Date, effectiveUntil: Date,
  parser: { _id: false, parserId: id, parserVersion: version }, admissionPolicy: { _id: false, policyId: id, policyVersion: version }, supersedes: { type: identity }, blocks: { type: [block], required: true }, contentDigest: { type: String, required: true, minlength: 64, maxlength: 64 },
}, { strict: true, versionKey: false, timestamps: { createdAt: true, updatedAt: false } });
knowledgeDocumentSchema.index({ documentId: 1, documentVersion: 1 }, { unique: true });
export type KnowledgeDocumentPersistence = InferSchemaType<typeof knowledgeDocumentSchema>;
export type KnowledgeDocumentDocument = HydratedDocument<KnowledgeDocumentPersistence>;
export const KnowledgeDocumentModel = model<KnowledgeDocumentPersistence>("KnowledgeDocument", knowledgeDocumentSchema);

