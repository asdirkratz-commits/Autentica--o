import { NextRequest, NextResponse } from "next/server"
import { UserRepo, TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireMasterGlobalApi } from "@/lib/api-guard"

type Params = { params: Promise<{ id: string }> }

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "A senha deve ter ao menos 8 caracteres."
  if (!/[A-Z]/.test(pw)) return "A senha deve ter ao menos 1 letra maiúscula."
  if (!/[0-9]/.test(pw)) return "A senha deve ter ao menos 1 número."
  if (!/[^A-Za-z0-9]/.test(pw)) return "A senha deve ter ao menos 1 símbolo."
  return null
}

// GET /api/admin/tenants/[id]/users — usuários da empresa + módulos liberados
export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response

  const { id } = await params

  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
      { status: 404 }
    )
  }

  const members = await UserRepo.getTenantMembers(id)
  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      fullName: m.fullName,
      email: m.email,
      role: m.role,
      status: m.status,
      modulos: m.modulos,
    })),
  })
}

// POST /api/admin/tenants/[id]/users — Master cadastra um usuário direto na empresa.
// Sem e-mail de convite: a senha é definida na hora. Espelha o fluxo do portal,
// mas master-gated e com o tenant vindo da URL (não do tenant ativo do ator).
export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response
  const actorId = guard.userId

  const { id: tenantId } = await params
  const tenant = await TenantRepo.findById(tenantId)
  if (!tenant) {
    return NextResponse.json(err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error, { status: 404 })
  }

  let body: { email?: string; fullName?: string; password?: string; role?: "admin" | "user"; modulos?: string[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error, { status: 400 })
  }

  const email = body.email?.toLowerCase().trim()
  const fullName = body.fullName?.trim()
  const password = body.password
  const role: "admin" | "user" = body.role === "admin" ? "admin" : "user"
  const modulos = Array.isArray(body.modulos) ? body.modulos.filter((m) => typeof m === "string") : []

  if (!email || !fullName || !password) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "email, fullName e password são obrigatórios", 400).error,
      { status: 400 },
    )
  }
  const pwError = validatePassword(password)
  if (pwError) {
    return NextResponse.json(err(ErrorCode.VALIDATION_ERROR, pwError, 400).error, { status: 400 })
  }

  try {
    const existing = await UserRepo.findByEmail(email)

    let userId: string
    if (existing) {
      const link = await UserRepo.getUserRoleInTenant(existing.id, tenantId)
      // Só bloqueia se já está ATIVO. Vínculo não-ativo (ex.: criação anterior que
      // falhou no meio e deixou "pendente") é reaproveitado e reativado abaixo —
      // torna o cadastro idempotente em vez de travar o usuário.
      if (link && link.status === "active") {
        return NextResponse.json(
          err(ErrorCode.VALIDATION_ERROR, "Usuário já pertence a esta empresa", 400).error,
          { status: 400 },
        )
      }
      userId = existing.id
    } else {
      const created = await UserRepo.create({ email, password, fullName })
      userId = created.id
    }

    await UserRepo.linkToTenant(userId, tenantId, role, actorId)
    await UserRepo.setUserStatusInTenant(userId, tenantId, "active")
    if (modulos.length > 0) {
      await UserRepo.updateUserModulos(userId, tenantId, modulos)
    }

    await AuditRepo.log({
      tenantId,
      userId: actorId,
      action: "user.created",
      targetType: "user",
      targetId: userId,
      metadata: { email, role, via: existing ? "admin_link" : "admin_registration", modulos },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    })

    return NextResponse.json({ ok: true, userId }, { status: 201 })
  } catch (e) {
    console.error("[admin/tenants/users POST]", e)
    return NextResponse.json(err(ErrorCode.INTERNAL_ERROR, "Erro ao cadastrar usuário.", 500).error, { status: 500 })
  }
}
