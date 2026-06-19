import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo, InviteTokenRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { hashToken } from "@/lib/jwt"
import { validatePasswordStrength } from "@/lib/password"
import { updateGoTruePassword } from "@/lib/supabase-user-tenants"

// POST /api/auth/invite — aceitar convite e definir senha
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  let body: { token?: string; password?: string; fullName?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { token, password, fullName } = body

  if (!token || !password) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "token e password são obrigatórios", 400).error,
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

  const tokenHash = hashToken(token)
  const invite = await InviteTokenRepo.findByHash(tokenHash)

  if (!invite) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Convite inválido ou já utilizado", 404).error,
      { status: 404 }
    )
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Convite expirado", 400).error,
      { status: 400 }
    )
  }

  // Identidade no GoTrue (auth.users). Se o usuário não existe, cria com a senha
  // do convite; se já existe, atualiza a senha. user.id = GoTrue UUID.
  let user = await UserRepo.findByEmail(invite.email)

  if (!user) {
    user = await UserRepo.create({
      email: invite.email,
      password,
      fullName: fullName ?? invite.email,
    })
  } else {
    await updateGoTruePassword(user.id, password)
  }

  // Ativar usuário no tenant
  await UserRepo.setUserStatusInTenant(user.id, invite.tenantId, "active")

  // Marcar convite como usado
  await InviteTokenRepo.markUsed(invite.id)

  await AuditRepo.log({
    tenantId: invite.tenantId,
    userId: user.id,
    action: "user.activated",
    targetType: "user",
    targetId: user.id,
    metadata: { via: "invite" },
  })

  return NextResponse.json({ ok: true })
}
