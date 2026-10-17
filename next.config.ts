import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server, so the macOS bundle runs without `bun install` (scripts/mac).
  output: "standalone",
  // The trace misses files Playwright reads at run time, such as browsers.json.
  outputFileTracingIncludes: {
    "/cv/\\[id\\]/pdf": ["./node_modules/playwright-core/**/*"],
  },
  experimental: {
    // CV PDFs are uploaded through a Server Action (limit 1 MB by default); the action itself caps them at 10 MB.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
