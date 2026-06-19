import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo, TenantRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { hashPassword } from "@/lib/password"
import { createSession } from "@/lib/session"
import { setAuthCookies } from "@/lib/cookies"
import { checkRateLimit } from "@/lib/rate-limit"
import { cache } from "@/lib/redis"
import {
  validateGoTruePassword,
  getSupabaseUserTenantsByGoTrueId,
  getGoTrueUserById,
} from "@/lib/supabase-user-tenants"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"

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

  // ── Localizar usuário no Neon (identity source) ──────────────────────────
  const neonUser = await UserRepo.findByEmail(email.toLowerCase().trim())
  if (!neonUser) {
    await hashPassword(password) // equaliza tempo, evita enumeração
    await AuditRepo.log({
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

  // ── Validação de senha: GoTrue (único validador desde P6) ───────────────
  // JWT sub = GoTrue UUID. Neon continua como fonte de isMasterGlobal/fullName.
  const goTrueId = await validateGoTruePassword(email.toLowerCase().trim(), password)
  if (!goTrueId) {
    await AuditRepo.log({
      userId: neonUser.goTrueId ?? neonUser.id,
      action: "auth.login_failed",
      targetType: "user",
      targetId: neonUser.goTrueId ?? neonUser.id,
      metadata: { reason: "wrong_password", ip },
      ipAddress: ip,
    })
    return NextResponse.json(
      err(ErrorCode.INVALID_CREDENTIALS, "Credenciais inválidas", 401).error,
      { status: 401 }
    )
  }
  const jwtSub = goTrueId

  // ── Perfil global: GoTrue (primário) → Neon users (fallback até o cutover) ──
  // R2: is_master_global/full_name passam a vir do GoTrue app_metadata. O Neon
  // continua como rede de segurança enquanto não for decomissionado (R4).
  const gtProfile = await getGoTrueUserById(jwtSub)
  const isMasterGlobal = gtProfile?.isMasterGlobal ?? neonUser.isMasterGlobal
  const fullName = gtProfile?.fullName ?? neonUser.fullName

  // ── Determinar tenant + modulos ──────────────────────────────────────────
  type TenantEntry = { tenantId: string; role: string; status: string; permissions: Record<string, boolean>; modulos: string[] }

  let allTenants: TenantEntry[]
  const supabaseTenants = await getSupabaseUserTenantsByGoTrueId(jwtSub)
  if (supabaseTenants) {
    allTenants = supabaseTenants.map(t => ({
      tenantId: t.tenantId,
      role: t.role,
      status: t.status,
      permissions: t.permissions,
      modulos: t.modulos,
    }))
  } else {
    // Fallback Neon user_tenants (sem modulos)
    const neonTenants = await UserRepo.getUserTenants(neonUser.id)
    allTenants = neonTenants.map(t => ({
      tenantId: t.tenantId,
      role: t.role,
      status: t.status === "active" ? "active" : "inactive",
      permissions: (t.permissions ?? {}) as Record<string, boolean>,
      modulos: [],
    }))
    if (!isMasterGlobal && neonTenants.length > 0) {
      console.warn('[login] modulos=[]: fallback Neon — SUPABASE env ausente ou usuário sem GoTrue entry')
    }
  }

  const activeTenants = allTenants.filter(ut => ut.status === "active")

  let selectedTenantId = tenantId
  let selectedRole: "admin" | "user" = "user"

  if (!selectedTenantId) {
    if (activeTenants.length === 1 && activeTenants[0]) {
      selectedTenantId = activeTenants[0].tenantId
      selectedRole = activeTenants[0].role as typeof selectedRole
    } else if (activeTenants.length > 1) {
      const tenantDetails = await Promise.all(
        activeTenants.map(async (ut) => {
          const tenant = await TenantRepo.findById(ut.tenantId)
          return {
            tenantId: ut.tenantId,
            role: ut.role,
            name: tenant?.name ?? ut.tenantId,
            slug: tenant?.slug ?? "",
          }
        })
      )
      return NextResponse.json({
        requiresTenantSelection: true,
        tenants: tenantDetails,
      })
    } else if (isMasterGlobal) {
      selectedTenantId = undefined
    } else {
      return NextResponse.json(
        err(ErrorCode.FORBIDDEN, "Usuário sem empresa ativa", 403).error,
        { status: 403 }
      )
    }
  } else {
    const ut = allTenants.find(t => t.tenantId === selectedTenantId)
    if (!ut || ut.status !== "active") {
      return NextResponse.json(
        err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
        { status: 403 }
      )
    }
    selectedRole = ut.role as typeof selectedRole
  }

  if (selectedTenantId) {
    const tenantStatus = await cache.getTenantStatus(selectedTenantId)
    if (tenantStatus === "bloqueado" || tenantStatus === "inativo") {
      return NextResponse.json(
        err(ErrorCode.TENANT_BLOCKED, "Empresa bloqueada ou inativa", 403).error,
        { status: 403 }
      )
    }
  }

  const selectedTenantEntry = allTenants.find(ut => ut.tenantId === selectedTenantId)
  const permissions = selectedTenantEntry?.permissions ?? {}
  const modulos = selectedTenantEntry?.modulos

  const { tokens, refreshExpiresAt } = await createSession(
    jwtSub,
    selectedTenantId,
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
    tenantId: !selectedTenantId || selectedTenantId === "master" ? undefined : selectedTenantId,
    userId: jwtSub,
    action: "auth.login",
    targetType: "session",
    targetId: jwtSub,
    metadata: { ip },
    ipAddress: ip,
  })

  const response = NextResponse.json({ ok: true })
  setAuthCookies(response, tokens, refreshExpiresAt)
  return response
}
