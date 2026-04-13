import {
  pgTable,
  uuid,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { tenants } from "./tenants"
import { apps } from "./apps"

export const userAppAccess = pgTable(
  "user_app_access",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tenantId, t.appId] }),
    userTenantIdx: index("idx_user_app_access_user_tenant").on(
      t.userId,
      t.tenantId
    ),
    tenantAppIdx: index("idx_user_app_access_tenant_app").on(
      t.tenantId,
      t.appId
    ),
  })
)

export type UserAppAccess = typeof userAppAccess.$inferSelect
export type NewUserAppAccess = typeof userAppAccess.$inferInsert
