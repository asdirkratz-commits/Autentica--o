/**
 * Rate limiter — Redis quando disponível, in-memory como fallback.
 * Máximo 5 tentativas por IP por minuto, por ação (login, change-password, ...).
 *
 * Falha do Redis NÃO derruba o login: qualquer erro cai para o contador
 * in-memory (fail-open). O GoTrue mantém o rate-limit upstream como rede de
 * segurança, então o limiter do app é defesa-em-profundidade — indisponibilidade
 * do Redis nunca deve transformar-se em 500 no fluxo de autenticação.
 */
import { env } from "@repo/auth-shared"
import type { Redis as RedisClient } from "ioredis"

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 60

const memoryStore = new Map<string, { count: number; expiresAt: number }>()

// Conexão lazy reutilizada entre invocações warm da lambda (evita
// handshake TLS por request). null quando REDIS_URL não está configurado.
let redisPromise: Promise<RedisClient> | null = null

async function getRedis(): Promise<RedisClient | null> {
  if (!env.REDIS_URL) return null
  if (!redisPromise) {
    redisPromise = import("ioredis").then(
      ({ default: Redis }) =>
        new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
        })
    )
  }
  return redisPromise
}

function incrementMemory(key: string): number {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || now > entry.expiresAt) {
    memoryStore.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 })
    return 1
  }
  entry.count += 1
  return entry.count
}

async function increment(key: string): Promise<number> {
  const redis = await getRedis().catch(() => {
    // Falha ao conectar/instanciar: zera o singleton para tentar reconectar
    // na próxima chamada em vez de ficar preso num promise rejeitado.
    redisPromise = null
    return null
  })
  if (redis) {
    try {
      const current = await redis.incr(key)
      if (current === 1) await redis.expire(key, WINDOW_SECONDS)
      return current
    } catch (e) {
      // Redis indisponível/instável: derruba a conexão para forçar reconexão
      // na próxima tentativa e cai para o contador in-memory (fail-open).
      console.error("[rate-limit] Redis indisponível, usando fallback in-memory:", e)
      redisPromise = null
    }
  }
  return incrementMemory(key)
}

export async function checkRateLimit(
  ip: string,
  action = "login"
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await increment(`rate:${action}:${ip}`)
  return { allowed: current <= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - current) }
}
