/**
 * Sanitização de `return_to` contra open-redirect.
 *
 * Aceita: caminhos relativos same-app ("/x", mas NÃO protocol-relative "//host")
 * e URLs absolutas cuja origem pertence ao ecossistema Konto. Qualquer outra
 * coisa (ex.: https://evil.com, //evil.com, javascript:) vira `undefined`, para
 * que o chamador aplique seu fallback com `??`.
 *
 * Client-safe: referencia `process.env.NEXT_PUBLIC_*` literalmente (inlinado pelo
 * Next no bundle do browser); não importa nada de runtime de servidor.
 */
const ECOSYSTEM_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_AUTH_URL,
  process.env.NEXT_PUBLIC_ADMIN_URL,
  process.env.NEXT_PUBLIC_KONTOHUB_URL,
  process.env.NEXT_PUBLIC_KONTOZAP_URL,
]
  .filter((u): u is string => Boolean(u))
  .map((u) => {
    try {
      return new URL(u).origin
    } catch {
      return null
    }
  })
  .filter((o): o is string => Boolean(o))

export function safeReturnTo(returnTo: string | null | undefined): string | undefined {
  if (!returnTo) return undefined
  // caminho relativo (não protocol-relative "//host")
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo
  try {
    const url = new URL(returnTo)
    if (ECOSYSTEM_ORIGINS.includes(url.origin)) return returnTo
  } catch {
    // não é uma URL válida → inseguro
  }
  return undefined
}
