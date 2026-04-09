import { type NextRequest, NextResponse } from "next/server"
import { verifyJWT } from "@/lib/jwt"
import { getAccessTokenFromCookies } from "@/lib/cookies"
import { TenantRepo, UserRepo } from "@repo/db"
import { cache } from "@/lib/redis"

/**
 * Rotas públicas — sem verificação de JWT.
 */
const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/blocked",
  "/invite",                   // aceite de convite
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/auth/validate",
  "/api/auth/invite",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/webhooks",
  "/api/auth/change-password", // protegido por header x-user-id injetado
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

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-user-id", payload.sub)
  requestHeaders.set("x-user-perms", JSON.stringify(payload.permissions))
  requestHeaders.set("x-master-global", String(payload.isMasterGlobal))

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
  requestHeaders.set("x-user-role", payload.role)

  // ── 4. Status do tenant (Redis → DB como fallback) ────────────────────────
  let tenantStatus = await cache.getTenantStatus(payload.tenantId)

  if (!tenantStatus) {
    const tenant = await TenantRepo.findById(payload.tenantId)
    if (!tenant) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    tenantStatus = tenant.status
    await cache.setTenantStatus(payload.tenantId, tenantStatus)
  }

  if (tenantStatus === "bloqueado") {
    return NextResponse.redirect(new URL("/blocked", request.url))
  }

  if (tenantStatus === "inativo") {
    return new NextResponse("Conta encerrada.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  requestHeaders.set("x-tenant-status", tenantStatus)

  // ── 5. Usuário ativo neste tenant? ────────────────────────────────────────
  const membership = await UserRepo.getUserRoleInTenant(payload.sub, payload.tenantId)
  if (!membership || membership.status !== "active") {
    return new NextResponse("Acesso suspenso nesta empresa.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // ── 6. Injetar headers e prosseguir ──────────────────────────────────────
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
