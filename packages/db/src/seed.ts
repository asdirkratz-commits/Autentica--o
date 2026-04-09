/**
 * Seed inicial: apps do ecossistema + usuário master_global
 *
 * Uso: pnpm --filter @repo/db seed
 */

import { db } from "./client.js"
import { apps, users, userTenants } from "./schema/index.js"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

const MASTER_EMAIL = process.env.MASTER_EMAIL
const MASTER_PASSWORD = process.env.MASTER_PASSWORD
const MASTER_NAME = process.env.MASTER_NAME ?? "Master Global"

if (!MASTER_EMAIL || !MASTER_PASSWORD) {
  console.error("❌ MASTER_EMAIL e MASTER_PASSWORD são obrigatórios no .env")
  process.exit(1)
}

const INITIAL_APPS = [
  {
    name: "auth",
    displayName: "Auth",
    description: "Serviço central de autenticação SSO",
    baseUrl: process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001",
  },
  {
    name: "admin",
    displayName: "Admin",
    description: "Painel do dono da plataforma",
    baseUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002",
  },
  {
    name: "kontohub",
    displayName: "KontoHub",
    description: "Gestão para escritórios de contabilidade",
    baseUrl: process.env.NEXT_PUBLIC_KONTOHUB_URL ?? "http://localhost:3003",
  },
  {
    name: "kontozap",
    displayName: "KontoZap",
    description: "Comunicação WhatsApp + VoIP",
    baseUrl: process.env.NEXT_PUBLIC_KONTOZAP_URL ?? "http://localhost:3004",
  },
] as const

async function seed() {
  console.log("🌱 Iniciando seed...\n")

  // ── 1. Apps ─────────────────────────────────────────────────────────────────
  console.log("📦 Inserindo apps...")
  for (const appData of INITIAL_APPS) {
    const existing = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.name, appData.name))
      .limit(1)

    if (existing.length > 0) {
      console.log(`  ⏭  ${appData.name} já existe — ignorando`)
      continue
    }

    await db.insert(apps).values({
      name: appData.name,
      displayName: appData.displayName,
      description: appData.description,
      baseUrl: appData.baseUrl,
    })
    console.log(`  ✅ ${appData.name} criado`)
  }

  // ── 2. Usuário master_global ─────────────────────────────────────────────────
  console.log("\n👤 Criando usuário master_global...")

  const existingMaster = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, MASTER_EMAIL!))
    .limit(1)

  if (existingMaster.length > 0) {
    console.log(`  ⏭  Usuário ${MASTER_EMAIL} já existe — ignorando`)
  } else {
    const passwordHash = await bcrypt.hash(MASTER_PASSWORD!, 12)

    await db.insert(users).values({
      email: MASTER_EMAIL!,
      passwordHash,
      fullName: MASTER_NAME,
      isMasterGlobal: true,
    })

    console.log(`  ✅ Master global criado: ${MASTER_EMAIL}`)
  }

  console.log("\n✅ Seed concluído!")
  process.exit(0)
}

seed().catch((err) => {
  console.error("❌ Erro no seed:", err)
  process.exit(1)
})
