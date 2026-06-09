import { NextResponse } from "next/server"
import { err, ErrorCode } from "./types"
import { env } from "./config"

/**
 * Origens confiáveis do ecossistema Konto (auth, admin, KontoHub, KontoZap),
 * derivadas das URLs públicas configuradas. Valores vazios/ inválidos são ignorados.
 */
function ecosystemOrigins(): Set<string> {
  const set = new Set<string>()
  for (const url of [
    env.NEXT_PUBLIC_AUTH_URL,
    env.NEXT_PUBLIC_ADMIN_URL,
    env.NEXT_PUBLIC_KONTOHUB_URL,
    env.NEXT_PUBLIC_KONTOZAP_URL,
  ]) {
    if (!url) continue
    try {
      set.add(new URL(url).origin)
    } catch {
      // URL malformada na env → ignora
    }
  }
  return set
}

/**
 * Defesa CSRF baseada em Origin para rotas que alteram estado.
 *
 * Contexto: o cookie de sessão é `SameSite=Lax` e compartilhado no domínio-pai,
 * então uma origem same-site indevida poderia disparar requisições autenticadas.
 * Aqui exigimos que o header `Origin` (quando presente) pertença ao ecossistema.
 *
 * - `Origin` ausente → permitido (chamada server-to-server ou navegação top-level
 *   sem CORS; ataques CSRF de browser SEMPRE enviam Origin em requisições cross-origin).
 * - `Origin` presente e fora da allowlist (ecossistema + própria origem) → 403.
 *
 * Retorna a resposta 403 a ser devolvida pela rota, ou `null` para prosseguir.
 * NÃO aplicar a webhooks (autenticados por HMAC, sem Origin de browser).
 */
export function enforceSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin")
  if (!origin) return null

  const allowed = ecosystemOrigins()
  try {
    allowed.add(new URL(request.url).origin)
  } catch {
    // request.url sempre válido em rotas Next; guard defensivo
  }

  if (allowed.has(origin)) return null

  return NextResponse.json(
    err(ErrorCode.FORBIDDEN, "Origem não permitida", 403).error,
    { status: 403 }
  )
}
