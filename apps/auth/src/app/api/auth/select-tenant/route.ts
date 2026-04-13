import { NextRequest, NextResponse } from "next/server"
import { UserRepo, TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { verifyJWT } from "@/lib/jwt"
import { getAccessTokenFromCookies, setAuthCookies } from "@/lib/cookies"
import { createSession } from "@/lib/session"
import { cache } from "@/lib/redis"

// POST /api/auth/select-tenant — trocar de tenant após login com múltiplos tenants
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = getAccessTokenFromCookies(request)
  if (!token) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  const payload = await verifyJWT(token)
  if (!payload) {
    return NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Token inválido", 401).error,
      { status: 401 }
    )
  }

  let body: { tenantId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { tenantId } = body
  if (!tenantId) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "tenantId é obrigatório", 400).error,
      { status: 400 }
    )
  }

  // Verificar se usuário tem acesso ao tenant
  const userTenant = await UserRepo.getUserRoleInTenant(payload.sub, tenantId)
  if (!userTenant || userTenant.status !== "active") {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
      { status: 403 }
    )
  }

  // Verificar status do tenant
  let tenantStatus = await cache.getTenantStatus(tenantId)
  if (!tenantStatus) {
    const tenant = await TenantRepo.findById(tenantId)
    if (!tenant) {
      return NextResponse.json(
        err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
        { status: 404 }
      )
    }
    tenantStatus = tenant.status
    await cache.setTenantStatus(tenantId, tenant.status)
  }

  if (tenantStatus === "bloqueado" || tenantStatus === "inativo") {
    return NextResponse.json(
      err(ErrorCode.TENANT_BLOCKED, "Empresa bloqueada ou inativa", 403).error,
      { status: 403 }
    )
  }

  const user = await UserRepo.findById(payload.sub)
  if (!user) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
  }

  const permissions = (userTenant.permissions ?? {}) as Record<string, boolean>
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  const { tokens, refreshExpiresAt } = await createSession(
    user.id,
    tenantId,
    userTenant.role as "admin" | "user",
    user.isMasterGlobal,
    permissions,
    {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: ip,
    }
  )

  await AuditRepo.log({
    tenantId,
    userId: user.id,
    action: "auth.login",
    targetType: "session",
    targetId: user.id,
    metadata: { via: "tenant_switch", ip },
    ipAddress: ip,
  })

  const response = NextResponse.json({ ok: true })
  setAuthCookies(response, tokens, refreshExpiresAt)
  return response
}
