import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * The only place that knows about vendors; switching provider is a .env change.
 * - anthropic: Claude via the Anthropic API.
 * - openai-compatible: anything with an OpenAI-style endpoint, e.g. OpenRouter
 *   (https://openrouter.ai/api/v1), Ollama (http://localhost:11434/v1) or LM Studio.
 */
export function getModel(): LanguageModel {
  const {
    LLM_PROVIDER = "anthropic",
    LLM_MODEL,
    LLM_API_KEY,
    LLM_BASE_URL,
  } = process.env;
  if (!LLM_MODEL)
    throw new Error(
      "No model configured: set LLM_MODEL in .env (see .env.example).",
    );

  if (LLM_PROVIDER === "anthropic")
    return createAnthropic({ apiKey: LLM_API_KEY })(LLM_MODEL);
  if (LLM_PROVIDER === "openai-compatible") {
    if (!LLM_BASE_URL)
      throw new Error(
        "Set LLM_BASE_URL in .env for the openai-compatible provider.",
      );
    return createOpenAICompatible({
      name: "llm",
      baseURL: LLM_BASE_URL,
      apiKey: LLM_API_KEY,
      supportsStructuredOutputs: true,
    }).chatModel(LLM_MODEL);
  }
  throw new Error(
    `Unknown LLM_PROVIDER "${LLM_PROVIDER}": use "anthropic" or "openai-compatible".`,
  );
}
