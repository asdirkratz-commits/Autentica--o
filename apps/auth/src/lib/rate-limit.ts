/**
 * Rate limiter simples em Redis.
 * Máximo 5 tentativas por IP por minuto em /api/auth/login.
 */
import Redis from "ioredis"
import { env } from "@repo/auth-shared"

let redisInstance: Redis | null = null

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 })
  }
  return redisInstance
}

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 60

export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate:login:${ip}`
  const redis = getRedis()

  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, WINDOW_SECONDS)
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - current)
  return { allowed: current <= MAX_ATTEMPTS, remaining }
}
