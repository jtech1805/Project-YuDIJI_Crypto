import { z } from "zod";

export type AlertReportInput = {
  symbol: string;
  triggerType: "drop" | "spike";
  direction: "up" | "down";
  changePercentage: number;
  triggerPrice: number;
  timeWindowMinutes?: number;
  cvdAtTrigger?: number;
  support?: string;
  resistance?: string;
  newsContext?: string;
};

export const alertReportOutputSchema = z.object({
  catalyst: z.string(),
  threatLevel: z.string(),
  support: z.string(),
  resistance: z.string(),
  summary: z.string(),
});

export type AlertReportOutput = z.infer<typeof alertReportOutputSchema>;

export type CopilotInput = {
  symbol: string;
  systemInstruction: string;
  userPrompt: string;
  chatHistory: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  tradeMath?: unknown;
  liveContext?: unknown;
};

export const copilotOutputSchema = z.object({
  intent: z.enum(["TRADE", "GENERAL"]),
  isApproved: z.boolean(),
  reply: z.string(),
});

export type CopilotOutput = z.infer<typeof copilotOutputSchema>;

export type PostTradeReviewInput = {
  context: Record<string, unknown>;
  promptVersion: string;
  schemaVersion: string;
};

export interface LLMProvider {
  name: string;
  modelName?: string;

  generateAlertReport(input: AlertReportInput): Promise<AlertReportOutput>;

  generateCopilotResponse(input: CopilotInput): Promise<CopilotOutput>;

  generatePostTradeReview(input: PostTradeReviewInput): Promise<unknown>;
}
