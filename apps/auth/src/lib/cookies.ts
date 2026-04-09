import type { NextResponse, NextRequest } from "next/server"
import type { TokenPair } from "@repo/auth-shared"
import { env } from "@repo/auth-shared"

const ACCESS_TOKEN_COOKIE = "access_token"
const REFRESH_TOKEN_COOKIE = "refresh_token"

function cookieConfig() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  }
}

export function setAuthCookies(
  response: NextResponse,
  tokens: TokenPair,
  refreshExpiresAt: Date
): void {
  const base = cookieConfig()

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: 15 * 60, // 15 min
  })

  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: Math.floor((refreshExpiresAt.getTime() - Date.now()) / 1000),
  })
}

export function clearAuthCookies(response: NextResponse): void {
  const base = cookieConfig()
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...base, maxAge: 0 })
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...base, maxAge: 0 })
}

export function getAccessTokenFromCookies(
  request: NextRequest
): string | undefined {
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
}

export function getRefreshTokenFromCookies(
  request: NextRequest
): string | undefined {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
}
