// import type { Request, Response } from "express";
// import { copilotRequestSchema } from '../routes/chat.routes.js';
// import { sharedWebsocketManager } from '../services/websocket.service.js'; // Your engine singleton
// import { sharedLlmService } from '../services/llm.service.js';
// import { z } from 'zod';
// export const handleCopilotChat = async (req: Request, res: Response) => {
//     try {
//         // 1. Validate incoming React payload
//         const validatedData = copilotRequestSchema.parse(req.body);
//         const { symbol, direction, walletBalance, riskPercentage, leverage, userPrompt, chatHistory } = validatedData;

//         // 2. Fetch O(1) Live Math from your Quantitative Engine
//         // Because you built this with Maps and WebSockets, this takes 0 milliseconds.
//         const { orderBookData, currentCvd } = sharedWebsocketManager.getSupportResistance(symbol);
//         // const currentCvd = AnalyzerEngine.currentCVD.get(symbol) || 0;
//         // Inside handleCopilotChat, after getting orderBookData and currentCvd...

//         const { rawCurrentPrice, rawSupport, rawResistance } = orderBookData;

//         let entry = rawCurrentPrice ?? 0;
//         let stopLoss = 0;
//         let takeProfit = 0;
//         let riskRewardRatio = 0;
//         let systemVetoReason: string | null = null;

//         // 1. Check if the Order Book was too thin to find walls
//         if (rawSupport === 0 || rawResistance === 0) {
//             systemVetoReason = "The order book lacks sufficient structural walls (Support/Resistance) to calculate a safe trade.";
//         } else {
//             // 2. MATH FOR LONG TRADES
//             if (direction === 'LONG') {
//                 stopLoss = (rawSupport ?? 0) * 0.999;     // Place SL 0.1% BELOW the buy wall
//                 takeProfit = (rawResistance ?? 0) * 0.999; // Place TP slightly below the sell wall to ensure it fills

//                 const risk = entry - stopLoss;
//                 const reward = takeProfit - entry;

//                 if (risk <= 0) {
//                     systemVetoReason = "Support wall is higher than current price. Invalid Long setup.";
//                 } else {
//                     riskRewardRatio = reward / risk;
//                 }
//             }
//             // 3. MATH FOR SHORT TRADES
//             else if (direction === 'SHORT') {
//                 stopLoss = (rawResistance ?? 0) * 1.001;  // Place SL 0.1% ABOVE the sell wall
//                 takeProfit = (rawSupport ?? 0) * 1.001;    // Place TP slightly above the buy wall to ensure it fills

//                 const risk = stopLoss - entry;
//                 const reward = entry - takeProfit;

//                 if (risk <= 0) {
//                     systemVetoReason = "Resistance wall is lower than current price. Invalid Short setup.";
//                 } else {
//                     riskRewardRatio = reward / risk;
//                 }
//             }
//         }
//         // 3. Construct the "God Prompt"
//         //     const systemInstruction = `
//         //   You are YuJiDi, an elite quantitative risk manager and trading copilot.

//         //   ### DASHBOARD CONTEXT ###
//         //   - Active Asset: ${symbol}
//         //   - User Direction: ${direction}
//         //   - User Capital: $${walletBalance}
//         //   - Risk Tolerance: ${riskPercentage}% per trade
//         //   - Leverage: ${leverage}x

//         //   ### LIVE QUANTITATIVE DATA ###
//         //   - Current Price: ${orderBookData.currentPrice}
//         //   - Nearest Support (Whale Buy Wall): ${orderBookData.support}
//         //   - Nearest Resistance (Whale Sell Wall): ${orderBookData.resistance}
//         //   - 60-second CVD: ${currentCvd}

//         //   ### YOUR DIRECTIVE ###
//         //   1. Analyze the user's prompt using the live data.
//         //   2. If they request a trade, suggest a strict Entry, Stop Loss, and Take Profit based ONLY on the Live Quantitative Data.
//         //   3. CALCULATE RISK TO REWARD (R:R): (Take Profit - Entry) / (Entry - Stop Loss).
//         //   4. THE VETO RULE: If the R:R is less than 1.5, or if the CVD momentum strongly contradicts the trade direction, you MUST VETO the trade. Return null for the numeric fields and explain why.

//         //   You must return STRICT JSON format.
//         // `;
//         // 4. Construct the Spoon-Fed God Prompt
//         const systemInstruction = `
//     You are YuJiDi, an elite quantitative risk manager and trading copilot.

//     ### USER CONTEXT ###
//     - Asset: ${symbol} (${direction})
//     - User Prompt: "${userPrompt}"

//     ### DETERMINISTIC TRADE PLAN (PRE-CALCULATED BY NODE.JS) ###
//     - Entry: $${entry.toFixed(4)}
//     - Stop Loss: $${stopLoss.toFixed(4)}
//     - Take Profit: $${takeProfit.toFixed(4)}
//     - Risk-to-Reward Ratio (R:R): ${riskRewardRatio.toFixed(2)}
//     - 60-second CVD Momentum: ${currentCvd}

//     ### SYSTEM STATUS ###
//     System Error/Veto: ${systemVetoReason ? systemVetoReason : "None. Math is valid."}

//     ### YOUR DIRECTIVE ###
//     1. Act as the Chief Risk Officer. Review the System's calculated trade plan.
//     2. THE R:R RULE: If the Risk-to-Reward Ratio is less than 1.5, you MUST VETO the trade.
//     3. THE CVD RULE: If the CVD momentum is violently moving against the trade direction (e.g. deeply negative CVD for a LONG), you MUST VETO the trade.
//     4. THE SYSTEM RULE: If a "System Error/Veto" is present above, you MUST VETO the trade.
//     5. If the trade is VETOED, set 'isApproved' to false and explain exactly why in the 'reply' field.
//     6. If the trade is APPROVED, set 'isApproved' to true and give a brief encouraging summary in the 'reply' field.

//     CRITICAL SCHEMA ENFORCEMENT:
//     You must return a strict JSON object containing EXACTLY TWO keys: "isApproved" (boolean) and "reply" (string). 
//     DO NOT return "Entry", "Stop Loss", "Take Profit", or "Risk To Reward" keys. The system already has these numbers.
//   `;

//         // 4. Execute LLM Call (Pass system prompt, history, and the new user prompt)
//         const aiResponse = await sharedLlmService.generateCopilotResponse(systemInstruction, chatHistory, userPrompt);

//         // 5. Send successful payload back to React
//         // return res.status(200).json({
//         //     success: true,
//         //     data: aiResponse
//         // });
//         // Send successful payload back to React
//         // Send successful payload back to React
//         return res.status(200).json({
//             success: true,
//             data: {
//                 isApproved: aiResponse.isApproved,
//                 reply: aiResponse.reply,
//                 // Pass Node.js flawless math straight to the frontend!
//                 tradeMath: {
//                     entry: entry,
//                     stopLoss: stopLoss,
//                     takeProfit: takeProfit,
//                     riskRewardRatio: riskRewardRatio,
//                     systemVetoReason: systemVetoReason
//                 }
//             }
//         });
//     } catch (error) {
//         console.error("Copilot Execution Error:", error);

//         // ✅ TYPE GUARD: Prove to TypeScript this is a Zod Error
//         if (error instanceof z.ZodError) {
//             return res.status(400).json({
//                 success: false,
//                 error: "Invalid payload from frontend.",

//                 // THE FIX: Use .flatten() to make the errors clean and UI-friendly
//                 // Or use error.issues if you really want the raw array
//                 details: error.flatten().fieldErrors
//             });
//         }

//         // (Optional) Catch standard JavaScript Errors
//         if (error instanceof Error) {
//             console.error(error.message);
//         }

//         // Generic 500 Fallback for everything else
//         return res.status(500).json({
//             success: false,
//             error: "The YuJiDi quantitative engine is currently analyzing heavy data. Please try again in a few seconds."
//         });
//     }
// };
import type { Request, Response } from "express";
import { copilotRequestSchema } from '../routes/chat.routes.js';
import { sharedWebsocketManager } from '../services/websocket.service.js';
import { sharedLlmService } from '../services/llm.service.js';
import { z } from 'zod';
import { ChatSessionModel } from "../models/chatSession.js";

export const handleCopilotChat = async (req: Request, res: Response) => {
    try {
        // 1. Validate incoming React payload
        const validatedData = copilotRequestSchema.parse(req.body);
        const { symbol, direction, walletBalance, riskPercentage, leverage, userPrompt, chatHistory } = validatedData;
        const userId = req.user?.id || "";
        // 2. Fetch O(1) Live Math
        const { orderBookData, currentCvd } = sharedWebsocketManager.getSupportResistance(symbol);
        const { rawCurrentPrice, rawSupport, rawResistance } = orderBookData;

        let entry = rawCurrentPrice ?? 0;
        let stopLoss = 0;
        let takeProfit = 0;
        let riskRewardRatio = 0;
        let systemVetoReason: string | null = null;

        // NEW: Position Sizing Variables
        let positionSize = 0;
        let requiredMargin = 0;

        if (rawSupport === 0 || rawResistance === 0) {
            systemVetoReason = `Live order book data for ${symbol} is currently syncing with the exchange. Please wait a few seconds and try again.`;
        } else {
            if (direction === 'LONG') {
                stopLoss = (rawSupport ?? 0) * 0.999;
                takeProfit = (rawResistance ?? 0) * 0.999;

                const riskPerUnit = entry - stopLoss;
                const rewardPerUnit = takeProfit - entry;

                if (riskPerUnit <= 0) {
                    systemVetoReason = "Support wall is higher than current price. Invalid Long setup.";
                } else {
                    riskRewardRatio = rewardPerUnit / riskPerUnit;
                }
            }
            else if (direction === 'SHORT') {
                stopLoss = (rawResistance ?? 0) * 1.001;
                takeProfit = (rawSupport ?? 0) * 1.001;

                const riskPerUnit = stopLoss - entry;
                const rewardPerUnit = entry - takeProfit;

                if (riskPerUnit <= 0) {
                    systemVetoReason = "Resistance wall is lower than current price. Invalid Short setup.";
                } else {
                    riskRewardRatio = rewardPerUnit / riskPerUnit;
                }
            }

            // === NEW: POSITION SIZING & RISK MATH ===
            // Calculate exact dollar amount user is willing to risk
            const riskDollarAmount = walletBalance * (riskPercentage / 100);
            const absolutePriceDifference = Math.abs(entry - stopLoss);

            if (absolutePriceDifference > 0) {
                // How many units of the asset can we buy to strictly adhere to the risk amount?
                positionSize = riskDollarAmount / absolutePriceDifference;

                // Calculate Margin using Leverage
                const notionalValue = positionSize * entry;
                requiredMargin = notionalValue / leverage;

                // Veto if the trade requires more cash than they actually have in the wallet
                if (requiredMargin > walletBalance) {
                    systemVetoReason = `Required margin ($${requiredMargin.toFixed(2)}) exceeds available wallet balance ($${walletBalance}). Decrease position size or increase leverage.`;
                }
            }
        }

        // === NEW: INTENT-AWARE LLM PROMPT ===
        const systemInstruction = `
    You are YuJiDi, an elite quantitative risk manager and trading copilot.

    ### USER CONTEXT ###
    - Asset: ${symbol} (${direction})
    - User Prompt: "${userPrompt}"

    ### DETERMINISTIC TRADE PLAN (PRE-CALCULATED BY NODE.JS) ###
    - Entry: $${entry.toFixed(4)}
    - Stop Loss: $${stopLoss.toFixed(4)}
    - Take Profit: $${takeProfit.toFixed(4)}
    - Risk-to-Reward Ratio (R:R): ${riskRewardRatio.toFixed(2)}
    - Required Margin: $${requiredMargin.toFixed(2)}
    - Position Size: ${positionSize.toFixed(4)} ${symbol.replace('USDT', '')}
    - 60-second CVD Momentum: ${currentCvd}
    - System Error/Veto: ${systemVetoReason ? systemVetoReason : "None. Math is valid."}

    ### YOUR DIRECTIVE ###
    1. INTENT ROUTING: First, determine if the user is asking to plan/analyze a trade, OR if they are asking a general/educational question (e.g., "What is Bitcoin?", "Hello").
    
    2. IF INTENT IS "GENERAL":
       - Set "intent" to "GENERAL".
       - Set "isApproved" to false.
       - Answer their question normally and conversationally in the "reply" field. Ignore the trade math entirely.

    3. IF INTENT IS "TRADE":
       - Set "intent" to "TRADE".
       - Act as the Chief Risk Officer. Review the System's calculated trade plan.
       - VETO the trade if R:R is less than 1.5, if CVD momentum strongly opposes the direction, or if a "System Error/Veto" exists.
       - If VETOED, set 'isApproved' to false and explain why in 'reply', referencing the specific math or CVD data.
       - If APPROVED, set 'isApproved' to true and give a brief summary of the required margin and position size in 'reply'.

    CRITICAL SCHEMA ENFORCEMENT:
    Return a strict JSON object with EXACTLY THREE keys: "intent" (string: "TRADE" or "GENERAL"), "isApproved" (boolean), and "reply" (string).
  `;

        // Execute LLM Call
        // const aiResponse = await sharedLlmService.generateCopilotResponse(systemInstruction, chatHistory, userPrompt);
        // ==========================================
        // 🚀 THE SLIDING WINDOW MEMORY PIPELINE
        // ==========================================

        // A. Find existing session or create a new one for this specific Asset
        let chatSession = await ChatSessionModel.findOne({ user: userId, symbol: symbol });
        if (!chatSession) {
            chatSession = new ChatSessionModel({ user: userId, symbol: symbol, messages: [] });
        }

        // B. Extract the Sliding Window (Grab only the last 6 messages to save Groq tokens)
        // Map them to the format your sharedLlmService expects
        const recentHistory = chatSession.messages.slice(-6).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // C. Execute LLM Call (Passing the DB history instead of frontend history)
        const aiResponse = await sharedLlmService.generateCopilotResponse(systemInstruction, recentHistory, userPrompt);

        // D. Save the new interaction to MongoDB permanently
        chatSession.messages.push({ role: 'user', content: userPrompt, timestamp: new Date() });
        chatSession.messages.push({ role: 'assistant', content: aiResponse.reply, timestamp: new Date() });
        await chatSession.save();

        // === NEW: CONDITIONAL FRONTEND RESPONSE ===
        return res.status(200).json({
            success: true,
            data: {
                intent: aiResponse.intent,
                isApproved: aiResponse.isApproved,
                reply: aiResponse.reply,
                // Only send the trade math payload if the user actually wanted to trade
                tradeMath: aiResponse.intent === "TRADE" ? {
                    entry: entry,
                    stopLoss: stopLoss,
                    takeProfit: takeProfit,
                    riskRewardRatio: riskRewardRatio,
                    positionSize: positionSize,
                    requiredMargin: requiredMargin,
                    systemVetoReason: systemVetoReason
                } : null
            }
        });
    } catch (error) {
        console.error("Copilot Execution Error:", error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Invalid payload from frontend.",
                details: error.flatten().fieldErrors
            });
        }

        return res.status(500).json({
            success: false,
            error: "The YuJiDi quantitative engine is currently analyzing heavy data. Please try again in a few seconds."
        });
    }
};
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id || "";
        const { symbol } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        // Find the chat session for this user and this specific coin
        const chatSession = symbol && typeof symbol === 'string'
            ? await ChatSessionModel.findOne({ user: userId, symbol: symbol })
            : null;

        // If no history exists, return the default welcome message so the UI isn't empty
        if (!chatSession || chatSession.messages.length === 0) {
            return res.status(200).json({
                success: true,
                data: [
                    { role: "user", content: "Hello YuJiDi, I am looking for a setup." },
                    { role: "assistant", content: "I am ready to assist. Please provide the asset and your intent." }
                ]
            });
        }

        // Map the MongoDB documents into the clean format the React frontend expects
        const formattedHistory = chatSession.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        return res.status(200).json({
            success: true,
            data: formattedHistory
        });

    } catch (error) {
        console.error("Error fetching chat history:", error);
        return res.status(500).json({ success: false, error: "Failed to load chat history." });
    }
};