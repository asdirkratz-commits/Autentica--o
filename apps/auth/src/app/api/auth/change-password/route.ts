import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { hashPassword, validatePasswordStrength } from "@/lib/password"
import { checkRateLimit } from "@/lib/rate-limit"
import { revokeOtherUserSessions } from "@/lib/session"
import { getRefreshTokenFromCookies } from "@/lib/cookies"
import { validateGoTruePassword, updateGoTruePassword } from "@/lib/supabase-user-tenants"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  // userId vem do header injetado pelo middleware (JWT sub = GoTrue UUID desde P3)
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")
  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const { allowed } = await checkRateLimit(ip, "change-password")
  if (!allowed) {
    return NextResponse.json(
      err(ErrorCode.RATE_LIMITED, "Muitas tentativas. Tente novamente em 1 minuto.", 429).error,
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
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

  // userId = GoTrue UUID desde P3; findByGoTrueId é o path principal
  const user = await UserRepo.findByGoTrueId(userId)
    ?? await UserRepo.findById(userId) // fallback sessões pré-P3
  if (!user) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado", 404).error,
      { status: 404 }
    )
  }

  // Valida senha atual via GoTrue (primário) ou bcrypt Neon (fallback)
  const goTrueOk = user.email
    ? (await validateGoTruePassword(user.email, currentPassword)) !== null
    : false

  if (!goTrueOk) {
    // Fallback bcrypt Neon
    const { comparePassword } = await import("@/lib/password")
    const neonOk = await comparePassword(currentPassword, user.passwordHash)
    if (!neonOk) {
      return NextResponse.json(
        err(ErrorCode.INVALID_CREDENTIALS, "Senha atual incorreta", 400).error,
        { status: 400 }
      )
    }
  }

  const newHash = await hashPassword(newPassword)

  if (user.goTrueId) {
    const goTrueOk = await updateGoTruePassword(user.goTrueId, newPassword)
    if (!goTrueOk) console.warn("[change-password] GoTrue sync falhou — Neon atualizado, GoTrue divergente")
  }

  // Atualiza bcrypt Neon usando Neon user.id (não userId que pode ser GoTrue UUID)
  await UserRepo.updatePassword(user.id, newHash)

  // Derruba as outras sessões (userId = sub do JWT, pode ser GoTrue UUID)
  await revokeOtherUserSessions(userId, getRefreshTokenFromCookies(request))

  await AuditRepo.log({
    userId,
    action: "auth.password_changed",
    targetType: "user",
    targetId: userId,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
