import { NextRequest, NextResponse } from "next/server"
import { UserRepo, UserAppAccessRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireActiveTenantMember } from "@/lib/api-guard"
import { validatePasswordStrength } from "@/lib/password"
import type { UserPermissions } from "@repo/auth-shared"

// GET /api/tenant/users — listar usuários do tenant atual (admin+)
export async function GET(): Promise<NextResponse> {
  const guard = await requireActiveTenantMember()
  if (!guard.ok) return guard.response
  const { tenantId, role, isMasterGlobal } = guard.ctx

  if (role !== "admin" && !isMasterGlobal) {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error,
      { status: 403 }
    )
  }

  const rows = await UserRepo.getTenantMembers(tenantId)
  return NextResponse.json({ ok: true, data: rows })
}

// POST /api/tenant/users — cadastro direto de usuário pelo Admin ou Master
// Sem envio de e-mail de convite — o Admin define senha na hora do cadastro.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireActiveTenantMember()
  if (!guard.ok) return guard.response
  const { userId: actorId, tenantId, role: actorRole, isMasterGlobal } = guard.ctx

  if (actorRole !== "admin" && !isMasterGlobal) {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error,
      { status: 403 }
    )
  }

  let body: {
    email?: string
    fullName?: string
    password?: string
    role?: "admin" | "user"
    permissions?: UserPermissions
    appIds?: string[]
  }

  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const {
    email,
    fullName,
    password,
    role: newRole = "user",
    permissions = {},
    appIds = [],
  } = body

  if (!email || !fullName || !password) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "email, fullName e password são obrigatórios", 400).error,
      { status: 400 }
    )
  }

  const strengthCheck = validatePasswordStrength(password)
  if (!strengthCheck.valid) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, strengthCheck.reason, 400).error,
      { status: 400 }
    )
  }

  // Admin só pode criar usuários com role "user"
  if (actorRole === "admin" && newRole === "admin") {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Admin não pode criar outro Admin", 403).error,
      { status: 403 }
    )
  }

  // Verificar se e-mail já existe
  const existing = await UserRepo.findByEmail(email.toLowerCase().trim())
  if (existing) {
    // Verificar se já está vinculado a este tenant
    const existingLink = await UserRepo.getUserRoleInTenant(existing.id, tenantId)
    if (existingLink) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "Usuário já pertence a esta empresa", 400).error,
        { status: 400 }
      )
    }
    // Vincular usuário existente ao tenant (ativa imediatamente)
    await UserRepo.linkToTenant(existing.id, tenantId, newRole, actorId)
    await UserRepo.setUserStatusInTenant(existing.id, tenantId, "active")
    if (Object.keys(permissions).length > 0) {
      await UserRepo.updateUserPermissions(existing.id, tenantId, permissions)
    }
    if (appIds.length > 0) {
      await UserAppAccessRepo.setUserApps(existing.id, tenantId, appIds, actorId)
    }
    await AuditRepo.log({
      tenantId,
      userId: actorId,
      action: "user.created",
      targetType: "user",
      targetId: existing.id,
      metadata: { email, role: newRole, via: "direct_link" },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    })
    return NextResponse.json({ ok: true, data: { userId: existing.id } })
  }

  // Criar novo usuário no GoTrue (identidade canônica) e ativar no tenant.
  // UserRepo.create cria em auth.users via Admin API; newUser.id = GoTrue UUID.
  const newUser = await UserRepo.create({
    email: email.toLowerCase().trim(),
    password,
    fullName,
  })

  await UserRepo.linkToTenant(newUser.id, tenantId, newRole, actorId)
  await UserRepo.setUserStatusInTenant(newUser.id, tenantId, "active")

  if (Object.keys(permissions).length > 0) {
    await UserRepo.updateUserPermissions(newUser.id, tenantId, permissions)
  }

  if (appIds.length > 0) {
    await UserAppAccessRepo.setUserApps(newUser.id, tenantId, appIds, actorId)
  }

  await AuditRepo.log({
    tenantId,
    userId: actorId,
    action: "user.created",
    targetType: "user",
    targetId: newUser.id,
    metadata: { email, role: newRole, via: "direct_registration" },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true, data: { userId: newUser.id } }, { status: 201 })
}
