import { expect, test } from "bun:test";
import { emphasis, joinFilled, range, runCost, visible } from "./format";

test("joinFilled and range skip blank parts", () => {
  expect(joinFilled(["Lead", " ", "Orbital Pay"])).toBe("Lead · Orbital Pay");
  expect(range("2021", "")).toBe("2021");
  expect(range("2017", "2021")).toBe("2017 – 2021");
});

test("visible drops entries with nothing but an id", () => {
  const entries = [
    { id: "a", name: "", items: ["", " "] },
    { id: "b", name: "Go", items: [] },
    { id: "c", name: " ", items: ["Kafka"] },
  ];
  expect(visible(entries).map((e) => e.id)).toEqual(["b", "c"]);
});

test("emphasis reads **bold** and *italic*, and leaves stray asterisks as text", () => {
  expect(emphasis("Led **10M+ users** app, *rated #1*.")).toEqual([
    { text: "Led ", style: null },
    { text: "10M+ users", style: "bold" },
    { text: " app, ", style: null },
    { text: "rated #1", style: "italic" },
    { text: ".", style: null },
  ]);
  expect(emphasis("Rated 5* on 2 * 3 stores")).toEqual([
    { text: "Rated 5* on 2 * 3 stores", style: null },
  ]);
  for (const literal of ["Unix/*nix/*BSD admin", "Globs *.ts/*.tsx", "x*y*z"])
    expect(emphasis(literal)).toEqual([{ text: literal, style: null }]);
  expect(emphasis("5*,**x**")).toEqual([
    { text: "5*,", style: null },
    { text: "x", style: "bold" },
  ]);
  expect(emphasis("**Whole bullet**")).toEqual([
    { text: "Whole bullet", style: "bold" },
  ]);
  expect(emphasis("Plain")).toEqual([{ text: "Plain", style: null }]);
});

test("a run's cost: three decimals under a cent, tokens when the provider doesn't say", () => {
  const run = { model: "m", tokens: 8400 };
  expect(runCost({ ...run, costUsd: 0.0042 })).toBe("$0.004");
  expect(runCost({ ...run, costUsd: 0.071 })).toBe("$0.07");
  expect(runCost({ ...run, costUsd: 0.00004 })).toBe("under $0.001");
  expect(runCost({ ...run, costUsd: null })).toBe("8.4k tokens");
  expect(runCost({ ...run, costUsd: null, tokens: 640 })).toBe("640 tokens");
});
