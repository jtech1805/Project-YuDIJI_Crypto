import { AppError } from "../../errors/AppError.js";
import type { LLMProvider } from "../../ports/llm-provider.port.js";
import { GroqLLMProvider } from "./groq/groq-llm.provider.js";

export const createLLMProvider = (): LLMProvider => {
  const provider = (process.env.LLM_PROVIDER ?? "groq").toLowerCase().trim();

  switch (provider) {
    case "groq":
      return new GroqLLMProvider(
        process.env.GROQ_API_KEY ?? "",
        process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      );
    // TODO: Add OpenAI adapter when OpenAI is selected as a supported LLM provider.
    // TODO: Add Gemini adapter when Gemini is selected as a supported LLM provider.
    default:
      throw new AppError(`Unsupported LLM_PROVIDER: ${provider}`, 500);
  }
};
