/**
 * Cliente Supabase REST para @repo/db.
 * Usa fetch nativo — sem @supabase/supabase-js para manter a dep mínima.
 * Requer env vars: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

function getEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias")
  return { url, key }
}

function authHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    apikey: key,
    Prefer: "return=representation",
  }
}

async function supabaseRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { url, key } = getEnv()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: authHeaders(key),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`)
  }
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : ([] as unknown as T)
}

export const supabase = {
  from<T = Record<string, unknown>>(table: string) {
    return {
      async insert(row: Partial<T> | Partial<T>[]): Promise<T[]> {
        return supabaseRequest<T[]>("POST", table, row)
      },
      async select(filter = ""): Promise<T[]> {
        const q = filter ? `${table}?${filter}` : table
        return supabaseRequest<T[]>("GET", q)
      },
      async update(filter: string, patch: Partial<T>): Promise<T[]> {
        return supabaseRequest<T[]>("PATCH", `${table}?${filter}`, patch)
      },
      async delete(filter: string): Promise<T[]> {
        return supabaseRequest<T[]>("DELETE", `${table}?${filter}`)
      },
    }
  },
}
