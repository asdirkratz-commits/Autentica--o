import { createCacheAgent } from "@repo/auth-shared"
import { env } from "@repo/auth-shared"

// Fallback in-memory quando REDIS_URL não está configurado
function buildNoopRedis() {
  const store = new Map<string, { value: string; expiresAt: number }>()
  return {
    async get(key: string) {
      const entry = store.get(key)
      if (!entry) return null
      if (Date.now() > entry.expiresAt) { store.delete(key); return null }
      return entry.value
    },
    async set(key: string, value: string, _ex: "EX", ttl: number) {
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
    },
    async del(key: string) { store.delete(key) },
  }
}

async function buildRedisClient() {
  if (!env.REDIS_URL) return buildNoopRedis()
  const { default: Redis } = await import("ioredis")
  const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true })
  return client
}

const redisPromise = buildRedisClient()

export const cache = createCacheAgent({
  async get(key: string) { return (await redisPromise).get(key) },
  async set(key: string, value: string, ex: "EX", ttl: number) {
    return (await redisPromise).set(key, value, ex, ttl)
  },
  async del(key: string) { return (await redisPromise).del(key) },
})
