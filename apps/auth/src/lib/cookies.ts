import type { NextResponse, NextRequest } from "next/server"
import type { TokenPair } from "@repo/auth-shared"
import { env } from "@repo/auth-shared"

const ACCESS_TOKEN_COOKIE = "access_token"
const REFRESH_TOKEN_COOKIE = "refresh_token"

/**
 * Cookies `Secure` quando o serviço é servido por HTTPS — derivado do protocolo
 * da URL pública configurada, não só de NODE_ENV (staging HTTPS com NODE_ENV
 * != production também recebe Secure; dev em http://localhost não).
 */
function isSecureContext(): boolean {
  try {
    if (env.NEXT_PUBLIC_AUTH_URL) {
      return new URL(env.NEXT_PUBLIC_AUTH_URL).protocol === "https:"
    }
  } catch {
    // URL malformada → cai no fallback
  }
  return env.isProduction
}

function cookieConfig() {
  return {
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: "lax" as const,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  }
}

/**
 * Validade do cookie de acesso, lida do PRÓPRIO token.
 *
 * Fonte única: o `exp` que acabou de ser assinado. Reinterpretar
 * `JWT_ACCESS_EXPIRES` aqui criaria um segundo parser — e o `jose`, que assina,
 * aceita formas que um regex caseiro não entende (`"1 hour"`, `"1w"`). Bastava
 * mudar a variável para uma delas e o cookie passaria a viver 15 minutos
 * enquanto o token vive uma hora, sem ninguém perceber.
 *
 * Sem `exp` legível, 15 minutos — o mesmo padrão da configuração.
 */
function accessMaxAgeSeconds(token: string): number {
  const PADRAO = 15 * 60
  try {
    const corpo = token.split(".")[1]
    if (!corpo) return PADRAO
    const json = Buffer.from(corpo.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    const exp = (JSON.parse(json) as { exp?: number }).exp
    if (typeof exp !== "number") return PADRAO
    const segundos = Math.floor(exp - Date.now() / 1000)
    // Token que já nasce vencido (config em zero, relógio para trás): cair no
    // padrão gravaria um cookie de 15 minutos carregando um token morto, e o
    // KontoHub renovaria a CADA requisição, para todos, sem nunca convergir.
    // `0` apaga o cookie e manda a pessoa ao login — barulhento, mas honesto.
    if (segundos <= 0) {
      console.error("[cookies] token de acesso já vencido ao ser emitido — confira JWT_ACCESS_EXPIRES e o relógio do servidor")
      return 0
    }
    return segundos
  } catch {
    return PADRAO
  }
}

export function setAuthCookies(
  response: NextResponse,
  tokens: TokenPair,
  refreshExpiresAt: Date
): void {
  const base = cookieConfig()

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: accessMaxAgeSeconds(tokens.accessToken),
  })

  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: Math.floor((refreshExpiresAt.getTime() - Date.now()) / 1000),
  })
}

/**
 * Renova SÓ o cookie de acesso, deixando o refresh_token como está.
 *
 * A renovação periódica não troca o refresh token: trocá-lo a cada 15 minutos
 * obriga a revogar o antigo, e como uma tela dispara várias chamadas ao mesmo
 * tempo, as concorrentes chegariam com um token recém-revogado e seriam lidas
 * como reuso de token roubado — derrubando todas as sessões do usuário. Sem
 * troca não há revogação, logo não há corrida.
 *
 * Efeito colateral desejado: o prazo do refresh_token NÃO é empurrado para
 * frente a cada renovação, então a sessão tem teto absoluto (o prazo emitido no
 * login) em vez de durar para sempre enquanto a aba estiver aberta.
 */
export function setAccessCookie(response: NextResponse, accessToken: string): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieConfig(),
    maxAge: accessMaxAgeSeconds(accessToken),
  })
}

export function clearAuthCookies(response: NextResponse): void {
  const base = cookieConfig()
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...base, maxAge: 0 })
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...base, maxAge: 0 })
}

export function getAccessTokenFromCookies(
  request: NextRequest
): string | undefined {
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
}

export function getRefreshTokenFromCookies(
  request: NextRequest
): string | undefined {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
}
