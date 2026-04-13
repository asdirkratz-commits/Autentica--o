import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core"
import { appEnvEnum } from "./enums"

export const apps = pgTable(
  "apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    description: text("description"),
    baseUrl: varchar("base_url", { length: 255 }).notNull(),
    iconUrl: text("icon_url"),
    apiKey: uuid("api_key").notNull().defaultRandom(),
    env: appEnvEnum("env").notNull().default("production"),
    active: boolean("active").notNull().default(true),
    parentAppId: uuid("parent_app_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    parentIdx: index("idx_apps_parent").on(t.parentAppId),
  })
)

export type App = typeof apps.$inferSelect
export type NewApp = typeof apps.$inferInsert
