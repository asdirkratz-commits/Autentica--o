import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index"

function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  const client = postgres(url, { max: 1 })
  return drizzle(client, { schema })
}

export function getMigrationClient() {
  const url = process.env.DIRECT_URL
  if (!url) throw new Error("DIRECT_URL is required for migrations")
  const client = postgres(url, { max: 1 })
  return drizzle(client, { schema })
}

// Lazy singleton — conecta apenas na primeira query, não no import
let _db: ReturnType<typeof createDb> | null = null

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop: string | symbol) {
    if (!_db) _db = createDb()
    return (_db as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type DB = typeof db
