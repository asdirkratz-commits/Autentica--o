import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo, PasswordResetRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { hashToken } from "@/lib/jwt"
import { randomBytes } from "crypto"

// POST /api/auth/forgot-password — solicitar reset de senha
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { email } = body

  if (!email) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "email é obrigatório", 400).error,
      { status: 400 }
    )
  }

  // Resposta genérica — não revelar se email existe (evitar enumeração)
  const genericResponse = NextResponse.json({
    ok: true,
    message: "Se o email existir, você receberá as instruções em breve.",
  })

  const user = await UserRepo.findByEmail(email.toLowerCase().trim())
  if (!user) return genericResponse

  // Gerar token seguro
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 horas

  await PasswordResetRepo.create({
    userId: user.id,
    tokenHash,
    expiresAt,
  })

  await AuditRepo.log({
    userId: user.id,
    action: "auth.password_reset_requested",
    targetType: "user",
    targetId: user.id,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined,
  })

  // TODO: Enviar email com link: /reset-password?token=<rawToken>
  // Integrar com provider de email (Resend, SendGrid, etc.)
  // await emailService.sendPasswordReset(user.email, rawToken)

  return genericResponse
}
