import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { UserRepo, InviteTokenRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { randomBytes } from "crypto"
import { hashToken } from "@/lib/jwt"
import type { UserPermissions } from "@repo/auth-shared"

// GET /api/tenant/users — listar usuários do tenant atual
export async function GET(): Promise<NextResponse> {
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")
  const role = hdrs.get("x-user-role")

  if (!userId || !tenantId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error,
      { status: 403 }
    )
  }

  const rows = await UserRepo.getTenantMembers(tenantId)

  return NextResponse.json({ ok: true, data: rows })
}

// POST /api/tenant/users — convidar usuário para o tenant
export async function POST(request: NextRequest): Promise<NextResponse> {
  const hdrs = await headers()
  const actorId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")
  const role = hdrs.get("x-user-role")

  if (!actorId || !tenantId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error,
      { status: 403 }
    )
  }

  let body: {
    email?: string
    role?: "admin" | "user"
    permissions?: UserPermissions
  }

  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { email, role: inviteRole = "user", permissions = {} } = body

  if (!email) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "email é obrigatório", 400).error,
      { status: 400 }
    )
  }

  // Verificar se usuário já existe
  let targetUser = await UserRepo.findByEmail(email)

  if (targetUser) {
    // Verificar se já está no tenant
    const existing = await UserRepo.getUserRoleInTenant(targetUser.id, tenantId)
    if (existing) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "Usuário já pertence a este tenant", 400).error,
        { status: 400 }
      )
    }
    // Vincular ao tenant como pending
    await UserRepo.linkToTenant(targetUser.id, tenantId, inviteRole, actorId)
  } else {
    // Criar usuário temporário — senha será definida no aceite do convite
    targetUser = await UserRepo.create({
      email,
      passwordHash: "", // será definido no aceite
      fullName: email,
    })
    await UserRepo.linkToTenant(targetUser.id, tenantId, inviteRole, actorId)
    if (Object.keys(permissions).length > 0) {
      await UserRepo.updateUserPermissions(targetUser.id, tenantId, permissions)
    }
  }

  // Criar token de convite (expira em 48h)
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await InviteTokenRepo.create({
    email,
    tenantId,
    role: inviteRole,
    permissions,
    invitedBy: actorId,
    tokenHash,
    expiresAt,
  })

  await AuditRepo.log({
    tenantId,
    userId: actorId,
    action: "user.invited",
    targetType: "user",
    targetId: targetUser.id,
    metadata: { email, role: inviteRole },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  })

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"
  const inviteLink = `${authUrl}/invite?token=${rawToken}`

  return NextResponse.json({ ok: true, data: { inviteLink, expiresAt } })
}
