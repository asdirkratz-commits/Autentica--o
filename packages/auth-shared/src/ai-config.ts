/**
 * Gerenciamento das configurações de IA por tenant.
 *
 * Regras de segurança:
 * - Chaves NUNCA são retornadas ao front-end em texto claro
 * - Armazenadas criptografadas (AES-256-GCM) na coluna ai_config
 * - Descriptografadas apenas no momento do uso (Server Side / API route)
 */

import { encrypt, decrypt } from "./crypto"

export type AiProvider = "openai" | "gemini" | "claude"

export type AiProviderEntry = {
  keyEncrypted: string   // resultado de encrypt(apiKey, AI_ENCRYPTION_KEY)
  enabled: boolean
}

export type AiConfig = {
  activeProvider: AiProvider
  providers: Partial<Record<AiProvider, AiProviderEntry>>
}

/** Estrutura retornada ao front-end — sem as chaves reais */
export type AiConfigPublic = {
  activeProvider: AiProvider
  providers: Partial<Record<AiProvider, { hasKey: boolean; enabled: boolean }>>
}

/**
 * Serializa e criptografa a configuração de IA para salvar no banco.
 * A chave de criptografia vem da variável de ambiente AI_ENCRYPTION_KEY.
 */
export async function serializeAiConfig(
  config: AiConfig,
  encryptionKey: string
): Promise<string> {
  // Re-criptografa cada chave individualmente
  const providers: AiConfig["providers"] = {}
  for (const [provider, entry] of Object.entries(config.providers) as [AiProvider, AiProviderEntry][]) {
    if (!entry) continue
    providers[provider] = {
      keyEncrypted: entry.keyEncrypted, // já criptografada
      enabled: entry.enabled,
    }
  }
  const json = JSON.stringify({ activeProvider: config.activeProvider, providers })
  return encrypt(json, encryptionKey)
}

/**
 * Deserializa a configuração armazenada no banco (texto cifrado).
 */
export async function deserializeAiConfig(
  ciphertext: string,
  encryptionKey: string
): Promise<AiConfig | null> {
  try {
    const json = await decrypt(ciphertext, encryptionKey)
    return JSON.parse(json) as AiConfig
  } catch {
    return null
  }
}

/**
 * Versão segura para enviar ao front-end: substitui as chaves reais por { hasKey: true/false }.
 */
export function toPublicAiConfig(config: AiConfig): AiConfigPublic {
  const providers: AiConfigPublic["providers"] = {}
  for (const [provider, entry] of Object.entries(config.providers) as [AiProvider, AiProviderEntry][]) {
    if (!entry) continue
    providers[provider] = {
      hasKey: Boolean(entry.keyEncrypted),
      enabled: entry.enabled,
    }
  }
  return { activeProvider: config.activeProvider, providers }
}

/**
 * Criptografa uma chave de API bruta antes de armazenar.
 */
export async function encryptApiKey(
  rawKey: string,
  encryptionKey: string
): Promise<string> {
  return encrypt(rawKey, encryptionKey)
}

/**
 * Recupera a chave de API descriptografada de um provider.
 * Usar APENAS no servidor, nunca retornar ao cliente.
 */
export async function getDecryptedApiKey(
  config: AiConfig,
  provider: AiProvider,
  encryptionKey: string
): Promise<string | null> {
  const entry = config.providers[provider]
  if (!entry?.keyEncrypted) return null
  try {
    return await decrypt(entry.keyEncrypted, encryptionKey)
  } catch {
    return null
  }
}
