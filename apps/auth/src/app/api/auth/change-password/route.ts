import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { hashPassword, comparePassword, validatePasswordStrength } from "@/lib/password"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")

  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "currentPassword e newPassword são obrigatórios", 400).error,
      { status: 400 }
    )
  }

  const strengthCheck = validatePasswordStrength(newPassword)
  if (!strengthCheck.valid) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, strengthCheck.reason, 400).error,
      { status: 400 }
    )
  }

  const user = await UserRepo.findById(userId)
  if (!user) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
  }

  const valid = await comparePassword(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json(
      err(ErrorCode.INVALID_CREDENTIALS, "Senha atual incorreta", 400).error,
      { status: 400 }
    )
  }

  const newHash = await hashPassword(newPassword)
  await UserRepo.updatePassword(userId, newHash)

  await AuditRepo.log({
    userId,
    action: "auth.password_reset_completed",
    targetType: "user",
    targetId: userId,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
