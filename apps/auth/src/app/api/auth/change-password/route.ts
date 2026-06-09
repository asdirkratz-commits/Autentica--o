import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { hashPassword, comparePassword, validatePasswordStrength } from "@/lib/password"
import { checkRateLimit } from "@/lib/rate-limit"
import { revokeOtherUserSessions } from "@/lib/session"
import { getRefreshTokenFromCookies } from "@/lib/cookies"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  // Esta rota NÃO é pública (removida de PUBLIC_PREFIXES em SEC-03): o middleware
  // verifica o JWT e injeta x-user-id confiável. A identidade vem daí, não do client.
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")

  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  // Rate limit: 5 tentativas por IP por minuto (bucket próprio, separado do login).
  // Impede usar a verificação de senha atual como oráculo de força-bruta.
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

  // Derruba as DEMAIS sessões do usuário (mantém a atual) — uma senha trocada deve
  // invalidar sessões em outros dispositivos / de eventual atacante.
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
