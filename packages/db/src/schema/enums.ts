import { pgEnum } from "drizzle-orm/pg-core"

export const tenantStatusEnum = pgEnum("tenant_status", [
  "ativo",
  "inativo",
  "inadimplente",
  "bloqueado",
])

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "user"])

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "pending",
])

export const appEnvEnum = pgEnum("app_env", ["production", "sandbox"])
