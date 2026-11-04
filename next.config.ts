import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Hide the developer badge that sits over the sidebar while testing on the Mac.
  devIndicators: false,
  // Lets a test build run in another folder without disturbing the dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Payment screenshots are shrunk on the phone first, so this is plenty.
    serverActions: { bodySizeLimit: "4mb" },
  },
}

export default nextConfig
