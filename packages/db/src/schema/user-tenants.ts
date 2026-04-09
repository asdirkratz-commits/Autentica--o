import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core"
import { userRoleEnum, userStatusEnum } from "./enums.js"
import { users } from "./users.js"
import { tenants } from "./tenants.js"

export const userTenants = pgTable(
  "user_tenants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull().default("user"),
    status: userStatusEnum("status").notNull().default("pending"),
    permissions: jsonb("permissions").notNull().default({}),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tenantId] }),
    tenantIdx: index("idx_user_tenants_tenant").on(t.tenantId),
    statusIdx: index("idx_user_tenants_status").on(t.tenantId, t.status),
  })
)

export type UserTenant = typeof userTenants.$inferSelect
export type NewUserTenant = typeof userTenants.$inferInsert

export type UserPermissions = {
  can_invite_users?: boolean
  can_manage_users?: boolean
  can_view_reports?: boolean
  can_export_data?: boolean
  custom?: Record<string, boolean>
}
