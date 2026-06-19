import { NextRequest, NextResponse } from "next/server"
import { UserRepo, TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { verifyJWT } from "@/lib/jwt"
import { getAccessTokenFromCookies, setAuthCookies } from "@/lib/cookies"
import { createSession } from "@/lib/session"
import { cache } from "@/lib/redis"
import { getSupabaseUserTenantsByGoTrueId, getGoTrueUserById } from "@/lib/supabase-user-tenants"

// POST /api/auth/select-tenant — trocar de tenant após login com múltiplos tenants
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

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

  // payload.sub = GoTrue UUID (pós-P3)
  const neonUser = await UserRepo.findByGoTrueId(payload.sub)
  if (!neonUser) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
  }

  // Verifica acesso via Supabase user_tenants (primário) ou Neon (fallback)
  const supabaseTenants = await getSupabaseUserTenantsByGoTrueId(payload.sub)
  const supabaseTenant = supabaseTenants?.find(t => t.tenantId === tenantId)

  let selectedRole: "admin" | "user"
  let modulos: string[] | undefined

  if (supabaseTenant) {
    if (supabaseTenant.status !== "active") {
      return NextResponse.json(
        err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
        { status: 403 }
      )
    }
    selectedRole = supabaseTenant.role
    modulos = supabaseTenant.modulos
  } else {
    // Fallback Neon: SUPABASE indisponível ou usuário sem GoTrue entry
    const neonTenant = await UserRepo.getUserRoleInTenant(neonUser.id, tenantId)
    if (!neonTenant || neonTenant.status !== "active") {
      return NextResponse.json(
        err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
        { status: 403 }
      )
    }
    selectedRole = neonTenant.role as "admin" | "user"
    modulos = []
  }

  // Verificar status do tenant no cache
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

  // Permissions ficam no Neon user_tenants (não estão no Supabase user_tenants)
  const neonTenantEntry = await UserRepo.getUserRoleInTenant(neonUser.id, tenantId)
  const permissions = (neonTenantEntry?.permissions ?? {}) as Record<string, boolean>

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  // R2: perfil global do GoTrue (primário) → Neon (fallback até o cutover)
  const gtProfile = await getGoTrueUserById(payload.sub)
  const isMasterGlobal = gtProfile?.isMasterGlobal ?? neonUser.isMasterGlobal
  const fullName = gtProfile?.fullName ?? neonUser.fullName

  const { tokens, refreshExpiresAt } = await createSession(
    payload.sub, // GoTrue UUID
    tenantId,
    selectedRole,
    isMasterGlobal,
    permissions,
    {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: ip,
    },
    fullName,
    modulos,
  )

  await AuditRepo.log({
    tenantId,
    userId: payload.sub,
    action: "auth.login",
    targetType: "session",
    targetId: payload.sub,
    metadata: { via: "tenant_switch", ip },
    ipAddress: ip,
  })

  const response = NextResponse.json({ ok: true })
  setAuthCookies(response, tokens, refreshExpiresAt)
  return response
}
