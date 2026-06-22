import { NextRequest, NextResponse } from "next/server"
import { AuditRepo } from "@repo/db"
import { verifyJWT } from "@/lib/jwt"
import { revokeSession } from "@/lib/session"
import { clearAuthCookies, getAccessTokenFromCookies, getRefreshTokenFromCookies } from "@/lib/cookies"

/**
 * GET /logout — logout por NAVEGAÇÃO (top-level GET).
 *
 * Usado por links cross-app, como o "Sair" do KontoHub que aponta para
 * `${AUTH_URL}/logout`. O `POST /api/auth/logout` (protegido por same-origin)
 * continua atendendo os forms same-app (portal/admin). Aqui limpamos os cookies,
 * revogamos a sessão e redirecionamos ao /login — sem same-origin, porque é uma
 * navegação de página (não há corpo a falsificar; o pior caso de um GET forjado
 * é deslogar o próprio usuário, risco aceitável para logout).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = getAccessTokenFromCookies(request)
  const refreshToken = getRefreshTokenFromCookies(request)

  // 303 → o browser faz GET em /login após limpar os cookies.
  const response = NextResponse.redirect(new URL("/login", request.url), 303)
  clearAuthCookies(response)

  if (!accessToken && !refreshToken) {
    return response
  }

  const payload = accessToken ? await verifyJWT(accessToken) : null

  if (refreshToken) {
    await revokeSession(refreshToken)
  }

  if (payload) {
    await AuditRepo.log({
      tenantId: !payload.tenantId || payload.tenantId === "master" ? undefined : payload.tenantId,
      userId: payload.sub,
      action: "auth.logout",
      targetType: "session",
      targetId: payload.sub,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    })
  }

  return response
}
