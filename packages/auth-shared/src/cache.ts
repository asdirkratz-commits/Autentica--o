import type { TenantStatus } from "./types"

const TTL_DEFAULT = 300       // 5 minutos — status do tenant
const TTL_USER_APPS = 300     // 5 minutos — apps liberados por usuário

type RedisLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ex: "EX", ttl: number): Promise<unknown>
  del(key: string): Promise<unknown>
}

function tenantKey(tenantId: string): string {
  return `tenant:status:${tenantId}`
}

function userAppsKey(userId: string, tenantId: string): string {
  return `user:apps:${userId}:${tenantId}`
}

export function createCacheAgent(redis: RedisLike) {
  return {
    // ── Status do tenant ───────────────────────────────────────────────────────

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

    // ── Apps liberados por usuário ─────────────────────────────────────────────

    /** Retorna lista de appIds liberados para o usuário, ou null se cache miss */
    async getUserApps(userId: string, tenantId: string): Promise<string[] | null> {
      const value = await redis.get(userAppsKey(userId, tenantId))
      if (!value) return null
      try {
        return JSON.parse(value) as string[]
      } catch {
        return null
      }
    },

    async setUserApps(
      userId: string,
      tenantId: string,
      appIds: string[],
      ttlSeconds = TTL_USER_APPS
    ): Promise<void> {
      await redis.set(userAppsKey(userId, tenantId), JSON.stringify(appIds), "EX", ttlSeconds)
    },

    /** Chamar após grant/revoke de apps para forçar recarga do banco */
    async invalidateUserApps(userId: string, tenantId: string): Promise<void> {
      await redis.del(userAppsKey(userId, tenantId))
    },
  }
}

export type CacheAgent = ReturnType<typeof createCacheAgent>
