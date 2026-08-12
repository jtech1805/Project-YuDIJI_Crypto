import pino from "pino";

import { createLLMProvider } from "../../integrations/llm/llm-provider.factory.js";
import {
  alertReportOutputSchema,
  copilotOutputSchema,
  type AlertReportOutput,
  type CopilotOutput,
  type LLMProvider,
  type PostTradeReviewInput,
} from "../../ports/llm-provider.port.js";

const logger = pino({ name: "llm-service" });

export const llmResponseSchema = alertReportOutputSchema;
export type AlertReport = AlertReportOutput;

export const copilotResponseSchema = copilotOutputSchema;
export type CopilotResponse = CopilotOutput;

export class LlmService {
  private readonly provider: LLMProvider;

  public constructor(provider: LLMProvider = createLLMProvider()) {
    this.provider = provider;
    logger.info(
      {
        event: "LLM_PROVIDER_SELECTED",
        provider: this.provider.name,
      },
      "LLM provider selected",
    );
  }

  public async generateAlertReport(
    symbol: string,
    changePercent: number,
    timeWindow: number,
    newsContext: string,
    runningCVD: number,
    supportWall: string,
    resistanceWall: string,
    triggerType: "drop" | "spike",
    direction: "up" | "down",
    triggerPrice = 0,
  ): Promise<AlertReport> {
    return this.provider.generateAlertReport({
      symbol,
      triggerType,
      direction,
      changePercentage: changePercent,
      triggerPrice,
      timeWindowMinutes: timeWindow,
      cvdAtTrigger: runningCVD,
      support: supportWall,
      resistance: resistanceWall,
      newsContext,
    });
  }

  public async generateCopilotResponse(
    systemInstruction: string,
    chatHistory: { role: "user" | "assistant" | "system"; content: string }[],
    userPrompt: string,
    symbol = "UNKNOWN",
  ): Promise<CopilotResponse> {
    return this.provider.generateCopilotResponse({
      symbol,
      systemInstruction,
      chatHistory,
      userPrompt,
    });
  }

  public async generatePostTradeReview(input: PostTradeReviewInput): Promise<unknown> {
    return this.provider.generatePostTradeReview(input);
  }

  public getProviderMetadata(): { name: string; modelName?: string } {
    return {
      name: this.provider.name,
      ...(this.provider.modelName ? { modelName: this.provider.modelName } : {}),
    };
  }
}

let sharedLlmServiceInstance: LlmService | null = null;

export const getSharedLlmService = (): LlmService => {
  sharedLlmServiceInstance ??= new LlmService();
  return sharedLlmServiceInstance;
};

export const sharedLlmService: Pick<
  LlmService,
  "generateAlertReport" | "generateCopilotResponse" | "generatePostTradeReview" | "getProviderMetadata"
> = {
  generateAlertReport: (...args: Parameters<LlmService["generateAlertReport"]>) => {
    return getSharedLlmService().generateAlertReport(...args);
  },
  generateCopilotResponse: (...args: Parameters<LlmService["generateCopilotResponse"]>) => {
    return getSharedLlmService().generateCopilotResponse(...args);
  },
  generatePostTradeReview: (...args: Parameters<LlmService["generatePostTradeReview"]>) => {
    return getSharedLlmService().generatePostTradeReview(...args);
  },
  getProviderMetadata: () => getSharedLlmService().getProviderMetadata(),
};
