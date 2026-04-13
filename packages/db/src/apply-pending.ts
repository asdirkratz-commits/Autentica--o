/**
 * Script de emergência: aplica colunas pendentes diretamente no banco.
 * Usar quando as migrações do Drizzle falharam silenciosamente.
 * Uso: pnpm --filter @repo/db apply-pending
 */
import postgres from "postgres"

const url = process.env.DIRECT_URL
if (!url) throw new Error("DIRECT_URL is required. Run with: tsx --env-file ../../.env.local src/apply-pending.ts")

const client = postgres(url, { max: 1 })

async function main() {
  console.log("Aplicando colunas pendentes na tabela tenants...\n")

  // ── 0002: CNPJ + endereço ──────────────────────────────────────────────────
  console.log("→ Migration 0002: cnpj + address")
  await client`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "cnpj"          VARCHAR(18),
      ADD COLUMN IF NOT EXISTS "zip_code"      VARCHAR(9),
      ADD COLUMN IF NOT EXISTS "street"        VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "street_number" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "complement"    VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "district"      VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "city"          VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "state"         VARCHAR(2),
      ADD COLUMN IF NOT EXISTS "country"       VARCHAR(2) DEFAULT 'BR'
  `
  await client`
    CREATE INDEX IF NOT EXISTS "idx_tenants_cnpj" ON "tenants" ("cnpj")
  `
  console.log("   ✓ cnpj, zip_code, street, street_number, complement, district, city, state, country\n")

  // ── 0003: theme + ai_config ────────────────────────────────────────────────
  console.log("→ Migration 0003: theme + ai_config")
  await client`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "theme"     TEXT,
      ADD COLUMN IF NOT EXISTS "ai_config" TEXT
  `
  console.log("   ✓ theme, ai_config\n")

  // ── 0004: logo_url (caso ainda não exista) ─────────────────────────────────
  console.log("→ Migration 0001+: logo_url")
  await client`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "logo_url" TEXT
  `
  console.log("   ✓ logo_url\n")

  // ── Verificação final ──────────────────────────────────────────────────────
  const cols = await client`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'tenants'
    ORDER BY ordinal_position
  `
  console.log("Colunas atuais da tabela tenants:")
  for (const col of cols) {
    const type = col.character_maximum_length
      ? `${col.data_type}(${col.character_maximum_length})`
      : col.data_type
    console.log(`  ${col.column_name.padEnd(25)} ${type}`)
  }

  await client.end()
  console.log("\nConcluído.")
}

main().catch((err) => {
  console.error("Erro:", err)
  process.exit(1)
})
