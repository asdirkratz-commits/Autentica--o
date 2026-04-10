import { RefreshTokenRepo, UserRepo } from "@repo/db"
import { env } from "@repo/auth-shared"
import type { SessionMeta, TokenPair, JWTPayload, Role } from "@repo/auth-shared"
import { signJWT, hashToken } from "./jwt"

function parseExpiresIn(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn)
  if (!match) throw new Error(`Invalid expiresIn: ${expiresIn}`)
  const [, num, unit] = match
  const n = parseInt(num!, 10)
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  }
  return n * (multipliers[unit!] ?? 0)
}

export async function createSession(
  userId: string,
  tenantId: string | undefined,
  role: Role,
  isMasterGlobal: boolean,
  permissions: JWTPayload["permissions"],
  meta: SessionMeta
): Promise<{ tokens: TokenPair; refreshExpiresAt: Date }> {
  const jwtPayload: Omit<JWTPayload, "iat" | "exp"> = {
    sub: userId,
    tenantId: tenantId ?? "",
    role,
    isMasterGlobal,
    permissions,
  }

  const accessToken = await signJWT(jwtPayload, env.JWT_ACCESS_EXPIRES)
  const refreshToken = await signJWT(jwtPayload, env.JWT_REFRESH_EXPIRES)

  const refreshExpiresSeconds = parseExpiresIn(env.JWT_REFRESH_EXPIRES)
  const refreshExpiresAt = new Date(Date.now() + refreshExpiresSeconds * 1000)

  // Só persiste refresh token quando há tenant válido (FK exige tenant existente no banco)
  if (tenantId) {
    await RefreshTokenRepo.create({
      userId,
      tenantId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    })
  }

  await UserRepo.updateLastLogin(userId)

  return {
    tokens: { accessToken, refreshToken },
    refreshExpiresAt,
  }
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken)
  await RefreshTokenRepo.revoke(hash)
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await RefreshTokenRepo.revokeAllForUser(userId)
}

export async function revokeAllTenantSessions(tenantId: string): Promise<void> {
  await RefreshTokenRepo.revokeAllForTenant(tenantId)
}

export async function cleanExpiredSessions(): Promise<number> {
  return RefreshTokenRepo.deleteExpired()
}
