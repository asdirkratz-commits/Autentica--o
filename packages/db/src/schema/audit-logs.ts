import {
  pgTable,
  bigserial,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  inet,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { tenants } from "./tenants"

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    ipAddress: inet("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantDateIdx: index("idx_audit_tenant_date").on(t.tenantId, t.createdAt),
    actionDateIdx: index("idx_audit_action_date").on(t.action, t.createdAt),
    userDateIdx: index("idx_audit_user_date").on(t.userId, t.createdAt),
  })
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
