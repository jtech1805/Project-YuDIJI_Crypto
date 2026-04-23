import Groq from "groq-sdk";
import pino from "pino";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";

const logger = pino({ name: "llm-service" });

// const llmResponseSchema = z.object({
//   aiRootCause: z.string().min(1),
//   sentiment: z.enum(["Panic", "Bearish", "Neutral", "Bullish"]),
// });

// export interface AlertReport {
//   aiRootCause: string;
//   sentiment: "Panic" | "Bearish" | "Neutral" | "Bullish";
// }
// 1. Define the NEW schema with our 5 playbook properties
export const llmResponseSchema = z.object({
  catalyst: z.string(),
  threatLevel: z.string(),
  support: z.string(),
  resistance: z.string(),
  summary: z.string(),
});

// 2. TypeScript automatically builds the AlertReport type from the schema above!
export type AlertReport = z.infer<typeof llmResponseSchema>;

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
}
