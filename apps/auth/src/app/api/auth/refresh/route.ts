import { NextRequest, NextResponse } from "next/server"
import { RefreshTokenRepo, UserRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { verifyJWT, hashToken } from "@/lib/jwt"
import { createSession, revokeSession } from "@/lib/session"
import { setAuthCookies, clearAuthCookies, getRefreshTokenFromCookies } from "@/lib/cookies"
import { cache } from "@/lib/redis"

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const user = await UserRepo.findById(payload.sub)
  if (!user) {
    const response = NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
    clearAuthCookies(response)
    return response
  }

  // Revogar token atual e emitir novo par (rotation)
  await revokeSession(refreshToken)

  const userTenant = await UserRepo.getUserRoleInTenant(user.id, payload.tenantId)
  const permissions = (userTenant?.permissions ?? {}) as Record<string, boolean>

  const { tokens, refreshExpiresAt } = await createSession(
    user.id,
    payload.tenantId,
    payload.role,
    user.isMasterGlobal,
    permissions,
    {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        undefined,
    }
  )

  const response = NextResponse.json({ ok: true })
  setAuthCookies(response, tokens, refreshExpiresAt)
  return response
}
