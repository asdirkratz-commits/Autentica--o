/**
 * Adapter de acesso ao Supabase user_tenants via fetch nativo.
 * Não depende de @supabase/supabase-js — usa a REST API diretamente.
 *
 * Requer env vars no apps/auth:
 *   SUPABASE_URL            — ex: https://qidrgvrrbscvhmvfihnx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service_role key do projeto Supabase
 *
 * Estas env vars são opcionais para retrocompatibilidade: quando ausentes,
 * o caller deve usar o fallback via Neon userTenants.
 */

type GoTrueUser = {
  id: string
  email?: string
  user_metadata?: { nome?: string }
}

type UserTenantRow = {
  user_id: string
  tenant_id: string
  role: 'Master' | 'Administrador' | 'Colaborador'
  status: 'ativo' | 'inativo' | 'bloqueado'
  modulos: string[]
}

export type SupabaseTenantEntry = {
  tenantId: string
  role: 'admin' | 'user'
  isMasterGlobal: boolean
  status: 'active' | 'inactive'
  modulos: string[]
  permissions: Record<string, boolean>
}

function getEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, key } : null
}

function headers(key: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    apikey: key,
  }
}

function mapRole(role: string): { legacyRole: 'admin' | 'user'; isMasterGlobal: boolean } {
  if (role === 'Master')       return { legacyRole: 'admin', isMasterGlobal: true }
  if (role === 'Administrador') return { legacyRole: 'admin', isMasterGlobal: false }
  return { legacyRole: 'user', isMasterGlobal: false }
}

/**
 * Busca os memberships de tenant do usuário no Supabase (GoTrue + user_tenants).
 * Retorna null se SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não estão configuradas
 * ou se o usuário não existir no GoTrue — caller deve usar Neon fallback.
 */
export async function getSupabaseUserTenants(email: string): Promise<{
  goTrueUserId: string
  tenants: SupabaseTenantEntry[]
} | null> {
  const env = getEnv()
  if (!env) return null

  try {
    // 1. Lookup GoTrue user by email via Admin API
    const listRes = await fetch(
      `${env.url}/auth/v1/admin/users?per_page=1000`,
      { headers: headers(env.key) },
    )
    if (!listRes.ok) return null

    const listData = (await listRes.json()) as { users?: GoTrueUser[] }
    const goTrueUser = listData.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase(),
    )
    if (!goTrueUser) return null

    // 2. Query user_tenants via PostgREST
    const utRes = await fetch(
      `${env.url}/rest/v1/user_tenants?user_id=eq.${encodeURIComponent(goTrueUser.id)}&select=user_id,tenant_id,role,status,modulos`,
      { headers: headers(env.key) },
    )
    if (!utRes.ok) return null

    const utRows = (await utRes.json()) as UserTenantRow[]

    const tenants: SupabaseTenantEntry[] = utRows.map(ut => {
      const { legacyRole, isMasterGlobal } = mapRole(ut.role)
      return {
        tenantId: ut.tenant_id,
        role: legacyRole,
        isMasterGlobal,
        status: ut.status === 'ativo' ? 'active' : 'inactive',
        modulos: ut.modulos ?? [],
        permissions: {},
      }
    })

    return { goTrueUserId: goTrueUser.id, tenants }
  } catch (err) {
    console.error('[supabase-user-tenants] Erro ao buscar tenants:', err)
    return null
  }
}
