/**
 * Middleware Edge-compatible — apenas verifica JWT.
 *
 * O Edge Runtime do Next.js NÃO suporta ioredis nem postgres (TCP).
 * As verificações que precisam de DB (status do tenant, usuário ativo)
 * são feitas nos layouts Server Component, que rodam em Node.js runtime.
 */
import { type NextRequest, NextResponse } from "next/server"
import { stripIdentityHeaders, generateCspNonce, buildCsp } from "@repo/auth-shared"
import { verifyJWT } from "@/lib/jwt"
import { getAccessTokenFromCookies } from "@/lib/cookies"

const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/blocked",
  "/invite",
  "/logout",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/auth/validate",
  "/api/auth/invite",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/webhooks",
]

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Base confiável: apaga qualquer header de identidade forjado pelo cliente
  // ANTES de qualquer retorno. Vale para TODOS os caminhos, inclusive públicos.
  const safeHeaders = stripIdentityHeaders(request.headers)

  // ── CSP por requisição (F-09): nonce + strict-dynamic em prod; permissivo em dev ──
  const nonce = process.env.NODE_ENV === "production" ? generateCspNonce() : null
  const csp = buildCsp(nonce)
  // Nunca confiar em CSP/nonce vindos do cliente (em qualquer modo).
  safeHeaders.delete("x-nonce")
  safeHeaders.delete("content-security-policy")
  if (nonce) {
    // Next lê o header da REQUISIÇÃO p/ aplicar o nonce nos seus <script>.
    safeHeaders.set("x-nonce", nonce)
    safeHeaders.set("content-security-policy", csp)
  }
  const withCsp = (res: NextResponse): NextResponse => {
    res.headers.set("Content-Security-Policy", csp)
    return res
  }

  // ── Rotas públicas ────────────────────────────────────────────────────────
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return withCsp(NextResponse.next({ request: { headers: safeHeaders } }))
  }

  // ── 1. JWT presente? (cookie do browser OU Bearer server-to-server) ───────
  // Chamadas S2S (ex.: BFF do KontoHub) não têm o cookie de sessão; aceitam o
  // MESMO JWT via Authorization: Bearer. Sem cookie ambiente ⇒ sem vetor CSRF
  // (o enforceSameOrigin das rotas já libera requisições sem header Origin).
  const bearer = request.headers.get("authorization")
  const token =
    getAccessTokenFromCookies(request) ??
    (bearer && bearer.toLowerCase().startsWith("bearer ")
      ? bearer.slice(7).trim()
      : null)
  if (!token) {
    return withCsp(NextResponse.redirect(new URL("/login", request.url)))
  }

  // ── 2. JWT válido? ────────────────────────────────────────────────────────
  const payload = await verifyJWT(token)
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", request.url))
    res.cookies.delete("access_token")
    res.cookies.delete("refresh_token")
    return withCsp(res)
  }

  // ── Injetar headers do usuário (sobre a base já sanitizada) ───────────────
  const requestHeaders = safeHeaders
  requestHeaders.set("x-user-id", payload.sub)
  requestHeaders.set("x-user-perms", JSON.stringify(payload.permissions ?? {}))
  requestHeaders.set("x-master-global", String(payload.isMasterGlobal ?? false))
  if (payload.nome) requestHeaders.set("x-user-nome", payload.nome)

  // ── /select-tenant: precisa de x-user-id mas sem tenant ainda ────────────
  if (pathname.startsWith("/select-tenant")) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  // ── Troca de senha: self-service e tenant-agnóstica — basta identidade ────
  // verificada (não exigir tenant selecionado, senão a rota redireciona p/ 307).
  if (pathname.startsWith("/api/auth/change-password")) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  // ── 3. tenantId no payload? ───────────────────────────────────────────────
  // master_global pode navegar sem tenant selecionado
  if (!payload.tenantId && !payload.isMasterGlobal) {
    return withCsp(NextResponse.redirect(
      new URL(`/select-tenant?return_to=${encodeURIComponent(request.url)}`, request.url)
    ))
  }

  requestHeaders.set("x-tenant-id", payload.tenantId)
  requestHeaders.set("x-user-role", payload.role ?? "user")

  // Verificações de status do tenant e usuário ficam nos layouts (Node.js runtime)
  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }))
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|otf|css|js)).*)"],
}
