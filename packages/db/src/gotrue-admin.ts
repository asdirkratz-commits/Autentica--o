/**
 * Cliente GoTrue Admin API para @repo/db (fetch nativo, sem @supabase/supabase-js).
 * Fonte canônica de IDENTIDADE/PERFIL pós-aposentadoria do Neon `users` (R4c).
 *
 * Convenção de metadados (server-controlled — usuário não adultera):
 *   app_metadata.is_master_global : boolean
 *   app_metadata.full_name        : string
 *   user_metadata.avatar_url      : string
 *
 * Requer env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

function getEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias")
  }
  return { url, key }
}

function authHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    apikey: key,
  }
}

/** Forma bruta de auth.users retornada pela Admin API (campos usados). */
type GoTrueUserRaw = {
  id: string
  email?: string | null
  created_at?: string
  updated_at?: string
  last_sign_in_at?: string | null
  app_metadata?: { is_master_global?: boolean; full_name?: string | null }
  user_metadata?: {
    avatar_url?: string | null
    full_name?: string | null
    nome?: string | null
  }
}

/** Perfil normalizado de um usuário GoTrue. */
export type GoTrueUser = {
  id: string
  email: string | null
  fullName: string | null
  isMasterGlobal: boolean
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
  lastSignInAt: Date | null
}

function normalize(u: GoTrueUserRaw): GoTrueUser {
  const app = u.app_metadata ?? {}
  const meta = u.user_metadata ?? {}
  return {
    id: u.id,
    email: u.email ?? null,
    fullName: app.full_name ?? meta.full_name ?? meta.nome ?? null,
    isMasterGlobal: app.is_master_global === true,
    avatarUrl: meta.avatar_url ?? null,
    createdAt: u.created_at ? new Date(u.created_at) : new Date(0),
    updatedAt: u.updated_at ? new Date(u.updated_at) : new Date(0),
    lastSignInAt: u.last_sign_in_at ? new Date(u.last_sign_in_at) : null,
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const { url, key } = getEnv()
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: authHeaders(key),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text().catch(() => "")
  const data = text ? (JSON.parse(text) as T) : null
  return { ok: res.ok, status: res.status, data }
}

export const goTrueAdmin = {
  async getById(id: string): Promise<GoTrueUser | null> {
    const r = await call<GoTrueUserRaw>("GET", `admin/users/${encodeURIComponent(id)}`)
    return r.ok && r.data?.id ? normalize(r.data) : null
  },

  async findByEmail(email: string): Promise<GoTrueUser | null> {
    const target = email.toLowerCase().trim()
    // A Admin API IGNORA ?email= (retorna a página inteira); o filtro honrado é
    // ?filter= (match parcial por email). Mantemos o .find() exato como rede de
    // segurança contra match parcial. per_page alto para cobrir homônimos parciais.
    const r = await call<{ users?: GoTrueUserRaw[] }>(
      "GET",
      `admin/users?filter=${encodeURIComponent(target)}&per_page=200`,
    )
    if (!r.ok || !r.data?.users) return null
    const match = r.data.users.find((u) => u.email?.toLowerCase() === target)
    return match ? normalize(match) : null
  },

  async create(params: {
    email: string
    password: string
    fullName: string
    isMasterGlobal?: boolean
    avatarUrl?: string
  }): Promise<GoTrueUser> {
    const body = {
      email: params.email.toLowerCase().trim(),
      password: params.password,
      email_confirm: true,
      app_metadata: {
        is_master_global: params.isMasterGlobal ?? false,
        full_name: params.fullName,
      },
      user_metadata: params.avatarUrl ? { avatar_url: params.avatarUrl } : {},
    }
    const r = await call<GoTrueUserRaw>("POST", "admin/users", body)
    if (r.ok && r.data?.id) return normalize(r.data)
    // 422 = já registrado → recupera o existente por email
    if (r.status === 422) {
      const existing = await this.findByEmail(params.email)
      if (existing) return existing
    }
    throw new Error(`GoTrue create falhou (status ${r.status})`)
  },

  async listAll(): Promise<GoTrueUser[]> {
    const all: GoTrueUser[] = []
    // Pagina a Admin API (per_page padrão = 50; pedimos 200). Cap defensivo em 50 páginas.
    for (let page = 1; page <= 50; page++) {
      const r = await call<{ users?: GoTrueUserRaw[] }>(
        "GET",
        `admin/users?page=${page}&per_page=200`,
      )
      if (!r.ok || !r.data?.users || r.data.users.length === 0) break
      all.push(...r.data.users.map(normalize))
      if (r.data.users.length < 200) break
    }
    return all
  },

  async update(
    id: string,
    patch: {
      password?: string
      fullName?: string
      isMasterGlobal?: boolean
      avatarUrl?: string
    },
  ): Promise<void> {
    const body: Record<string, unknown> = {}
    if (patch.password !== undefined) body.password = patch.password
    const app: Record<string, unknown> = {}
    if (patch.fullName !== undefined) app.full_name = patch.fullName
    if (patch.isMasterGlobal !== undefined) app.is_master_global = patch.isMasterGlobal
    if (Object.keys(app).length > 0) body.app_metadata = app
    if (patch.avatarUrl !== undefined) body.user_metadata = { avatar_url: patch.avatarUrl }
    if (Object.keys(body).length === 0) return
    const r = await call<GoTrueUserRaw>("PUT", `admin/users/${encodeURIComponent(id)}`, body)
    if (!r.ok) throw new Error(`GoTrue update falhou (status ${r.status})`)
  },
}
