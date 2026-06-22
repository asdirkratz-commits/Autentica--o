/**
 * Cofre AES-256-GCM — formato COMPATÍVEL com o Aes256Adapter do KontoHub.
 *
 * IMPORTANTE: este NÃO é o mesmo formato do `crypto.ts` deste pacote.
 *   - `crypto.ts`  → base64(iv[12] + ciphertext + authTag)   (IV embutido) — usado p/ chaves de IA
 *   - `cofre.ts`   → { cifrado: base64(ciphertext + authTag), iv: base64(iv[12]) }  (IV em campo separado)
 *
 * O agente Electron do KontoHub descriptografa os certificados gravados aqui, então
 * o formato precisa ser exatamente o dele (`src/infrastructure/crypto/aes256.adapter.ts`):
 * AES-256-GCM, IV de 12 bytes guardado à parte, authTag de 16 bytes concatenado ao
 * final do ciphertext, ciphertext em base64.
 *
 * Chave: COFRE_SECRET_KEY — 64 chars hex (256 bits). A MESMA usada pelo KontoHub.
 * Implementado com Web Crypto (edge-safe), mas o formato de saída é idêntico ao do
 * `node:crypto` do KontoHub (GCM com tag de 128 bits anexada ao ciphertext).
 */

const ALGO = "AES-GCM"

function importKey(hexKey: string): Promise<CryptoKey> {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error("COFRE_SECRET_KEY deve ter 64 caracteres hexadecimais (256 bits).")
  }
  const raw = new Uint8Array(hexKey.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  return crypto.subtle.importKey("raw", raw, ALGO, false, ["encrypt", "decrypt"])
}

function toBase64(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** Criptografa uma string. Retorna { cifrado: base64(ct+tag), iv: base64(iv) }. */
export async function cofreEncryptString(
  plaintext: string,
  hexKey: string,
): Promise<{ cifrado: string; iv: string }> {
  const key = await importKey(hexKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(plaintext)
  const buf = await crypto.subtle.encrypt({ name: ALGO, iv }, key, data as BufferSource)
  return { cifrado: toBase64(new Uint8Array(buf)), iv: toBase64(iv) }
}

/** Descriptografa o que `cofreEncryptString` produziu. */
export async function cofreDecryptString(cifrado: string, iv: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey)
  const buf = await crypto.subtle.decrypt(
    { name: ALGO, iv: fromBase64(iv) as BufferSource },
    key,
    fromBase64(cifrado) as BufferSource,
  )
  return new TextDecoder().decode(buf)
}

/** Criptografa um buffer (arquivo .pfx). Retorna bytes cifrados (ct+tag) + IV em base64. */
export async function cofreEncryptBuffer(
  data: Uint8Array,
  hexKey: string,
): Promise<{ cifrado: Uint8Array; ivBase64: string }> {
  const key = await importKey(hexKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const buf = await crypto.subtle.encrypt({ name: ALGO, iv }, key, data as BufferSource)
  return { cifrado: new Uint8Array(buf), ivBase64: toBase64(iv) }
}

/** Descriptografa o que `cofreEncryptBuffer` produziu. */
export async function cofreDecryptBuffer(cifrado: Uint8Array, ivBase64: string, hexKey: string): Promise<Uint8Array> {
  const key = await importKey(hexKey)
  const buf = await crypto.subtle.decrypt(
    { name: ALGO, iv: fromBase64(ivBase64) as BufferSource },
    key,
    cifrado as BufferSource,
  )
  return new Uint8Array(buf)
}
