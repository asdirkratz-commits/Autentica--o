import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core"
import { tenantStatusEnum } from "./enums"

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    status: tenantStatusEnum("status").notNull().default("ativo"),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    logoUrl: text("logo_url"),
    internalNotes: text("internal_notes"),
    externalBillingId: varchar("external_billing_id", { length: 255 }),
    plan: varchar("plan", { length: 50 }).notNull().default("basic"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("idx_tenants_status").on(t.status),
    slugIdx: index("idx_tenants_slug").on(t.slug),
  })
)

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
