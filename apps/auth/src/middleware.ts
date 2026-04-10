/**
 * Middleware Edge-compatible — apenas verifica JWT.
 *
 * O Edge Runtime do Next.js NÃO suporta ioredis nem postgres (TCP).
 * As verificações que precisam de DB (status do tenant, usuário ativo)
 * são feitas nos layouts Server Component, que rodam em Node.js runtime.
 */
import { type NextRequest, NextResponse } from "next/server"
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
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/auth/validate",
  "/api/auth/invite",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/webhooks",
  "/api/auth/change-password",
]

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // ── Rotas públicas ────────────────────────────────────────────────────────
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ── 1. JWT presente? ──────────────────────────────────────────────────────
  const token = getAccessTokenFromCookies(request)
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // ── 2. JWT válido? ────────────────────────────────────────────────────────
  const payload = await verifyJWT(token)
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", request.url))
    res.cookies.delete("access_token")
    res.cookies.delete("refresh_token")
    return res
  }

  // ── Injetar headers do usuário ────────────────────────────────────────────
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-user-id", payload.sub)
  requestHeaders.set("x-user-perms", JSON.stringify(payload.permissions ?? {}))
  requestHeaders.set("x-master-global", String(payload.isMasterGlobal ?? false))

  // ── /select-tenant: precisa de x-user-id mas sem tenant ainda ────────────
  if (pathname.startsWith("/select-tenant")) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ── 3. tenantId no payload? ───────────────────────────────────────────────
  if (!payload.tenantId) {
    return NextResponse.redirect(
      new URL(`/select-tenant?return_to=${encodeURIComponent(request.url)}`, request.url)
    )
  }

  requestHeaders.set("x-tenant-id", payload.tenantId)
  requestHeaders.set("x-user-role", payload.role ?? "user")

  // Verificações de status do tenant e usuário ficam nos layouts (Node.js runtime)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
