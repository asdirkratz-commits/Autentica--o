/**
 * Headers de identidade — confiáveis SOMENTE quando setados pelo middleware
 * APÓS verificar o JWT. Qualquer valor que chega na requisição original é
 * potencial spoof do cliente e DEVE ser apagado antes de o middleware setar
 * os valores confiáveis.
 *
 * Edge-safe: zero dependências de Node (usado pelos middlewares Edge de auth e admin).
 */
export const IDENTITY_HEADERS = [
  "x-user-id",
  "x-user-perms",
  "x-user-role",
  "x-user-nome",
  "x-master-global",
  "x-tenant-id",
  "x-tenant-status",
  "x-tenant-warning",
] as const

/**
 * Retorna uma cópia dos headers da requisição com TODOS os headers de
 * identidade apagados. Use como base antes de setar os headers confiáveis
 * derivados do JWT verificado — em TODOS os caminhos, inclusive rotas públicas.
 */
export function stripIdentityHeaders(incoming: Headers): Headers {
  const headers = new Headers(incoming)
  for (const name of IDENTITY_HEADERS) {
    headers.delete(name)
  }
  return headers
}
