import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { comparePassword } from "@/lib/password"
import { createSession } from "@/lib/session"
import { setAuthCookies } from "@/lib/cookies"
import { checkRateLimit } from "@/lib/rate-limit"
import { cache } from "@/lib/redis"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"

  // Rate limiting: 5 tentativas por IP por minuto
  const { allowed } = await checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      err(ErrorCode.RATE_LIMITED, "Muitas tentativas. Tente novamente em 1 minuto.", 429).error,
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    )
  }

  let body: { email?: string; password?: string; tenantId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { email, password, tenantId } = body

  if (!email || !password) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "email e password são obrigatórios", 400).error,
      { status: 400 }
    )
  }

  const user = await UserRepo.findByEmail(email.toLowerCase().trim())

  if (!user) {
    await AuditRepo.log({
      userId: "00000000-0000-0000-0000-000000000000",
      action: "auth.login_failed",
      targetType: "user",
      targetId: email,
      metadata: { reason: "user_not_found", ip },
      ipAddress: ip,
    })
    return NextResponse.json(
      err(ErrorCode.INVALID_CREDENTIALS, "Credenciais inválidas", 401).error,
      { status: 401 }
    )
  }

  const passwordOk = await comparePassword(password, user.passwordHash)
  if (!passwordOk) {
    await AuditRepo.log({
      userId: user.id,
      action: "auth.login_failed",
      targetType: "user",
      targetId: user.id,
      metadata: { reason: "wrong_password", ip },
      ipAddress: ip,
    })
    return NextResponse.json(
      err(ErrorCode.INVALID_CREDENTIALS, "Credenciais inválidas", 401).error,
      { status: 401 }
    )
  }

  // Determinar tenant
  const userTenants = await UserRepo.getUserTenants(user.id)
  const activeTenants = userTenants.filter((ut) => ut.status === "active")

  let selectedTenantId = tenantId
  let selectedRole: "owner" | "admin" | "user" = "user"

  if (!selectedTenantId) {
    if (activeTenants.length === 1 && activeTenants[0]) {
      selectedTenantId = activeTenants[0].tenantId
      selectedRole = activeTenants[0].role as typeof selectedRole
    } else if (activeTenants.length > 1) {
      // Múltiplos tenants — retornar lista para seleção
      return NextResponse.json({
        requiresTenantSelection: true,
        tenants: activeTenants.map((ut) => ({
          tenantId: ut.tenantId,
          role: ut.role,
        })),
      })
    } else if (user.isMasterGlobal) {
      // master_global sem tenant — selectedTenantId fica undefined (sem FK no banco)
      selectedTenantId = undefined
    } else {
      return NextResponse.json(
        err(ErrorCode.FORBIDDEN, "Usuário sem empresa ativa", 403).error,
        { status: 403 }
      )
    }
  } else {
    const ut = userTenants.find((t) => t.tenantId === selectedTenantId)
    if (!ut || ut.status !== "active") {
      return NextResponse.json(
        err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
        { status: 403 }
      )
    }
    selectedRole = ut.role as typeof selectedRole
  }

  // Verificar status do tenant no cache (apenas se tem tenant)
  if (selectedTenantId) {
    const tenantStatus = await cache.getTenantStatus(selectedTenantId)
    if (tenantStatus === "bloqueado" || tenantStatus === "inativo") {
      return NextResponse.json(
        err(ErrorCode.TENANT_BLOCKED, "Empresa bloqueada ou inativa", 403).error,
        { status: 403 }
      )
    }
  }

  const userTenant = userTenants.find((ut) => ut.tenantId === selectedTenantId)
  const permissions = (userTenant?.permissions ?? {}) as Record<string, boolean>

  const { tokens, refreshExpiresAt } = await createSession(
    user.id,
    selectedTenantId,
    selectedRole,
    user.isMasterGlobal,
    permissions,
    {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: ip,
    }
  )

  await AuditRepo.log({
    tenantId: selectedTenantId === "master" ? undefined : selectedTenantId,
    userId: user.id,
    action: "auth.login",
    targetType: "session",
    targetId: user.id,
    metadata: { ip },
    ipAddress: ip,
  })

  const response = NextResponse.json({ ok: true })
  setAuthCookies(response, tokens, refreshExpiresAt)
  return response
}
