import type { TenantStatus } from "./types.js"

const TTL_DEFAULT = 300 // 5 minutes

type RedisLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ex: "EX", ttl: number): Promise<unknown>
  del(key: string): Promise<unknown>
}

function tenantKey(tenantId: string): string {
  return `tenant:status:${tenantId}`
}

export function createCacheAgent(redis: RedisLike) {
  return {
    async getTenantStatus(tenantId: string): Promise<TenantStatus | null> {
      const value = await redis.get(tenantKey(tenantId))
      if (!value) return null
      return value as TenantStatus
    },

    async setTenantStatus(
      tenantId: string,
      status: TenantStatus,
      ttlSeconds = TTL_DEFAULT
    ): Promise<void> {
      await redis.set(tenantKey(tenantId), status, "EX", ttlSeconds)
    },

    async invalidateTenantStatus(tenantId: string): Promise<void> {
      await redis.del(tenantKey(tenantId))
    },
  }
}

export type CacheAgent = ReturnType<typeof createCacheAgent>
