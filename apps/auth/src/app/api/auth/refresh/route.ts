import { NextRequest, NextResponse } from "next/server"
import { RefreshTokenRepo, UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { verifyJWT, hashToken } from "@/lib/jwt"
import { createSession, revokeSession, revokeAllUserSessions } from "@/lib/session"
import { setAuthCookies, clearAuthCookies, getRefreshTokenFromCookies } from "@/lib/cookies"
import { cache } from "@/lib/redis"
import { getSupabaseUserTenantsByGoTrueId } from "@/lib/supabase-user-tenants"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const refreshToken = getRefreshTokenFromCookies(request)

  if (!refreshToken) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Refresh token ausente", 401).error,
      { status: 401 }
    )
  }

  // Verificar JWT
  const payload = await verifyJWT(refreshToken)
  if (!payload) {
    const response = NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Refresh token inválido ou expirado", 401).error,
      { status: 401 }
    )
    clearAuthCookies(response)
    return response
  }

  // Verificar se token está no banco e não foi revogado
  const tokenHash = hashToken(refreshToken)
  const storedToken = await RefreshTokenRepo.findByHash(tokenHash)
  if (!storedToken) {
    // Detecção de reuse: JWT válido + token ausente entre os ativos. Se ele EXISTE
    // mas está revogado, é um refresh já rotacionado sendo reapresentado → possível
    // roubo. Resposta: revoga toda a família de sessões do usuário (mata o atacante).
    const reused = await RefreshTokenRepo.findAnyByHash(tokenHash)
    if (reused) {
      await revokeAllUserSessions(payload.sub)
      await AuditRepo.log({
        userId: payload.sub,
        action: "session.all_revoked",
        targetType: "session",
        targetId: payload.sub,
        metadata: { reason: "refresh_token_reuse" },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      })
    }
    const response = NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Refresh token revogado ou inválido", 401).error,
      { status: 401 }
    )
    clearAuthCookies(response)
    return response
  }

  // Verificar status do tenant (master sem tenant usa sentinela "master")
  if (payload.tenantId && payload.tenantId !== "master") {
    const tenantStatus = await cache.getTenantStatus(payload.tenantId)
    if (tenantStatus === "bloqueado" || tenantStatus === "inativo") {
      await revokeSession(refreshToken)
      const response = NextResponse.json(
        err(ErrorCode.TENANT_BLOCKED, "Empresa bloqueada", 403).error,
        { status: 403 }
      )
      clearAuthCookies(response)
      return response
    }
  }

  // payload.sub é GoTrue UUID desde P3; findByGoTrueId faz o bridge para o Neon user
  const user = await UserRepo.findByGoTrueId(payload.sub)
    ?? await UserRepo.findById(payload.sub) // fallback p/ sessões pré-P3 com Neon UUID
  if (!user) {
    const response = NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
    clearAuthCookies(response)
    return response
  }

  // "master" é sentinela do JWT (master_global sem tenant). Normaliza para
  // undefined ANTES de qualquer consulta por tenant — passar "master" a uma
  // coluna uuid quebra (invalid input syntax for type uuid). Também é o valor
  // passado ao createSession, que persiste tenant_id NULL em vez de violar a FK.
  const sessionTenantId = payload.tenantId === "master" ? undefined : payload.tenantId

  const userTenant = sessionTenantId
    ? await UserRepo.getUserRoleInTenant(user.id, sessionTenantId)
    : null

  // A8: verificar ANTES de revogar — se rejeitar, o cliente mantém o token atual
  if (userTenant && userTenant.status !== "active") {
    const response = NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
      { status: 403 }
    )
    clearAuthCookies(response)
    return response
  }

  // Revogar token atual e emitir novo par (rotation)
  await revokeSession(refreshToken)

  const permissions = (userTenant?.permissions ?? {}) as Record<string, boolean>

  // Re-buscar modulos do Supabase user_tenants para manter claim atualizado na rotação
  const supabaseTenants = user.goTrueId
    ? await getSupabaseUserTenantsByGoTrueId(user.goTrueId)
    : null
  const modulos = supabaseTenants?.find(t => t.tenantId === sessionTenantId)?.modulos

  // sub = payload.sub (GoTrue UUID) — não usar user.id (Neon UUID) aqui
  const { tokens, refreshExpiresAt } = await createSession(
    payload.sub,
    sessionTenantId,
    payload.role,
    user.isMasterGlobal,
    permissions,
    {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        undefined,
    },
    user.fullName,
    modulos,
  )

  const response = NextResponse.json({ ok: true })
  setAuthCookies(response, tokens, refreshExpiresAt)
  return response
}
