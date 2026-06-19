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
 * Cria usuário no GoTrue via Admin API. Retorna o GoTrue UUID ou null se falhar.
 * Se o usuário já existir (422), tenta recuperar o UUID pelo email.
 * Soft-fail: nunca lança — GoTrue indisponível não deve bloquear o fluxo principal.
 */
export async function createGoTrueUser(email: string, password: string): Promise<string | null> {
  const env = getEnv()
  if (!env) return null

  try {
    const res = await fetch(`${env.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: headers(env.key),
      body: JSON.stringify({ email, password, email_confirm: true }),
    })

    if (res.ok) {
      const data = (await res.json()) as { id?: string }
      return data.id ?? null
    }

    // 422 = "User already registered" — recupera UUID existente por email
    if (res.status === 422) {
      const listRes = await fetch(
        `${env.url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${env.key}`, apikey: env.key } },
      )
      if (!listRes.ok) return null
      const data = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> }
      return data.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
    }

    console.error('[createGoTrueUser] falhou — status:', res.status)
    return null
  } catch {
    return null
  }
}

/**
 * Atualiza senha de um usuário no GoTrue via Admin API.
 * Soft-fail: retorna false se falhar sem lançar.
 */
export async function updateGoTruePassword(goTrueId: string, password: string): Promise<boolean> {
  const env = getEnv()
  if (!env) return false

  try {
    const res = await fetch(`${env.url}/auth/v1/admin/users/${goTrueId}`, {
      method: 'PUT',
      headers: headers(env.key),
      body: JSON.stringify({ password }),
    })
    if (!res.ok) console.error('[updateGoTruePassword] falhou — status:', res.status)
    return res.ok
  } catch {
    return false
  }
}

