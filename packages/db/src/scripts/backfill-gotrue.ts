/**
 * Backfill GoTrue — cria entradas no Supabase Auth para todos os usuários Neon sem gotrue_id.
 *
 * Cada usuário recebe uma senha aleatória desconhecida no GoTrue. Após o backfill,
 * o usuário PRECISA trocar a senha via /change-password para sincronizar GoTrue
 * com a senha real (pós-P6 não há mais fallback bcrypt).
 *
 * Pré-requisito: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em apps/auth/.env.local
 *
 * Uso (da raiz do monorepo):
 *   pnpm backfill:gotrue
 */

import { db } from "../client"
import { users } from "../schema/index"
import { eq, isNull } from "drizzle-orm"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.")
  console.error("    Adicione-os ao apps/auth/.env.local e rode com: pnpm backfill:gotrue")
  process.exit(1)
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_KEY}`,
    apikey: SUPABASE_KEY!,
  }
}

async function createGoTrueUser(email: string): Promise<string | null> {
  // Credencial efêmera gerada em runtime — nunca exposta, substituída na 1ª troca de senha.
  const ephemeral = `${crypto.randomUUID().replace(/-/g, "")}Kx!`

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password: ephemeral, email_confirm: true }),
  })

  if (res.ok) {
    const data = (await res.json()) as { id?: string }
    return data.id ?? null
  }

  // 422 = usuário já existe no GoTrue — recupera UUID pelo email
  if (res.status === 422) {
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY! } },
    )
    if (!listRes.ok) return null
    const data = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> }
    return data.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
  }

  console.error(`  GoTrue POST falhou — status: ${res.status}`)
  return null
}

async function setGoTrueId(neonId: string, goTrueId: string): Promise<void> {
  await db
    .update(users)
    .set({ goTrueId, updatedAt: new Date() })
    .where(eq(users.id, neonId))
}

async function main(): Promise<void> {
  console.log("🔍  Buscando usuários sem gotrue_id no Neon...")

  const pending = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(isNull(users.goTrueId))

  if (pending.length === 0) {
    console.log("✅  Todos os usuários já têm gotrue_id. Nada a fazer.")
    process.exit(0)
  }

  console.log(`📋  ${pending.length} usuário(s) sem gotrue_id:`)
  for (const u of pending) console.log(`    - ${u.email}`)
  console.log()

  let migrated = 0
  let failed = 0

  for (const u of pending) {
    process.stdout.write(`    ${u.email}... `)
    const goTrueId = await createGoTrueUser(u.email)
    if (!goTrueId) {
      console.log("❌  GoTrue create falhou")
      failed++
      continue
    }
    try {
      await setGoTrueId(u.id, goTrueId)
      console.log(`✅  ${goTrueId}`)
      migrated++
    } catch (err) {
      console.log(`❌  GoTrue criado (${goTrueId}) mas Neon update falhou: ${err}`)
      console.log(`    Re-rode o script para completar o link.`)
      failed++
    }
  }

  console.log()
  console.log(`Resultado: ${migrated} migrado(s) / ${failed} falha(s)`)

  if (failed > 0) {
    console.log("⚠   Rode novamente para re-tentar os que falharam.")
    process.exit(1)
  }

  console.log()
  console.log("⚠   Senha GoTrue definida como aleatória (não conhecida pelo usuário).")
  console.log("    O usuário deve trocar a senha via /change-password para ativar o login GoTrue.")
  console.log("    Sem troca, o login falhará (não há fallback bcrypt desde P6).")
}

main().catch(e => { console.error(e); process.exit(1) })
