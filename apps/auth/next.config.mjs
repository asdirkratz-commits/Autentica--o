/** @type {import('next').NextConfig} */
// F-09: 'unsafe-eval' só é necessário em dev (React Refresh/HMR); em produção o
// Next App Router não precisa → removido. 'unsafe-inline' em script-src segue
// pendente — removê-lo exige nonce por requisição (S01c, com smoke-test logado).
const isDev = process.env.NODE_ENV !== "production"
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

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
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
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
