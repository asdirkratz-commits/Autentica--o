/**
 * Supabase Storage via REST (sem @supabase/supabase-js, p/ manter a dep mínima —
 * mesma decisão do supabase-client.ts).
 *
 * Service-role only — server-side. Os arquivos são criptografados (cofre AES-256-GCM)
 * ANTES de chegar aqui. O bucket `hub-documentos` é compartilhado com o KontoHub, que
 * lê os certificados de volta pelo mesmo path.
 */

function getEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias")
  return { url, key }
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/")
}

export const storage = {
  async upload(
    bucket: string,
    path: string,
    data: Uint8Array,
    contentType = "application/octet-stream",
  ): Promise<void> {
    const { url, key } = getEnv()
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodePath(path)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: new Blob([data as BlobPart], { type: contentType }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Storage upload ${bucket}/${path} → ${res.status}: ${text}`)
    }
  },

  async download(bucket: string, path: string): Promise<Uint8Array> {
    const { url, key } = getEnv()
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodePath(path)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Storage download ${bucket}/${path} → ${res.status}: ${text}`)
    }
    return new Uint8Array(await res.arrayBuffer())
  },

  async remove(bucket: string, path: string): Promise<void> {
    const { url, key } = getEnv()
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${encodePath(path)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Storage remove ${bucket}/${path} → ${res.status}: ${text}`)
    }
  },
}
