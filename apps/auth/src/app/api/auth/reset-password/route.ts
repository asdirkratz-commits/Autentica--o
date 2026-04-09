import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo, PasswordResetRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { hashToken } from "@/lib/jwt"
import { hashPassword, validatePasswordStrength } from "@/lib/password"

// POST /api/auth/reset-password — redefinir senha com token
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const passwordHash = await hashPassword(password)
  await UserRepo.updatePassword(resetToken.userId, passwordHash)
  await PasswordResetRepo.markUsed(resetToken.id)

  await AuditRepo.log({
    userId: resetToken.userId,
    action: "auth.password_reset_completed",
    targetType: "user",
    targetId: resetToken.userId,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined,
  })

  return NextResponse.json({ ok: true })
}
