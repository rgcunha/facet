const TIERS = ["$", "$$", "$$$"] as const;

/** A model the user can pick, from LLM_MODELS in .env. */
export type ModelOption = {
  id: string;
  name: string;
  /** Rough cost of one run: $ under 1¢, $$ 1–5¢, $$$ over 5¢. Set by hand in .env. */
  tier: (typeof TIERS)[number];
  /** Who makes the model, for its logo: the id's prefix ("anthropic/…"), or the provider itself. */
  vendor: string;
};

/**
 * Parses LLM_MODELS: comma-separated "id tier name" entries, the first being the default, e.g.
 * "deepseek/deepseek-v4.1-flash $ DeepSeek V4.1 Flash, anthropic/claude-sonnet-5.5 $$$ Claude Sonnet 5.5".
 * The name is optional; the id is shown without one.
 */
export function parseModels(
  value: string | undefined,
  provider: string,
): ModelOption[] {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.length)
    throw new Error(
      "No models configured: set LLM_MODELS in .env (see .env.example).",
    );
  return entries.map((entry) => {
    const [id, tier, ...name] = entry.split(/\s+/);
    if (!TIERS.includes(tier as ModelOption["tier"]))
      throw new Error(
        `LLM_MODELS: "${entry}" needs a cost tier after the model id: $, $$ or $$$.`,
      );
    return {
      id,
      tier: tier as ModelOption["tier"],
      name: name.join(" ") || id,
      vendor: id.includes("/") ? id.split("/")[0] : provider,
    };
  });
}

const listModels = () =>
  parseModels(process.env.LLM_MODELS, process.env.LLM_PROVIDER ?? "anthropic");

/** For pages: a bad LLM_MODELS mustn't stop editing, so the pickers show the error instead. */
export function modelsOrError() {
  try {
    return { models: listModels(), error: null };
  } catch (e) {
    return { models: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** A model id from the browser or a task: only the ones in LLM_MODELS are run. */
export function findModel(id: string) {
  const model = listModels().find((m) => m.id === id);
  if (!model)
    throw new Error(`"${id}" is no longer in LLM_MODELS. Pick another model.`);
  return model;
}
