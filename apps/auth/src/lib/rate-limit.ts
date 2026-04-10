/**
 * Rate limiter — Redis quando disponível, in-memory como fallback.
 * Máximo 5 tentativas por IP por minuto em /api/auth/login.
 */
import { env } from "@repo/auth-shared"

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 60

const memoryStore = new Map<string, { count: number; expiresAt: number }>()

async function increment(key: string): Promise<number> {
  if (env.REDIS_URL) {
    const { default: Redis } = await import("ioredis")
    const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 })
    const current = await redis.incr(key)
    if (current === 1) await redis.expire(key, WINDOW_SECONDS)
    await redis.quit()
    return current
  }

  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || now > entry.expiresAt) {
    memoryStore.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 })
    return 1
  }
  entry.count += 1
  return entry.count
}

export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await increment(`rate:login:${ip}`)
  return { allowed: current <= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - current) }
}
