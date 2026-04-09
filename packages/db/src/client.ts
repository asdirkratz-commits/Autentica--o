import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"

const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
}

function getConnectionString(forMigration = false): string {
  const url = forMigration ? env.DIRECT_URL : env.DATABASE_URL
  if (!url) {
    throw new Error(
      forMigration
        ? "DIRECT_URL is required for migrations"
        : "DATABASE_URL is required"
    )
  }
  return url
}

// Singleton para queries (usa pooler em produção)
const queryClient = postgres(getConnectionString(), { max: 1 })
export const db = drizzle(queryClient, { schema })

// Cliente para migrations (usa DIRECT_URL, sem pooler)
export function getMigrationClient() {
  const migrationClient = postgres(getConnectionString(true), { max: 1 })
  return drizzle(migrationClient, { schema })
}

export type DB = typeof db
