import Redis from "ioredis"
import { createCacheAgent } from "@repo/auth-shared"

let redisInstance: Redis | null = null

function getRedis(): Redis {
  if (!redisInstance) {
    const url = process.env.REDIS_URL
    if (!url) throw new Error("REDIS_URL não configurado")
    redisInstance = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  }
  return redisInstance
}

export const cache = createCacheAgent(getRedis())
