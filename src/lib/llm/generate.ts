import { generateText, type LanguageModel, Output } from "ai";
import type { z } from "zod";
import type { PrivateValue } from "@/lib/cv/schema";
import { assertNoPrivateData } from "@/lib/privacy/guard";
import { redact, rehydrate, toMasks } from "@/lib/privacy/redact";
import { getModel } from "./provider";

/**
 * Every LLM call goes through here. The prompt is masked with the same `redact` the Import screen
 * previews, checked by the guard, sent, and the private values are put back into the answer locally.
 */
export async function generateStructured<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  privateValues: PrivateValue[];
  model?: LanguageModel;
}): Promise<T> {
  const masks = toMasks(options.privateValues);
  const prompt = redact(options.prompt, masks);
  assertNoPrivateData(`${options.system}\n${prompt}`, options.privateValues);

  const { output } = await generateText({
    model: options.model ?? getModel(),
    system: options.system,
    prompt,
    output: Output.object({ schema: options.schema }),
  });
  return rehydrate(output, masks);
}
