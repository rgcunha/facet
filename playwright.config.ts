import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3100;
const MOCK_PORT = 3101;

// Set before the servers start, so they inherit it. The app talks to a local mock instead of the
// provider in .env (process env wins over .env), and keeps its files in a fresh temp folder.
// Workers inherit DATA_DIR from the main process, hence ??=.
Object.assign(process.env, {
  LLM_PROVIDER: "openai-compatible",
  LLM_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
  LLM_MODEL: "mock",
  LLM_API_KEY: "mock",
});
process.env.DATA_DIR ??= mkdtempSync(path.join(os.tmpdir(), "cv-tool-e2e-"));

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts", // not *.spec.ts, which `bun test` would pick up
  workers: 1, // the tests share the mock's recorded calls
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "bun e2e/mock-llm.ts",
      url: `http://localhost:${MOCK_PORT}/calls`,
    },
    {
      // A production build in .next, so it runs beside `next dev` (which uses .next/dev).
      command: `bun run build && bun run start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      timeout: 240_000,
    },
  ],
});
