import Groq from "groq-sdk";
import pino from "pino";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";

const logger = pino({ name: "llm-service" });

const llmResponseSchema = z.object({
  aiRootCause: z.string().min(1),
  sentiment: z.enum(["Panic", "Bearish", "Neutral", "Bullish"]),
});

export interface AlertReport {
  aiRootCause: string;
  sentiment: "Panic" | "Bearish" | "Neutral" | "Bullish";
}

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
      completion = await this.client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an elite Crypto Risk Analyst. Return response in STRICT JSON format: { 'aiRootCause': 'string', 'sentiment': 'Panic' | 'Bearish' | 'Neutral' | 'Bullish' }.",
          },
          {
            role: "user",
            content: `EVENT: ${symbol} moved ${dropPercent}% in ${timeWindow} minutes. LIVE NEWS CONTEXT: \n${newsContext}\n\nTASK: Based ONLY on the provided news, identify the probable root cause. If the news does not explain it, state 'Unknown catalyst'. Provide a concise 3-sentence summary.`,
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
        sentiment: parsedReport.data.sentiment,
        aiRootCauseLength: parsedReport.data.aiRootCause.length,
        parsedReport
      },
      "Groq inference completed successfully",
    );

    return parsedReport.data;
  }
}
