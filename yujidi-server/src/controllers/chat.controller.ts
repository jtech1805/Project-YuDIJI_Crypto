import type { Request, Response } from "express";
import { copilotRequestSchema } from '../routes/chat.routes.js';
import { sharedWebsocketManager } from '../services/websocket.service.js'; // Your engine singleton
import { sharedLlmService } from '../services/llm.service.js';
import { z } from 'zod';
export const handleCopilotChat = async (req: Request, res: Response) => {
    try {
        // 1. Validate incoming React payload
        const validatedData = copilotRequestSchema.parse(req.body);
        const { symbol, direction, walletBalance, riskPercentage, leverage, userPrompt, chatHistory } = validatedData;

        // 2. Fetch O(1) Live Math from your Quantitative Engine
        // Because you built this with Maps and WebSockets, this takes 0 milliseconds.
        const { orderBookData, currentCvd } = sharedWebsocketManager.getSupportResistance(symbol);
        // const currentCvd = AnalyzerEngine.currentCVD.get(symbol) || 0;
        // Inside handleCopilotChat, after getting orderBookData and currentCvd...

        const { rawCurrentPrice, rawSupport, rawResistance } = orderBookData;

        let entry = rawCurrentPrice ?? 0;
        let stopLoss = 0;
        let takeProfit = 0;
        let riskRewardRatio = 0;
        let systemVetoReason: string | null = null;

        // 1. Check if the Order Book was too thin to find walls
        if (rawSupport === 0 || rawResistance === 0) {
            systemVetoReason = "The order book lacks sufficient structural walls (Support/Resistance) to calculate a safe trade.";
        } else {
            // 2. MATH FOR LONG TRADES
            if (direction === 'LONG') {
                stopLoss = (rawSupport ?? 0) * 0.999;     // Place SL 0.1% BELOW the buy wall
                takeProfit = (rawResistance ?? 0) * 0.999; // Place TP slightly below the sell wall to ensure it fills

                const risk = entry - stopLoss;
                const reward = takeProfit - entry;

                if (risk <= 0) {
                    systemVetoReason = "Support wall is higher than current price. Invalid Long setup.";
                } else {
                    riskRewardRatio = reward / risk;
                }
            }
            // 3. MATH FOR SHORT TRADES
            else if (direction === 'SHORT') {
                stopLoss = (rawResistance ?? 0) * 1.001;  // Place SL 0.1% ABOVE the sell wall
                takeProfit = (rawSupport ?? 0) * 1.001;    // Place TP slightly above the buy wall to ensure it fills

                const risk = stopLoss - entry;
                const reward = entry - takeProfit;

                if (risk <= 0) {
                    systemVetoReason = "Resistance wall is lower than current price. Invalid Short setup.";
                } else {
                    riskRewardRatio = reward / risk;
                }
            }
        }
        // 3. Construct the "God Prompt"
        //     const systemInstruction = `
        //   You are YuJiDi, an elite quantitative risk manager and trading copilot.

        //   ### DASHBOARD CONTEXT ###
        //   - Active Asset: ${symbol}
        //   - User Direction: ${direction}
        //   - User Capital: $${walletBalance}
        //   - Risk Tolerance: ${riskPercentage}% per trade
        //   - Leverage: ${leverage}x

        //   ### LIVE QUANTITATIVE DATA ###
        //   - Current Price: ${orderBookData.currentPrice}
        //   - Nearest Support (Whale Buy Wall): ${orderBookData.support}
        //   - Nearest Resistance (Whale Sell Wall): ${orderBookData.resistance}
        //   - 60-second CVD: ${currentCvd}

        //   ### YOUR DIRECTIVE ###
        //   1. Analyze the user's prompt using the live data.
        //   2. If they request a trade, suggest a strict Entry, Stop Loss, and Take Profit based ONLY on the Live Quantitative Data.
        //   3. CALCULATE RISK TO REWARD (R:R): (Take Profit - Entry) / (Entry - Stop Loss).
        //   4. THE VETO RULE: If the R:R is less than 1.5, or if the CVD momentum strongly contradicts the trade direction, you MUST VETO the trade. Return null for the numeric fields and explain why.

        //   You must return STRICT JSON format.
        // `;
        // 4. Construct the Spoon-Fed God Prompt
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
    - 60-second CVD Momentum: ${currentCvd}
    
    ### SYSTEM STATUS ###
    System Error/Veto: ${systemVetoReason ? systemVetoReason : "None. Math is valid."}

    ### YOUR DIRECTIVE ###
    1. Act as the Chief Risk Officer. Review the System's calculated trade plan.
    2. THE R:R RULE: If the Risk-to-Reward Ratio is less than 1.5, you MUST VETO the trade.
    3. THE CVD RULE: If the CVD momentum is violently moving against the trade direction (e.g. deeply negative CVD for a LONG), you MUST VETO the trade.
    4. THE SYSTEM RULE: If a "System Error/Veto" is present above, you MUST VETO the trade.
    5. If the trade is VETOED, set 'isApproved' to false and explain exactly why in the 'reply' field.
    6. If the trade is APPROVED, set 'isApproved' to true and give a brief encouraging summary in the 'reply' field.

    CRITICAL SCHEMA ENFORCEMENT:
    You must return a strict JSON object containing EXACTLY TWO keys: "isApproved" (boolean) and "reply" (string). 
    DO NOT return "Entry", "Stop Loss", "Take Profit", or "Risk To Reward" keys. The system already has these numbers.
  `;

        // 4. Execute LLM Call (Pass system prompt, history, and the new user prompt)
        const aiResponse = await sharedLlmService.generateCopilotResponse(systemInstruction, chatHistory, userPrompt);

        // 5. Send successful payload back to React
        // return res.status(200).json({
        //     success: true,
        //     data: aiResponse
        // });
        // Send successful payload back to React
        // Send successful payload back to React
        return res.status(200).json({
            success: true,
            data: {
                isApproved: aiResponse.isApproved,
                reply: aiResponse.reply,
                // Pass Node.js flawless math straight to the frontend!
                tradeMath: {
                    entry: entry,
                    stopLoss: stopLoss,
                    takeProfit: takeProfit,
                    riskRewardRatio: riskRewardRatio,
                    systemVetoReason: systemVetoReason
                }
            }
        });
    } catch (error) {
        console.error("Copilot Execution Error:", error);

        // ✅ TYPE GUARD: Prove to TypeScript this is a Zod Error
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Invalid payload from frontend.",

                // THE FIX: Use .flatten() to make the errors clean and UI-friendly
                // Or use error.issues if you really want the raw array
                details: error.flatten().fieldErrors
            });
        }

        // (Optional) Catch standard JavaScript Errors
        if (error instanceof Error) {
            console.error(error.message);
        }

        // Generic 500 Fallback for everything else
        return res.status(500).json({
            success: false,
            error: "The YuJiDi quantitative engine is currently analyzing heavy data. Please try again in a few seconds."
        });
    }
};