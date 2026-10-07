import { expect, test } from "bun:test";
import { findModel, modelsOrError, parseModels } from "./models";

test("LLM_MODELS: id, cost tier and optional name; the first is the default", () => {
  expect(
    parseModels(
      "deepseek/deepseek-v4.1-flash $ DeepSeek V4.1 Flash, anthropic/claude-sonnet-5.5 $$$",
      "openrouter",
    ),
  ).toEqual([
    {
      id: "deepseek/deepseek-v4.1-flash",
      tier: "$",
      name: "DeepSeek V4.1 Flash",
      vendor: "deepseek",
    },
    {
      id: "anthropic/claude-sonnet-5.5",
      tier: "$$$",
      name: "anthropic/claude-sonnet-5.5",
      vendor: "anthropic",
    },
  ]);
});

test("an id without a vendor prefix is the provider's own model", () => {
  expect(parseModels("claude-sonnet-5-5 $$$", "anthropic")[0].vendor).toBe(
    "anthropic",
  );
});

test("a missing list or a missing cost tier is a clear error", () => {
  expect(() => parseModels(undefined, "anthropic")).toThrow(/set LLM_MODELS/);
  expect(() => parseModels(" , ", "anthropic")).toThrow(/set LLM_MODELS/);
  expect(() =>
    parseModels("claude-sonnet-5-5 Claude Sonnet", "anthropic"),
  ).toThrow(/needs a cost tier/);
});

test("only a model listed in LLM_MODELS runs", () => {
  process.env.LLM_MODELS = "mock-fast $ Mock Fast";
  expect(findModel("mock-fast").name).toBe("Mock Fast");
  expect(() => findModel("someone/else")).toThrow(/no longer in LLM_MODELS/);
  delete process.env.LLM_MODELS;
});

test("a broken LLM_MODELS leaves pages working and says what's wrong", () => {
  process.env.LLM_MODELS = "claude-sonnet-5-5 Claude Sonnet";
  expect(modelsOrError()).toEqual({
    models: [],
    error: expect.stringMatching(/needs a cost tier/),
  });
  delete process.env.LLM_MODELS;
});
