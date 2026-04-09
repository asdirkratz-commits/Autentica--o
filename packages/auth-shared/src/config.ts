// Acesso centralizado a variáveis de ambiente — nunca usar process.env diretamente nos módulos

export const env = {
  get DATABASE_URL() {
    return process.env.DATABASE_URL ?? ""
  },
  get DIRECT_URL() {
    return process.env.DIRECT_URL ?? ""
  },
  get JWT_SECRET() {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error("JWT_SECRET is required")
    return secret
  },
  get JWT_ACCESS_EXPIRES() {
    return process.env.JWT_ACCESS_EXPIRES ?? "15m"
  },
  get JWT_REFRESH_EXPIRES() {
    return process.env.JWT_REFRESH_EXPIRES ?? "7d"
  },
  get COOKIE_DOMAIN() {
    return process.env.COOKIE_DOMAIN ?? ""
  },
  get NEXT_PUBLIC_AUTH_URL() {
    return process.env.NEXT_PUBLIC_AUTH_URL ?? ""
  },
  get REDIS_URL() {
    const url = process.env.REDIS_URL
    if (!url) throw new Error("REDIS_URL is required")
    return url
  },
  get BILLING_WEBHOOK_SECRET() {
    const secret = process.env.BILLING_WEBHOOK_SECRET
    if (!secret) throw new Error("BILLING_WEBHOOK_SECRET is required")
    return secret
  },
  get NODE_ENV() {
    return (process.env.NODE_ENV ?? "development") as
      | "development"
      | "production"
      | "test"
  },
  get isProduction() {
    return process.env.NODE_ENV === "production"
  },
}
