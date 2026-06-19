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

  // resetToken.userId = GoTrue UUID (pós-P3) ou Neon UUID (tokens emitidos antes da P3)
  // Fazer lookup para obter tanto o Neon id quanto o goTrueId corretamente
  const tokenUserId = resetToken.userId
  const user = await UserRepo.findByGoTrueId(tokenUserId)
    ?? await UserRepo.findById(tokenUserId)

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

  // Revoga sessões — usa GoTrue UUID se disponível (Supabase refresh_tokens), else Neon
  const revokeId = user.goTrueId ?? user.id
  await revokeAllUserSessions(revokeId)

  const auditUserId = user.goTrueId ?? user.id
  await AuditRepo.log({
    userId: auditUserId,
    action: "auth.password_reset_completed",
    targetType: "user",
    targetId: auditUserId,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
