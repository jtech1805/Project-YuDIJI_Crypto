import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

export interface IChatSession extends Document {
    user: mongoose.Types.ObjectId;
    symbol: string;
    messages: IChatMessage[];
    updatedAt: Date;
}

const ChatSessionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    symbol: { type: String, required: true, index: true },
    messages: [{
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

export const ChatSessionModel = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);