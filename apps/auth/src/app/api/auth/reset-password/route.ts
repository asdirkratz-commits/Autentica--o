import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo, PasswordResetRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { hashToken } from "@/lib/jwt"
import { hashPassword, validatePasswordStrength } from "@/lib/password"
import { revokeAllUserSessions } from "@/lib/session"
import { updateGoTruePassword } from "@/lib/supabase-user-tenants"

// POST /api/auth/reset-password — redefinir senha com token
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  let body: { token?: string; password?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { token, password } = body
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
  const resetToken = await PasswordResetRepo.findByHash(tokenHash)
  if (!resetToken) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Token inválido ou já utilizado", 404).error,
      { status: 404 }
    )
  }

  if (resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Token expirado", 400).error,
      { status: 400 }
    )
  }

  // resetToken.userId = GoTrue UUID (pós-P3); tokens pré-P3 já expiraram
  const user = await UserRepo.findByGoTrueId(resetToken.userId)

  if (!user) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
  }

  const newHash = await hashPassword(password)

  if (user.goTrueId) {
    const goTrueOk = await updateGoTruePassword(user.goTrueId, password)
    if (!goTrueOk) console.warn("[reset-password] GoTrue sync falhou — Neon atualizado, GoTrue divergente")
  }

  // Atualiza bcrypt Neon (usa Neon user.id)
  await UserRepo.updatePassword(user.id, newHash)

  await PasswordResetRepo.markUsed(resetToken.id)

  // user.goTrueId sempre presente desde P6 (todos migrados)
  await revokeAllUserSessions(user.goTrueId ?? user.id)

  await AuditRepo.log({
    userId: user.goTrueId ?? user.id,
    action: "auth.password_reset_completed",
    targetType: "user",
    targetId: user.goTrueId ?? user.id,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
