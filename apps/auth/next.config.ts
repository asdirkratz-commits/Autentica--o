import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/auth-shared", "@repo/db", "@repo/ui"],
  experimental: {
    serverComponentsExternalPackages: ["bcryptjs"],
  },
}

export default nextConfig
