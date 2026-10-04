import { expect, test } from "bun:test";
import { joinFilled, range, visible } from "./format";

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
