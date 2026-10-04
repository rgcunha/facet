import { expect, test } from "bun:test";
import { exportFileName } from "./page";

test("export file name joins name and title with safe characters", () => {
  expect(exportFileName("Alex Moreno", "Senior Backend Engineer")).toBe(
    "Alex-Moreno_Senior-Backend-Engineer",
  );
  expect(exportFileName(" João Gonçalves ", "Dev / Ops (m/w/d)")).toBe(
    "João-Gonçalves_Dev-Ops-m-w-d",
  );
  expect(exportFileName("", "Base CV")).toBe("Base-CV");
  expect(exportFileName("", "")).toBe("CV");
});
