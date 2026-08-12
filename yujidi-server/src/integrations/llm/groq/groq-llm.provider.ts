import Groq from "groq-sdk";
import pino from "pino";

import { AppError } from "../../../errors/AppError.js";
import {
  alertReportOutputSchema,
  copilotOutputSchema,
  type AlertReportInput,
  type AlertReportOutput,
  type CopilotInput,
  type CopilotOutput,
  type LLMProvider,
  type PostTradeReviewInput,
} from "../../../ports/llm-provider.port.js";

const logger = pino({ name: "groq-llm-provider" });

export class GroqLLMProvider implements LLMProvider {
  public readonly name = "groq";
  public readonly modelName: string;

  private readonly client: Groq;

  public constructor(apiKey: string, model = "llama-3.3-70b-versatile") {
    if (!apiKey) {
      throw new AppError("GROQ_API_KEY is not configured", 500);
    }

    this.client = new Groq({ apiKey });
    this.modelName = model;
  }

  public async generateAlertReport(input: AlertReportInput): Promise<AlertReportOutput> {
    const movementVerb = input.triggerType === "spike" ? "spiked" : "dropped";
    const movementContext =
      input.direction === "up"
        ? "upward spike / breakout pressure"
        : "downward drop / selloff pressure";
    const timeWindowMinutes = input.timeWindowMinutes ?? 0;
    const newsContext = input.newsContext ?? "No recent news available.";
    const cvdAtTrigger = input.cvdAtTrigger ?? 0;
    const support = input.support ?? "Unknown";
    const resistance = input.resistance ?? "Unknown";

    logger.info(
      {
        event: "GROQ_API_CALL",
        symbol: input.symbol,
        changePercentage: input.changePercentage,
        triggerPrice: input.triggerPrice,
        triggerType: input.triggerType,
        direction: input.direction,
        timeWindowMinutes,
        newsContextLength: newsContext.length,
        model: this.modelName,
        timestamp: new Date().toISOString(),
      },
      "Initiating Groq LLM inference",
    );

    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.modelName,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an elite Crypto Risk Analyst and Quantitative Trader. 
            Return response in STRICT JSON format exactly matching this schema:
            {
            "catalyst": "1 sentence explaining the primary driver of the movement",
            "threatLevel": "🔴 High Volatility | 🟡 Moderate Move | 🟢 Low-Liquidity Sweep | 🟢 Absorption / Liquidity Wall",
            "support": "The exact support data provided to you",
            "resistance": "The exact resistance data provided to you",
            "summary": "A 2-sentence actionable summary for a day trader"
            }
            ANALYSIS RULES: 
            1. Use CVD to determine momentum. Highly negative CVD means aggressive selling pressure. Highly positive CVD means aggressive buying pressure.
            2. Compare CVD against the event direction: ${movementContext}.
            2. Incorporate the news context if relevant.
            3. Factor in the distance to the heavy support/resistance walls.`
          },
          {
            role: "user",
            content: `MARKET EVENT: ${input.symbol} ${movementVerb} ${Math.abs(input.changePercentage)}% in the last ${timeWindowMinutes} minutes.
            RAW SIGNED CHANGE: ${input.changePercentage}%.
            TRIGGER PRICE: ${input.triggerPrice}.
            TRIGGER TYPE: ${input.triggerType}.
            DIRECTION: ${input.direction}.
            MOMENTUM DATA: The 60-second CVD is ${cvdAtTrigger}.
            NEAREST HEAVY SUPPORT: ${support}
            NEAREST HEAVY RESISTANCE: ${resistance}

            LIVE NEWS CONTEXT: 
            ${newsContext}

            TASK: Synthesize this momentum, liquidity, and news data into the required JSON trading playbook.`
          },
        ],
      });
    } catch (error: unknown) {
      logger.error(
        {
          event: "GROQ_API_ERROR",
          error,
          symbol: input.symbol,
          changePercentage: input.changePercentage,
          triggerType: input.triggerType,
          direction: input.direction,
          timeWindowMinutes,
        },
        "Groq API call failed",
      );
      throw new AppError("Groq API request failed", 502);
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger.error(
        {
          event: "GROQ_EMPTY_RESPONSE",
          symbol: input.symbol,
          changePercentage: input.changePercentage,
          triggerType: input.triggerType,
          direction: input.direction,
          timeWindowMinutes,
        },
        "Groq API returned empty response content",
      );
      throw new AppError("Groq API returned empty response content", 502);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content) as unknown;
    } catch {
      logger.error(
        { event: "GROQ_MALFORMED_JSON", symbol: input.symbol, rawContent: content },
        "Groq response JSON parsing failed",
      );
      throw new AppError("Groq API returned malformed JSON", 502);
    }

    const parsedReport = alertReportOutputSchema.safeParse(parsedJson);
    if (!parsedReport.success) {
      logger.error(
        {
          event: "GROQ_SCHEMA_MISMATCH",
          symbol: input.symbol,
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
        symbol: input.symbol,
        reportFieldLengths: {
          catalyst: parsedReport.data.catalyst.length,
          threatLevel: parsedReport.data.threatLevel.length,
          support: parsedReport.data.support.length,
          resistance: parsedReport.data.resistance.length,
          summary: parsedReport.data.summary.length,
        },
      },
      "Groq inference completed successfully",
    );

    return parsedReport.data;
  }

  public async generateCopilotResponse(input: CopilotInput): Promise<CopilotOutput> {
    logger.info(
      {
        event: "GROQ_COPILOT_CALL",
        symbol: input.symbol,
        historyCount: input.chatHistory.length,
        model: this.modelName,
      },
      "Initiating Groq inference for Copilot Chat",
    );

    const messages = [
      { role: "system" as const, content: input.systemInstruction },
      ...input.chatHistory,
      { role: "user" as const, content: input.userPrompt },
    ];

    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.modelName,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages,
      });
    } catch (error: unknown) {
      logger.error({ event: "GROQ_COPILOT_ERROR", error }, "Groq API call failed");
      throw new AppError("Groq Copilot request failed", 502);
    }

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new AppError("Groq Copilot returned empty response", 502);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      logger.warn({ event: "GROQ_DIRTY_JSON" }, "Groq returned dirty JSON. Running regex extractor...");
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new AppError("Copilot failed to format response as JSON", 502);
      }

      try {
        parsedJson = JSON.parse(jsonMatch[0]);
      } catch {
        throw new AppError("Failed to parse regex-extracted JSON", 502);
      }
    }

    const parsedReport = copilotOutputSchema.safeParse(parsedJson);
    if (!parsedReport.success) {
      logger.error(
        { event: "GROQ_SCHEMA_MISMATCH", issues: parsedReport.error.issues, rawParsed: parsedJson },
        "Copilot response did not match expected schema",
      );
      throw new AppError("Copilot API response did not match required schema", 502);
    }

    logger.info({ event: "GROQ_COPILOT_SUCCESS" }, "Copilot inference completed safely");

    return parsedReport.data;
  }

  public async generatePostTradeReview(input: PostTradeReviewInput): Promise<unknown> {
    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.modelName,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are YuJiDi's post-trade review assistant.
You explain process quality from finalized backend facts only.
You do not recommend buying or selling, place orders, calculate or revise P&L, change risk state, score trades, or grant trade permission.
Return strict JSON matching exactly:
{
  "summary": "string",
  "processQuality": "GOOD_PROCESS | MIXED_PROCESS | BAD_PROCESS",
  "strengths": ["string"],
  "keyMistakes": ["string"],
  "riskNotes": ["string"],
  "improvementSuggestions": ["string"],
  "nextTradeFocus": "string",
  "confidence": "LOW | MEDIUM | HIGH"
}`,
          },
          {
            role: "user",
            content: `Prompt version: ${input.promptVersion}
Schema version: ${input.schemaVersion}
Review this finalized trade journal context without changing or recalculating any fact:
${JSON.stringify(input.context)}`,
          },
        ],
      });
    } catch (error: unknown) {
      logger.error(
        { event: "GROQ_POST_TRADE_REVIEW_ERROR", error },
        "Groq post-trade review request failed",
      );
      throw new AppError("Groq post-trade review request failed", 502);
    }

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) throw new AppError("Groq post-trade review returned empty response", 502);

    try {
      return JSON.parse(rawContent) as unknown;
    } catch {
      throw new AppError("Groq post-trade review returned malformed JSON", 502);
    }
  }
}
