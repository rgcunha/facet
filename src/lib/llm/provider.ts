import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, type LanguageModel } from "ai";

/** A model id from LLM_MODELS, or (in tests) a model object. */
export type ModelRef = string | Exclude<LanguageModel, string>;

/** OpenRouter refuses a model that no zero-retention provider serves; say so in words the user can act on. */
export function refusalMessage(error: unknown, name: string) {
  return APICallError.isInstance(error) &&
    error.statusCode === 404 &&
    /data policy/i.test(error.responseBody ?? error.message)
    ? `${name} has no provider that keeps no data, so OpenRouter refused it. Pick another model.`
    : null;
}

/**
 * The only place that knows about vendors; switching provider is a .env change. `id` is one of
 * LLM_MODELS, already checked by the caller.
 * - anthropic: Claude via the Anthropic API.
 * - openrouter: many vendors with one key, sent only to providers that keep no data.
 * - openai-compatible: anything else with an OpenAI-style endpoint, e.g. Ollama
 *   (http://localhost:11434/v1) or LM Studio.
 */
export function getModel(id: string): Exclude<LanguageModel, string> {
  const { LLM_PROVIDER = "anthropic", LLM_API_KEY, LLM_BASE_URL } = process.env;

  if (LLM_PROVIDER === "anthropic")
    return createAnthropic({ apiKey: LLM_API_KEY })(id);
  if (LLM_PROVIDER === "openrouter")
    return createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: LLM_API_KEY,
      supportsStructuredOutputs: true,
      // Zero data retention: OpenRouter refuses a model that no such provider serves.
      transformRequestBody: (body) => ({ ...body, provider: { zdr: true } }),
    }).chatModel(id);
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
    }).chatModel(id);
  }
  throw new Error(
    `Unknown LLM_PROVIDER "${LLM_PROVIDER}": use "anthropic", "openrouter" or "openai-compatible".`,
  );
}
