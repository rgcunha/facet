import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CV PDFs are uploaded through a Server Action (limit 1 MB by default); the action itself caps them at 10 MB.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
