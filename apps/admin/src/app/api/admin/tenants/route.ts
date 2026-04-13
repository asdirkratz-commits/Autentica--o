import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

/** Valida dígitos verificadores do CNPJ (algoritmo padrão da Receita Federal) */
function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "")
  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false // todos iguais

  const calc = (d: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + parseInt(d[i]!) * w, 0)

  const mod = (n: number) => {
    const r = n % 11
    return r < 2 ? 0 : 11 - r
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const d1 = mod(calc(digits, w1))
  const d2 = mod(calc(digits, w2))

  return parseInt(digits[12]!) === d1 && parseInt(digits[13]!) === d2
}

type TenantBody = {
  name?: string
  slug?: string
  plan?: string
  logoUrl?: string
  internalNotes?: string
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

// POST /api/admin/tenants — criar nova empresa (master_global only)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  let body: TenantBody
  try {
    body = (await request.json()) as TenantBody
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const {
    name, slug, plan, logoUrl, internalNotes,
    cnpj, zipCode, street, streetNumber, complement, district, city, state, country,
  } = body

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "name e slug são obrigatórios", 400).error,
      { status: 400 }
    )
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "slug deve conter apenas letras minúsculas, números e hífens", 400).error,
      { status: 400 }
    )
  }

  // Validação de CNPJ (se informado)
  if (cnpj?.trim()) {
    if (!isValidCnpj(cnpj)) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "CNPJ inválido", 400).error,
        { status: 400 }
      )
    }
    // Verificar CNPJ duplicado
    const byCnpj = await TenantRepo.findByCnpj(cnpj.replace(/\D/g, ""))
    if (byCnpj) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "CNPJ já cadastrado para outra empresa", 409).error,
        { status: 409 }
      )
    }
  }

  const existing = await TenantRepo.findBySlug(slug)
  if (existing) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Slug já em uso por outra empresa", 409).error,
      { status: 409 }
    )
  }

  // Formatar CNPJ no padrão XX.XXX.XXX/XXXX-XX antes de salvar
  const cnpjFormatted = cnpj?.trim()
    ? cnpj.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : undefined

  const tenant = await TenantRepo.create({
    name, slug, plan, logoUrl, internalNotes,
    cnpj: cnpjFormatted,
    zipCode, street, streetNumber, complement, district, city,
    state: state?.toUpperCase(),
    country: country ?? "BR",
  })

  await AuditRepo.log({
    userId,
    action: "tenant.created",
    targetType: "tenant",
    targetId: tenant.id,
    metadata: { name, slug, plan, cnpj: cnpjFormatted, city, state },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ id: tenant.id, ok: true }, { status: 201 })
}
