import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { UserRepo } from "@repo/db"

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "")
const COOKIE_NAME = "access_token"

const PUBLIC_PATHS = ["/favicon.ico", "/_next"]

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ── 1. JWT presente? ──────────────────────────────────────────────────────
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return redirectToLogin(request)
  }

  // ── 2. JWT válido? ────────────────────────────────────────────────────────
  let userId: string
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    userId = payload.sub ?? ""
    if (!userId) return redirectToLogin(request)
  } catch {
    return redirectToLogin(request)
  }

  // ── 3. is_master_global verificado no banco (nunca no JWT) ────────────────
  const user = await UserRepo.findById(userId)
  if (!user || !user.isMasterGlobal) {
    return new NextResponse("Acesso negado: área restrita ao master global.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // ── 4. Injetar headers e prosseguir ───────────────────────────────────────
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-user-id", user.id)
  requestHeaders.set("x-user-name", user.fullName)
  requestHeaders.set("x-user-email", user.email)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", AUTH_URL)
  loginUrl.searchParams.set("return_to", request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
