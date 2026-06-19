import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core"

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    isMasterGlobal: boolean("is_master_global").notNull().default(false),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // GoTrue UUID (auth.users.id) — bridge entre Neon identity e Supabase auth
    goTrueId: uuid("gotrue_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: index("idx_users_email").on(t.email),
    goTrueIdx: index("idx_users_gotrue_id").on(t.goTrueId),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
