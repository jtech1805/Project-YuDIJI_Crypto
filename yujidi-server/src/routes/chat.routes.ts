import express from 'express';
import { handleCopilotChat } from '../controllers/chat.controller.js';
// import { handleTradeExecution } from './trade.controller';
// import { requireAuth } from './middleware/auth'; 
import { z } from 'zod';

export const copilotRequestSchema = z.object({
    symbol: z.string().min(3),                 // e.g., "BTCUSDT"
    direction: z.enum(['LONG', 'SHORT']),
    walletBalance: z.number().positive(),      // e.g., 10000
    riskPercentage: z.number().positive(),     // e.g., 2
    leverage: z.number().positive(),           // e.g., 5
    userPrompt: z.string().min(1),             // e.g., "Help me plan a trade"
    chatHistory: z.array(
        z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string()
        })
    ).max(10) // Limit history to prevent token bloat
});

const chatRouter = express.Router();

// Route 1: The Copilot Chat (Calculates and Approves)
chatRouter.post('/', handleCopilotChat);

// Route 2: The Execution (Fires to Binance and saves to DB)
// chatRouter.post('/api/trade/execute', handleTradeExecution); // Add requireAuth middleware in production!

export default chatRouter;