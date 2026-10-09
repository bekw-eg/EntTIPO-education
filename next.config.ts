import type { NextConfig } from "next";
import path from "path";
import { retiredPages } from "./lib/publicFeatures";

const nextConfig: NextConfig = {
  // Keep smoke builds separate from an already running development checkout.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["katex"],
  transpilePackages: ["react-katex"],
  async redirects() {
    // Browsers can request the conventional favicon URL before metadata is ready.
    return [{ source: "/favicon.ico", destination: "/icon.svg", permanent: true },
      ...retiredPages.map(root => ({ source: `${root}/:path*`, destination: "/exam", permanent: false }))];
  },
  async headers() {
    return [{
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
