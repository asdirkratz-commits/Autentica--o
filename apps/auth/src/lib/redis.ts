import Redis from "ioredis"
import { createCacheAgent } from "@repo/auth-shared"
import { env } from "@repo/auth-shared"

let redisInstance: Redis | null = null

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  }
  return redisInstance
}

export const cache = createCacheAgent(getRedis())
