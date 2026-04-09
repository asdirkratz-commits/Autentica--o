import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const url = process.env.DIRECT_URL
if (!url) throw new Error("DIRECT_URL is required for migrations")

const client = postgres(url, { max: 1 })
const db = drizzle(client)

async function main() {
  console.warn("Running migrations...")
  await migrate(db, { migrationsFolder: "./src/migrations" })
  console.warn("Migrations complete.")
  await client.end()
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
