import Groq from "groq-sdk";
import pino from "pino";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";

const logger = pino({ name: "llm-service" });
export const llmResponseSchema = z.object({
  catalyst: z.string(),
  threatLevel: z.string(),
  support: z.string(),
  resistance: z.string(),
  summary: z.string(),
});

// 2. TypeScript automatically builds the AlertReport type from the schema above!
export type AlertReport = z.infer<typeof llmResponseSchema>;
// 2. NEW: The Copilot Schema
export const copilotResponseSchema = z.object({
  isApproved: z.boolean(),
  reply: z.string(),
});
export type CopilotResponse = z.infer<typeof copilotResponseSchema>;
export class LlmService {
  private readonly client: Groq;

  public constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new AppError("GROQ_API_KEY is not configured", 500);
    }

    this.client = new Groq({ apiKey });
  }

  public async generateAlertReport(
    symbol: string,
    dropPercent: number,
    timeWindow: number,
    newsContext: string,
    runningCVD: number,
    supportWall: string,    // <-- NEW PARAMETER
    resistanceWall: string
  ): Promise<AlertReport> {
    logger.info(
      {
        event: "GROQ_API_CALL",
        symbol,
        dropPercent,
        timeWindow,
        newsContextLength: newsContext.length,
        timestamp: new Date().toISOString(),
      },
      "Initiating Groq LLM inference",
    );

    let completion;
    try {
      //       completion = await this.client.chat.completions.create({
      //         model: "llama-3.3-70b-versatile",
      //         response_format: { type: "json_object" },
      //         messages: [
      //           {
      //             role: "system",
      //             content: `You are an elite Crypto Risk Analyst and Quantitative Trader. 
      // Return response in STRICT JSON format: { "aiRootCause": "string", "sentiment": "Panic" | "Bearish" | "Neutral" | "Bullish" }.
      // ANALYSIS RULES: 
      // 1. Use CVD (Cumulative Volume Delta) to determine momentum.
      // 2. Highly negative CVD during a price drop means aggressive whale selling (Bearish/Panic).
      // 3. Positive or flat CVD during a price drop means a low-liquidity sweep or buy-wall absorption (Neutral/Bullish).`
      //           },
      //           {
      //             role: "user",
      //             content: `MARKET EVENT: ${symbol} dropped ${dropPercent}% in the last ${timeWindow} minutes.
      // MOMENTUM DATA: The 60-second Cumulative Volume Delta (CVD) is ${runningCVD}.

      // LIVE NEWS CONTEXT: 
      // ${newsContext}

      // TASK: Synthesize the CVD momentum data and the news context to identify the probable root cause of this drop. Explain if the volume supports the price action, or if it is a structural anomaly. Provide a concise 3-sentence summary.`
      //           },
      //         ],
      //         // messages: [
      //         //   {
      //         //     role: "system",
      //         //     content:
      //         //       "You are an elite Crypto Risk Analyst. Return response in STRICT JSON format: { 'aiRootCause': 'string', 'sentiment': 'Panic' | 'Bearish' | 'Neutral' | 'Bullish' }.",
      //         //   },
      //         //   {
      //         //     role: "user",
      //         //     content: `EVENT: ${symbol} moved ${dropPercent}% in ${timeWindow} minutes. LIVE NEWS CONTEXT: \n${newsContext}\n\nTASK: Based ONLY on the provided news, identify the probable root cause. If the news does not explain it, state 'Unknown catalyst'. Provide a concise 3-sentence summary.`,
      //         //   },
      //         // ],
      //       });
      completion = await this.client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an elite Crypto Risk Analyst and Quantitative Trader. 
            Return response in STRICT JSON format exactly matching this schema:
            {
            "catalyst": "1 sentence explaining the primary driver of the drop",
            "threatLevel": "🔴 High Volatility | 🟡 Moderate Selloff | 🟢 Low-Liquidity Sweep | 🟢 Absorption / Buy Wall",
            "support": "The exact support data provided to you",
            "resistance": "The exact resistance data provided to you",
            "summary": "A 2-sentence actionable summary for a day trader"
            }
            ANALYSIS RULES: 
            1. Use CVD to determine momentum. Highly negative CVD means aggressive selling. Positive/flat CVD during a drop means absorption.
            2. Incorporate the news context if relevant.
            3. Factor in the distance to the heavy support/resistance walls.`
          },
          {
            role: "user",
            content: `MARKET EVENT: ${symbol} dropped ${dropPercent}% in the last ${timeWindow} minutes.
            MOMENTUM DATA: The 60-second CVD is ${runningCVD}.
            NEAREST HEAVY SUPPORT: ${supportWall}
            NEAREST HEAVY RESISTANCE: ${resistanceWall}

            LIVE NEWS CONTEXT: 
            ${newsContext}

            TASK: Synthesize this momentum, liquidity, and news data into the required JSON trading playbook.`
          },
        ],
      });
    } catch (error: unknown) {
      logger.error(
        { event: "GROQ_API_ERROR", error, symbol, dropPercent, timeWindow },
        "Groq API call failed",
      );
      throw new AppError("Groq API request failed", 502);
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger.error(
        { event: "GROQ_EMPTY_RESPONSE", symbol, dropPercent, timeWindow },
        "Groq API returned empty response content",
      );
      throw new AppError("Groq API returned empty response content", 502);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content) as unknown;
    } catch {
      logger.error(
        { event: "GROQ_MALFORMED_JSON", symbol, rawContent: content },
        "Groq response JSON parsing failed",
      );
      throw new AppError("Groq API returned malformed JSON", 502);
    }

    const parsedReport = llmResponseSchema.safeParse(parsedJson);
    if (!parsedReport.success) {
      logger.error(
        {
          event: "GROQ_SCHEMA_MISMATCH",
          symbol,
          issues: parsedReport.error.issues,
          rawParsed: parsedJson,
        },
        "Groq response did not match expected schema",
      );
      throw new AppError("Groq API response did not match required schema", 502);
    }

    logger.info(
      {
        event: "GROQ_RESPONSE_SUCCESS",
        symbol,
        // sentiment: parsedReport.data.sentiment,
        // aiRootCauseLength: parsedReport.data.aiRootCause.length,
        parsedReport,
        contentprovidedtogroq: content
      },
      "Groq inference completed successfully",
    );

    return parsedReport.data;
  }
  // ==========================================
  // METHOD 2: COPILOT CHAT (New)
  // ==========================================
  public async generateCopilotResponse(
    systemInstruction: string,
    chatHistory: { role: "user" | "assistant" | "system", content: string }[],
    userPrompt: string
  ): Promise<CopilotResponse> {

    logger.info({ event: "GROQ_COPILOT_CALL" }, "Initiating Groq inference for Copilot Chat");

    // 1. Compile the messages array
    const messages = [
      { role: "system" as const, content: systemInstruction },
      ...chatHistory,
      { role: "user" as const, content: userPrompt }
    ];
    logger.info({ event: "GROQ_Message", messages }, "Initiating Groq inference for Copilot Chat");
    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1, // Extremely low temperature for strict, logical rule adherence
        response_format: { type: "json_object" },
        messages: messages,
      });
    } catch (error: unknown) {
      logger.error({ event: "GROQ_COPILOT_ERROR", error }, "Groq API call failed");
      throw new AppError("Groq Copilot request failed", 502);
    }

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new AppError("Groq Copilot returned empty response", 502);
    }

    // 2. THE REGEX FALLBACK (Crucial for stability)
    let parsedJson: unknown;
    try {
      // Strategy 1: Attempt direct standard parse
      parsedJson = JSON.parse(rawContent);
    } catch (parseError) {
      // Strategy 2: Regex extraction for dirty JSON
      logger.warn({ event: "GROQ_DIRTY_JSON" }, "Groq returned dirty JSON. Running regex extractor...");
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          parsedJson = JSON.parse(jsonMatch[0]);
        } catch {
          throw new AppError("Failed to parse regex-extracted JSON", 502);
        }
      } else {
        throw new AppError("Copilot failed to format response as JSON", 502);
      }
    }

    // 3. ZOD VALIDATION
    const parsedReport = copilotResponseSchema.safeParse(parsedJson);
    console.log(parsedJson, 'groq LLM Response ')
    if (!parsedReport.success) {
      logger.error(
        { event: "GROQ_SCHEMA_MISMATCH", issues: parsedReport.error.issues, rawParsed: parsedJson },
        "Copilot response did not match expected schema"
      );
      throw new AppError("Copilot API response did not match required schema", 502);
    }

    logger.info({ event: "GROQ_COPILOT_SUCCESS" }, "Copilot inference completed safely");

    // 4. Return strictly typed data to the controller
    return parsedReport.data;
  }
}

// This creates the single "bucket" that the whole app will share
export const sharedLlmService = new LlmService();