import { SignJWT, jwtVerify, type JWTPayload as JosePayload } from "jose"
import { createHash } from "crypto"
import type { JWTPayload } from "@repo/auth-shared"
import { env } from "@repo/auth-shared"

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

export async function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  expiresIn: string
): Promise<string> {
  return new SignJWT({
    tenantId: payload.tenantId,
    role: payload.role,
    isMasterGlobal: payload.isMasterGlobal,
    permissions: payload.permissions,
  } as JosePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      sub: payload.sub!,
      tenantId: payload["tenantId"] as string,
      role: payload["role"] as JWTPayload["role"],
      isMasterGlobal: payload["isMasterGlobal"] as boolean,
      permissions: (payload["permissions"] as JWTPayload["permissions"]) ?? {},
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
