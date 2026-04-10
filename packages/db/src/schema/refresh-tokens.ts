import {
  pgTable,
  uuid,
  text,
  timestamp,
  inet,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { tenants } from "./tenants"

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: inet("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_refresh_tokens_user").on(t.userId, t.revokedAt),
    tenantIdx: index("idx_refresh_tokens_tenant").on(t.tenantId, t.revokedAt),
    expiresIdx: index("idx_refresh_tokens_expires").on(t.expiresAt),
  })
)

export type RefreshToken = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert
