/**
 * Content-Security-Policy por requisição (F-09).
 *
 * Produção: `script-src 'self' 'nonce-<n>' 'strict-dynamic'` — SEM 'unsafe-inline'
 * nem 'unsafe-eval'. O nonce é gerado por requisição no middleware e o Next o
 * injeta em todos os seus <script> (lendo o header Content-Security-Policy da
 * requisição); 'strict-dynamic' propaga a confiança aos chunks que esses scripts
 * carregam.
 *
 * Desenvolvimento: `script-src` permissivo ('unsafe-inline'/'unsafe-eval') porque
 * o React Refresh/HMR do Next dev precisa de eval e de scripts inline sem nonce.
 *
 * `style-src` mantém 'unsafe-inline' (estilos inline do tema por tenant + atributos
 * style legítimos no app) + fonts.googleapis. Edge-safe (Web Crypto + btoa).
 */

/** Nonce aleatório base64, seguro no Edge runtime. */
export function generateCspNonce(): string {
  return btoa(crypto.randomUUID())
}

/**
 * Monta o header CSP. Em produção com `nonce` → script-src estrito; caso
 * contrário (dev ou sem nonce) → script-src permissivo.
 */
export function buildCsp(nonce: string | null): string {
  const isProduction = process.env.NODE_ENV === "production"
  const scriptSrc =
    isProduction && nonce
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' https://fonts.gstatic.com",
    // viacep: autofill de endereço por CEP nos formulários de tenant (admin)
    "connect-src 'self' https://viacep.com.br",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}
