import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
import { apps } from "./apps"

export const appSubscriptions = pgTable(
  "app_subscriptions",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.appId] }),
    tenantIdx: index("idx_app_subscriptions_tenant").on(t.tenantId, t.active),
  })
)

export type AppSubscription = typeof appSubscriptions.$inferSelect
export type NewAppSubscription = typeof appSubscriptions.$inferInsert
