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

    // ─── Identidade visual ──────────────────────────────────────────────────
    // JSON: { primary, secondary, accent } — cores em hex (#rrggbb)
    theme: text("theme"),

    // ─── Configuração de IA ─────────────────────────────────────────────────
    // JSON criptografado: { active_provider, providers: { openai, gemini, claude } }
    aiConfig: text("ai_config"),

    // ─── Dados fiscais ──────────────────────────────────────────────────────
    cnpj: varchar("cnpj", { length: 18 }),           // XX.XXX.XXX/XXXX-XX

    // ─── Endereço ───────────────────────────────────────────────────────────
    zipCode:      varchar("zip_code",      { length: 9 }),   // XXXXX-XXX
    street:       varchar("street",        { length: 255 }),
    streetNumber: varchar("street_number", { length: 20 }),
    complement:   varchar("complement",    { length: 100 }),
    district:     varchar("district",      { length: 100 }),
    city:         varchar("city",          { length: 100 }),
    state:        varchar("state",         { length: 2 }),    // UF (SP, RJ…)
    country:      varchar("country",       { length: 2 }).default("BR"),

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
    cnpjIdx: index("idx_tenants_cnpj").on(t.cnpj),
  })
)

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
