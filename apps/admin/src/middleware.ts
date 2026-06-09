/**
 * Middleware Edge-compatible — verifica JWT e flag isMasterGlobal.
 *
 * A verificação de is_master_global é feita via claim no JWT (isMasterGlobal).
 * A verificação definitiva contra o banco ocorre no layout Server Component
 * (Node.js runtime), que roda após o middleware.
 */
import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { env, stripIdentityHeaders } from "@repo/auth-shared"

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"
const COOKIE_NAME = "access_token"

// Falha-fechado: env.JWT_SECRET lança se não definido (vs. `?? ""`, que aceitava
// qualquer token assinado com segredo vazio). Avaliado por requisição, dentro do
// try, para que erro de config negue acesso (redirect a login) em vez de servir.
function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

const PUBLIC_PATHS = ["/favicon.ico", "/_next", "/login"]

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Base confiável: apaga headers de identidade forjados pelo cliente ANTES de
  // qualquer retorno (inclusive rotas públicas).
  const safeHeaders = stripIdentityHeaders(request.headers)

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers: safeHeaders } })
  }

  // ── 1. JWT presente? ──────────────────────────────────────────────────────
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return redirectToLogin(request)
  }

  // ── 2. JWT válido? ────────────────────────────────────────────────────────
  let userId: string
  let isMasterGlobal: boolean
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    userId = payload.sub ?? ""
    isMasterGlobal = (payload as Record<string, unknown>).isMasterGlobal === true
    if (!userId) return redirectToLogin(request)
  } catch {
    return redirectToLogin(request)
  }

  // ── 3. Checar flag master_global no JWT (verificação definitiva no layout) ─
  if (!isMasterGlobal) {
    return new NextResponse("Acesso negado: área restrita ao master global.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // ── 4. Injetar headers (sobre a base sanitizada) e prosseguir ─────────────
  safeHeaders.set("x-user-id", userId)

  return NextResponse.next({ request: { headers: safeHeaders } })
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", AUTH_URL)
  loginUrl.searchParams.set("return_to", request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
