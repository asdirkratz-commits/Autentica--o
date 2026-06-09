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

// Proxy preguiçoso: `createCacheAgent` apenas guarda a referência e só chama
// métodos do Redis em tempo de requisição. Resolver `getRedis()` no acesso a
// cada método (e não no import) evita que `next build` — que importa as rotas
// para coletar dados de página — exploda quando REDIS_URL não está definido.
// A conexão real (lazyConnect) só ocorre no primeiro uso, já em runtime.
const lazyRedis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis()
    const value = client[prop as keyof Redis]
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value
  },
})

export const cache = createCacheAgent(lazyRedis)
