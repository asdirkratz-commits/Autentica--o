/**
 * Criptografia AES-256-GCM para dados sensíveis (chaves de API de IA).
 *
 * Usa a Web Crypto API nativa — compatível com Node.js 18+ e Edge Runtime.
 *
 * Formato do texto cifrado: base64(iv[12 bytes] + ciphertext + authTag[16 bytes])
 */

const ALGO = "AES-GCM"
const KEY_USAGE: KeyUsage[] = ["encrypt", "decrypt"]

/**
 * Importa a chave de criptografia a partir de uma string hex de 64 chars (256 bits).
 * Use: openssl rand -hex 32
 */
async function importKey(hexKey: string): Promise<CryptoKey> {
  const raw = new Uint8Array(
    hexKey.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  )
  return crypto.subtle.importKey("raw", raw, ALGO, false, KEY_USAGE)
}

/** Criptografa um valor string. Retorna base64(iv + ciphertext). */
export async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const cipherBuffer = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded)

  // Concatena iv (12 bytes) + ciphertext+tag (n bytes)
  const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuffer), iv.byteLength)

  return btoa(String.fromCharCode(...combined))
}

/** Descriptografa um valor produzido por `encrypt`. */
export async function decrypt(ciphertext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey)
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))

  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  const plainBuffer = await crypto.subtle.decrypt({ name: ALGO, iv }, key, data)
  return new TextDecoder().decode(plainBuffer)
}
