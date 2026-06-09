/** @type {import('next').NextConfig} */
// Headers de segurança estáticos. O Content-Security-Policy é definido POR
// REQUISIÇÃO no middleware (nonce + strict-dynamic em produção — F-09/S01c).
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",   value: "on" },
  { key: "X-Frame-Options",          value: "DENY" },
  { key: "X-Content-Type-Options",   value: "nosniff" },
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

const nextConfig = {
  transpilePackages: ["@repo/auth-shared", "@repo/db"],
  experimental: {
    serverComponentsExternalPackages: ["ioredis"],
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
