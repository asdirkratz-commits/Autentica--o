/**
 * TenantRepo — Supabase (public.tenants)
 * Migrado do Neon na P3/R4a. A tabela de tenants agora vive no Supabase do KontoHub;
 * o app de Auth deixa de ler a tabela `tenants` do Neon.
 *
 * Mapeamento de colunas Supabase ⇄ domínio (camelCase):
 *   Endereço (pt-BR no Supabase): cep⇄zipCode, logradouro⇄street, numero⇄streetNumber,
 *     complemento⇄complement, bairro⇄district, cidade⇄city, estado⇄state.
 *   theme: coluna JSONB no Supabase, mas o app trata `tenant.theme` como STRING JSON
 *     (callers fazem JSON.parse(tenant.theme)). fromRow faz stringify; updateTheme envia
 *     o objeto PARSEADO para a coluna jsonb.
 *   Marca (cor_primaria/secundaria/destaque): é a fonte que o KontoHub LÊ para pintar a
 *     UI. O portal Auth pinta a partir de `theme`. Por isso `updateBrand` grava NOS DOIS
 *     (cor_* + theme) — assim editar a marca no admin reflete no KontoHub E no portal.
 *     `fromRow` expõe as cores como brandPrimary/brandSecondary/brandAccent.
 */
import { supabase } from "../supabase-client"

type TenantStatus = "ativo" | "inativo" | "inadimplente" | "bloqueado"

type TenantRow = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  status_updated_at: string | null
  logo_url: string | null
  internal_notes: string | null
  external_billing_id: string | null
  plan: string
  // JSONB — pode vir como objeto/array/escalar; fromRow serializa para string
  theme: unknown
  ai_config: string | null
  // Marca lida pelo KontoHub
  cor_primaria: string | null
  cor_secundaria: string | null
  cor_destaque: string | null
  cnpj: string | null
  // Endereço (nomes pt-BR no Supabase)
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  country: string | null
  created_at: string
  updated_at: string
}

export type Tenant = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  statusUpdatedAt: Date
  logoUrl: string | null
  internalNotes: string | null
  externalBillingId: string | null
  plan: string
  theme: string | null
  aiConfig: string | null
  brandPrimary: string | null
  brandSecondary: string | null
  brandAccent: string | null
  cnpj: string | null
  zipCode: string | null
  street: string | null
  streetNumber: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string | null
  createdAt: Date
  updatedAt: Date
}

export type TenantFilters = {
  status?: TenantStatus
  plan?: string
}

export type TenantAddress = {
  zipCode?: string
  street?: string
  streetNumber?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  country?: string
}

export type CreateTenantDTO = {
  name: string
  slug: string
  plan?: string
  logoUrl?: string
  internalNotes?: string
  cnpj?: string
} & TenantAddress

function fromRow(r: TenantRow): Tenant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    // status_updated_at é NOT NULL DEFAULT now() no Auth; fallback a created_at por segurança
    statusUpdatedAt: new Date(r.status_updated_at ?? r.created_at),
    logoUrl: r.logo_url,
    internalNotes: r.internal_notes,
    externalBillingId: r.external_billing_id,
    plan: r.plan,
    // jsonb → string JSON (callers fazem JSON.parse). null/undefined preservados como null.
    theme: r.theme == null ? null : JSON.stringify(r.theme),
    aiConfig: r.ai_config,
    brandPrimary: r.cor_primaria,
    brandSecondary: r.cor_secundaria,
    brandAccent: r.cor_destaque,
    cnpj: r.cnpj,
    zipCode: r.cep,
    street: r.logradouro,
    streetNumber: r.numero,
    complement: r.complemento,
    district: r.bairro,
    city: r.cidade,
    state: r.estado,
    country: r.country,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function enc(v: string): string {
  return encodeURIComponent(v)
}

/** Constrói o patch jsonb de theme a partir da string JSON do app. */
function themePatch(themeJson: string): unknown {
  if (themeJson == null || themeJson === "") return null
  try {
    return JSON.parse(themeJson) as unknown
  } catch {
    // String inválida: armazena como escalar JSON (preserva o conteúdo sem quebrar)
    return themeJson
  }
}

export const TenantRepo = {
  async findById(id: string): Promise<Tenant | null> {
    const rows = await supabase.from<TenantRow>("tenants").select(
      `id=eq.${enc(id)}&limit=1`,
    )
    return rows[0] ? fromRow(rows[0]) : null
  },

  async findBySlug(slug: string): Promise<Tenant | null> {
    const rows = await supabase.from<TenantRow>("tenants").select(
      `slug=eq.${enc(slug)}&limit=1`,
    )
    return rows[0] ? fromRow(rows[0]) : null
  },

  async listAll(filters?: TenantFilters): Promise<Tenant[]> {
    const parts: string[] = []
    if (filters?.status) parts.push(`status=eq.${enc(filters.status)}`)
    if (filters?.plan) parts.push(`plan=eq.${enc(filters.plan)}`)
    parts.push("order=created_at.asc")
    const rows = await supabase.from<TenantRow>("tenants").select(parts.join("&"))
    return rows.map(fromRow)
  },

  async create(data: CreateTenantDTO): Promise<Tenant> {
    const rows = await supabase.from<TenantRow>("tenants").insert({
      name: data.name,
      slug: data.slug,
      plan: data.plan ?? "starter", // Supabase tenants.plan CHECK (starter|professional|enterprise)
      logo_url: data.logoUrl ?? null,
      internal_notes: data.internalNotes ?? null,
      cnpj: data.cnpj ?? null,
      cep: data.zipCode ?? null,
      logradouro: data.street ?? null,
      numero: data.streetNumber ?? null,
      complemento: data.complement ?? null,
      bairro: data.district ?? null,
      cidade: data.city ?? null,
      estado: data.state ?? null,
      country: data.country ?? "BR",
    } as Partial<TenantRow>)
    const row = rows[0]
    if (!row) throw new Error("Failed to create tenant")
    return fromRow(row)
  },

  async updateAddress(
    id: string,
    address: TenantAddress & { cnpj?: string },
  ): Promise<void> {
    const patch: Partial<TenantRow> = { updated_at: new Date().toISOString() }
    if (address.cnpj !== undefined) patch.cnpj = address.cnpj
    if (address.zipCode !== undefined) patch.cep = address.zipCode
    if (address.street !== undefined) patch.logradouro = address.street
    if (address.streetNumber !== undefined) patch.numero = address.streetNumber
    if (address.complement !== undefined) patch.complemento = address.complement
    if (address.district !== undefined) patch.bairro = address.district
    if (address.city !== undefined) patch.cidade = address.city
    if (address.state !== undefined) patch.estado = address.state
    if (address.country !== undefined) patch.country = address.country
    await supabase.from<TenantRow>("tenants").update(`id=eq.${enc(id)}`, patch)
  },

  async updateCnpj(id: string, cnpj: string): Promise<void> {
    await supabase.from<TenantRow>("tenants").update(`id=eq.${enc(id)}`, {
      cnpj,
      updated_at: new Date().toISOString(),
    } as Partial<TenantRow>)
  },

  async updateTheme(id: string, themeJson: string): Promise<void> {
    await supabase.from<TenantRow>("tenants").update(`id=eq.${enc(id)}`, {
      // Envia o objeto parseado para a coluna jsonb (não a string crua)
      theme: themePatch(themeJson),
      updated_at: new Date().toISOString(),
    } as Partial<TenantRow>)
  },

  /**
   * Grava a marca NOS DOIS lugares: cor_primaria/secundaria/destaque (lidas pelo
   * KontoHub) E o jsonb `theme` (lido pelo portal Auth). Mantém os dois consumidores
   * em sincronia a partir de um único ponto de edição (o admin).
   */
  async updateBrand(
    id: string,
    colors: { primary: string; secondary: string; accent: string },
  ): Promise<void> {
    await supabase.from<TenantRow>("tenants").update(`id=eq.${enc(id)}`, {
      cor_primaria: colors.primary,
      cor_secundaria: colors.secondary,
      cor_destaque: colors.accent,
      theme: { primary: colors.primary, secondary: colors.secondary, accent: colors.accent },
      updated_at: new Date().toISOString(),
    } as Partial<TenantRow>)
  },

  async updateStatus(
    id: string,
    status: TenantStatus,
    notes?: string,
  ): Promise<void> {
    const now = new Date().toISOString()
    const patch: Partial<TenantRow> = {
      status,
      status_updated_at: now,
      updated_at: now,
    }
    if (notes !== undefined) patch.internal_notes = notes
    await supabase.from<TenantRow>("tenants").update(`id=eq.${enc(id)}`, patch)
  },

  async updateExternalBillingId(id: string, externalId: string): Promise<void> {
    await supabase.from<TenantRow>("tenants").update(`id=eq.${enc(id)}`, {
      external_billing_id: externalId,
      updated_at: new Date().toISOString(),
    } as Partial<TenantRow>)
  },

  async updateLogo(id: string, logoUrl: string | null): Promise<void> {
    await supabase.from<TenantRow>("tenants").update(`id=eq.${enc(id)}`, {
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    } as Partial<TenantRow>)
  },

  async findByExternalBillingId(externalId: string): Promise<Tenant | null> {
    const rows = await supabase.from<TenantRow>("tenants").select(
      `external_billing_id=eq.${enc(externalId)}&limit=1`,
    )
    return rows[0] ? fromRow(rows[0]) : null
  },

  async findByCnpj(cnpjDigitsOnly: string): Promise<Tenant | null> {
    // Busca no formato armazenado (XX.XXX.XXX/XXXX-XX) — preserva a lógica do Neon
    const formatted = cnpjDigitsOnly.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    )
    const rows = await supabase.from<TenantRow>("tenants").select(
      `cnpj=eq.${enc(formatted)}&limit=1`,
    )
    return rows[0] ? fromRow(rows[0]) : null
  },
}
