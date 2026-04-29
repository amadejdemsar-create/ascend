import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@modelcontextprotocol/sdk",
    "pdfkit",
    "unpdf",
    "xlsx",
    "ffmpeg-static",
    "papaparse",
  ],
  transpilePackages: ["@ascend/core", "@ascend/api-client", "@ascend/storage", "@ascend/ui-tokens"],
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
