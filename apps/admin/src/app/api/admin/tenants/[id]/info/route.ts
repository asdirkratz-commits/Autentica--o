import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

type Params = { params: Promise<{ id: string }> }

type Body = {
  cnpj?: string
  zipCode?: string
  street?: string
  streetNumber?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  country?: string
}

function stripNonDigits(s: string) {
  return s.replace(/\D/g, "")
}

function isValidCnpj(raw: string): boolean {
  const d = stripNonDigits(raw)
  if (d.length !== 14) return false
  if (/^(\d)\1+$/.test(d)) return false

  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, n, i) => sum + parseInt(n) * weights[i]!, 0)

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const r1 = calc(d.slice(0, 12), w1) % 11
  const v1 = r1 < 2 ? 0 : 11 - r1

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const r2 = calc(d.slice(0, 13), w2) % 11
  const v2 = r2 < 2 ? 0 : 11 - r2

  return parseInt(d[12]!) === v1 && parseInt(d[13]!) === v2
}

// PATCH /api/admin/tenants/[id]/info — atualiza CNPJ e endereço
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  const { id } = await params

  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
      { status: 404 }
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  // Validar CNPJ se fornecido
  if (body.cnpj) {
    const digits = stripNonDigits(body.cnpj)
    if (digits.length > 0 && !isValidCnpj(digits)) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "CNPJ inválido", 400).error,
        { status: 400 }
      )
    }
    // Verificar duplicidade (ignorar o próprio tenant)
    if (digits.length === 14) {
      const formatted = digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
      const existing = await TenantRepo.findByCnpj(formatted)
      if (existing && existing.id !== id) {
        return NextResponse.json(
          err(ErrorCode.VALIDATION_ERROR, "CNPJ já cadastrado em outra empresa", 400).error,
          { status: 400 }
        )
      }
    }
  }

  // Formatar CNPJ
  const cnpjFormatted = body.cnpj
    ? (stripNonDigits(body.cnpj).length === 14
        ? stripNonDigits(body.cnpj).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
        : body.cnpj || null)
    : null

  await TenantRepo.updateAddress(id, {
    cnpj: cnpjFormatted ?? undefined,
    zipCode: body.zipCode || undefined,
    street: body.street || undefined,
    streetNumber: body.streetNumber || undefined,
    complement: body.complement || undefined,
    district: body.district || undefined,
    city: body.city || undefined,
    state: body.state || undefined,
    country: body.country || undefined,
  })

  await AuditRepo.log({
    userId,
    action: "tenant.status_changed",
    targetType: "tenant",
    targetId: id,
    metadata: { updated: "cnpj_address" },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
