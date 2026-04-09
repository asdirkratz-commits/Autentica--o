/**
 * Middleware SSO reutilizável — copiar para middleware.ts de cada app.
 *
 * Hierarquia de verificação (TOP-DOWN — não alterar a ordem):
 * 1. JWT presente e válido?                → não: redirect /login
 * 2. Tenant no payload existe?             → não: redirect /login
 * 3. Tenant status = "bloqueado"?          → sim: HTTP 403 página estática
 * 4. Tenant status = "inativo"?            → sim: HTTP 403 página encerramento
 * 5. Tenant status = "inadimplente"?       → sim: injetar header x-tenant-warning
 * 6. Usuário status neste tenant = ativo?  → não: HTTP 403 "acesso suspenso"
 * 7. Usuário tem acesso ao app atual?      → não: HTTP 403 "app não disponível"
 * 8. Tudo ok: injetar headers e prosseguir
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import type { JWTPayload, TenantStatus } from "./types.js"

export type MiddlewareConfig = {
  /**
   * Verifica e decodifica o access token do cookie.
   * Retorna null se inválido ou ausente.
   */
  verifyToken(token: string): Promise<JWTPayload | null>

  /**
   * Obtém o status do tenant (Redis primeiro, banco como fallback).
   */
  getTenantStatus(tenantId: string): Promise<TenantStatus | null>

  /**
   * Verifica se o usuário está ativo no tenant.
   */
  getUserStatusInTenant(
    userId: string,
    tenantId: string
  ): Promise<"active" | "inactive" | "pending" | null>

  /**
   * Verifica se o tenant tem assinatura ativa para o app atual.
   */
  hasAppAccess(tenantId: string, appName: string): Promise<boolean>

  /**
   * Nome do app atual (ex: "kontohub", "admin").
   */
  appName: string

  /**
   * URL base do auth service para redirect de login.
   */
  authUrl: string

  /**
   * Nome do cookie que carrega o access token.
   */
  cookieName?: string
}

export function createMiddleware(config: MiddlewareConfig) {
  const cookieName = config.cookieName ?? "access_token"

  return async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl

    // Rotas públicas — não proteger
    const publicPaths = ["/blocked", "/favicon.ico", "/_next", "/api/auth/validate"]
    if (publicPaths.some((p) => pathname.startsWith(p))) {
      return NextResponse.next()
    }

    // ── 1. JWT presente e válido? ──────────────────────────────────────────────
    const token = request.cookies.get(cookieName)?.value
    if (!token) {
      return redirectToLogin(request, config.authUrl)
    }

    const payload = await config.verifyToken(token)
    if (!payload) {
      return redirectToLogin(request, config.authUrl)
    }

    // ── 2. Tenant no payload existe? ──────────────────────────────────────────
    if (!payload.tenantId) {
      return redirectToLogin(request, config.authUrl)
    }

    // ── 3 & 4. Status do tenant ───────────────────────────────────────────────
    const tenantStatus = await config.getTenantStatus(payload.tenantId)
    if (!tenantStatus) {
      return redirectToLogin(request, config.authUrl)
    }

    if (tenantStatus === "bloqueado") {
      return NextResponse.redirect(new URL("/blocked", request.url), {
        status: 302,
      })
    }

    if (tenantStatus === "inativo") {
      return new NextResponse("Conta encerrada", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }

    // ── 5. Tenant inadimplente → injetar warning ──────────────────────────────
    const requestHeaders = new Headers(request.headers)
    if (tenantStatus === "inadimplente") {
      requestHeaders.set("x-tenant-warning", "inadimplente")
    }

    // ── 6. Usuário ativo neste tenant? ────────────────────────────────────────
    const userStatus = await config.getUserStatusInTenant(
      payload.sub,
      payload.tenantId
    )
    if (userStatus !== "active") {
      return new NextResponse("Acesso suspenso", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }

    // ── 7. App disponível para o tenant? ──────────────────────────────────────
    if (config.appName !== "auth" && config.appName !== "admin") {
      const hasAccess = await config.hasAppAccess(
        payload.tenantId,
        config.appName
      )
      if (!hasAccess) {
        return new NextResponse("App não disponível para este plano", {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      }
    }

    // ── 8. Injetar headers e prosseguir ───────────────────────────────────────
    requestHeaders.set("x-user-id", payload.sub)
    requestHeaders.set("x-tenant-id", payload.tenantId)
    requestHeaders.set("x-user-role", payload.role)
    requestHeaders.set("x-tenant-status", tenantStatus)
    requestHeaders.set("x-user-perms", JSON.stringify(payload.permissions))

    return NextResponse.next({ request: { headers: requestHeaders } })
  }
}

function redirectToLogin(request: NextRequest, authUrl: string): NextResponse {
  const loginUrl = new URL("/login", authUrl)
  loginUrl.searchParams.set("return_to", request.url)
  return NextResponse.redirect(loginUrl)
}
