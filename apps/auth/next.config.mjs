/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",   value: "on" },
  { key: "X-Frame-Options",          value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",   value: "nosniff" },
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
]

const nextConfig = {
  transpilePackages: ["@repo/auth-shared", "@repo/db", "@repo/ui"],
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["bcryptjs", "ioredis"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
