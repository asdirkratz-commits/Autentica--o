import { NextRequest, NextResponse } from "next/server"
import { AuditRepo } from "@repo/db"
import { enforceSameOrigin } from "@repo/auth-shared"
import { verifyJWT } from "@/lib/jwt"
import { revokeSession } from "@/lib/session"
import { clearAuthCookies, getAccessTokenFromCookies, getRefreshTokenFromCookies } from "@/lib/cookies"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const accessToken = getAccessTokenFromCookies(request)
  const refreshToken = getRefreshTokenFromCookies(request)

  // 303 → o browser faz GET em /login após limpar os cookies (funciona tanto p/
  // o form same-origin do auth quanto p/ o form cross-app do admin).
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
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        undefined,
    })
  }

  return response
}
