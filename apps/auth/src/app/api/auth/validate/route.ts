import { NextRequest, NextResponse } from "next/server"
import { UserRepo, TenantRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { verifyJWT } from "@/lib/jwt"
import { getAccessTokenFromCookies } from "@/lib/cookies"
import { cache } from "@/lib/redis"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = getAccessTokenFromCookies(request)

  if (!token) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Token ausente", 401).error,
      { status: 401 }
    )
  }

  const payload = await verifyJWT(token)
  if (!payload) {
    return NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Token inválido ou expirado", 401).error,
      { status: 401 }
    )
  }

  // Verificar status do tenant em tempo real
  let tenantStatus = null
  if (payload.tenantId !== "master") {
    tenantStatus = await cache.getTenantStatus(payload.tenantId)

    if (!tenantStatus) {
      // Cache miss — buscar do banco
      const tenant = await TenantRepo.findById(payload.tenantId)
      if (tenant) {
        tenantStatus = tenant.status
        await cache.setTenantStatus(payload.tenantId, tenant.status)
      }
    }

    if (tenantStatus === "bloqueado" || tenantStatus === "inativo") {
      return NextResponse.json(
        err(ErrorCode.TENANT_BLOCKED, "Empresa bloqueada ou inativa", 403).error,
        { status: 403 }
      )
    }

    // is_master_global verificado SEMPRE na tabela users — nunca no JWT
    const user = await UserRepo.findById(payload.sub)
    if (!user) {
      return NextResponse.json(
        err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isMasterGlobal: user.isMasterGlobal,
        avatarUrl: user.avatarUrl,
      },
      session: {
        tenantId: payload.tenantId,
        role: payload.role,
        permissions: payload.permissions,
        tenantStatus,
      },
    })
  }

  const user = await UserRepo.findById(payload.sub)
  if (!user) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isMasterGlobal: user.isMasterGlobal,
      avatarUrl: user.avatarUrl,
    },
    session: {
      tenantId: payload.tenantId,
      role: payload.role,
      permissions: payload.permissions,
      tenantStatus: null,
    },
  })
}
