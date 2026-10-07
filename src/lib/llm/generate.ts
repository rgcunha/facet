import {
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
} from "ai";
import { z } from "zod";
import type { PrivateValue, Run } from "@/lib/cv/schema";
import { assertNoPrivateData } from "@/lib/privacy/guard";
import { redact, rehydrate, toMasks } from "@/lib/privacy/redact";
import { findModel } from "./models";
import { getModel, type ModelRef, refusalMessage } from "./provider";

/** OpenRouter puts what a call cost in its usage; other providers don't say. */
const costSchema = z.object({
  usage: z.object({ cost: z.number().nonnegative() }),
});
const costOf = (body: unknown) => {
  const parsed = costSchema.safeParse(body);
  return parsed.success ? parsed.data.usage.cost : null;
};

/** The errors that mean "try another model", in words the user can act on. Others pass through. */
function explain(error: unknown, name: string) {
  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error)
  )
    return `${name} couldn't produce a valid answer. Nothing was changed. Pick another model and try again.`;
  return refusalMessage(error, name);
}

/**
 * Every LLM call goes through here. The prompt is masked with the same `redact` the Import screen
 * previews, checked by the guard, sent, and the private values are put back into the answer locally.
 * Returns the answer and the run: which model answered, its cost and tokens.
 */
export async function generateStructured<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  privateValues: PrivateValue[];
  model: ModelRef;
}): Promise<{ output: T; run: Run }> {
  const masks = toMasks(options.privateValues);
  const prompt = redact(options.prompt, masks);
  assertNoPrivateData(`${options.system}\n${prompt}`, options.privateValues);

  // An id is checked against LLM_MODELS here, so no caller can run a model that isn't listed.
  const { model, name } =
    typeof options.model === "string"
      ? { name: findModel(options.model).name, model: getModel(options.model) }
      : { model: options.model, name: options.model.modelId };
  try {
    const result = await generateText({
      model,
      system: options.system,
      prompt,
      output: Output.object({ schema: options.schema }),
      include: { responseBody: true }, // where OpenRouter reports the cost
    });
    return {
      output: rehydrate(result.output, masks),
      run: {
        model: model.modelId,
        costUsd: costOf(result.response.body),
        tokens: result.usage.totalTokens ?? 0,
      },
    };
  } catch (error) {
    const message = explain(error, name);
    if (message) throw new Error(message, { cause: error });
    throw error;
  }
}
