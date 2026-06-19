/**
 * Adapter de acesso ao Supabase (GoTrue + user_tenants) via fetch nativo.
 * Não depende de @supabase/supabase-js — usa a REST API diretamente.
 *
 * Requer env vars em apps/auth:
 *   SUPABASE_URL              — ex: https://qidrgvrrbscvhmvfihnx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service_role key do projeto Supabase
 */

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
  if (role === 'Master')        return { legacyRole: 'admin', isMasterGlobal: true }
  if (role === 'Administrador') return { legacyRole: 'admin', isMasterGlobal: false }
  return { legacyRole: 'user', isMasterGlobal: false }
}

function rowsToTenants(utRows: UserTenantRow[]): SupabaseTenantEntry[] {
  return utRows.map(ut => {
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
}

/**
 * Valida senha via GoTrue e retorna o GoTrue UUID do usuário.
 * Retorna null se credenciais inválidas ou se env vars ausentes.
 */
export async function validateGoTruePassword(
  email: string,
  password: string,
): Promise<string | null> {
  const env = getEnv()
  if (!env) return null

  try {
    const res = await fetch(`${env.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: headers(env.key),
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: { id?: string } }
    return data.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Busca memberships de tenant diretamente pelo GoTrue UUID.
 * Mais eficiente que getSupabaseUserTenants (sem listUsers).
 */
export async function getSupabaseUserTenantsByGoTrueId(goTrueId: string): Promise<SupabaseTenantEntry[] | null> {
  const env = getEnv()
  if (!env) return null

  try {
    const res = await fetch(
      `${env.url}/rest/v1/user_tenants?user_id=eq.${encodeURIComponent(goTrueId)}&select=user_id,tenant_id,role,status,modulos`,
      { headers: headers(env.key) },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as UserTenantRow[]
    return rowsToTenants(rows)
  } catch (err) {
    console.error('[supabase-user-tenants] Erro ao buscar por GoTrue ID:', err)
    return null
  }
}

/**
 * Busca memberships de tenant pelo email do usuário (via listUsers GoTrue).
 * Mantido para backward compat; prefer getSupabaseUserTenantsByGoTrueId quando
 * o GoTrue UUID já estiver disponível.
 */
export async function getSupabaseUserTenants(email: string): Promise<{
  goTrueUserId: string
  tenants: SupabaseTenantEntry[]
} | null> {
  const env = getEnv()
  if (!env) return null

  try {
    const listRes = await fetch(
      `${env.url}/auth/v1/admin/users?per_page=1000`,
      { headers: headers(env.key) },
    )
    if (!listRes.ok) return null

    const listData = (await listRes.json()) as { users?: { id: string; email?: string }[] }
    const goTrueUser = listData.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase(),
    )
    if (!goTrueUser) return null

    const tenants = await getSupabaseUserTenantsByGoTrueId(goTrueUser.id)
    if (!tenants) return null

    return { goTrueUserId: goTrueUser.id, tenants }
  } catch (err) {
    console.error('[supabase-user-tenants] Erro ao buscar tenants:', err)
    return null
  }
}
