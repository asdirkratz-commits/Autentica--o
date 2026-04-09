import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { userRoleEnum } from "./enums.js"
import { users } from "./users.js"
import { tenants } from "./tenants.js"

export const inviteTokens = pgTable(
  "invite_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    permissions: jsonb("permissions").notNull().default({}),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailTenantIdx: index("idx_invite_tokens_email_tenant").on(
      t.email,
      t.tenantId
    ),
    expiresIdx: index("idx_invite_tokens_expires").on(t.expiresAt),
  })
)

export type InviteToken = typeof inviteTokens.$inferSelect
export type NewInviteToken = typeof inviteTokens.$inferInsert
