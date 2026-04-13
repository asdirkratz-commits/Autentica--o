import { eq, and } from "drizzle-orm"
import { db } from "../client"
import { tenants, type Tenant, type NewTenant } from "../schema/index"

type TenantStatus = "ativo" | "inativo" | "inadimplente" | "bloqueado"

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

export const TenantRepo = {
  async findById(id: string): Promise<Tenant | null> {
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)
    return rows[0] ?? null
  },

  async findBySlug(slug: string): Promise<Tenant | null> {
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)
    return rows[0] ?? null
  },

  async listAll(filters?: TenantFilters): Promise<Tenant[]> {
    const conditions = []
    if (filters?.status) conditions.push(eq(tenants.status, filters.status))
    if (filters?.plan) conditions.push(eq(tenants.plan, filters.plan))

    return db
      .select()
      .from(tenants)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(tenants.createdAt)
  },

  async create(data: CreateTenantDTO): Promise<Tenant> {
    const rows = await db
      .insert(tenants)
      .values({
        name: data.name,
        slug: data.slug,
        plan: data.plan ?? "basic",
        logoUrl: data.logoUrl,
        internalNotes: data.internalNotes,
        cnpj: data.cnpj,
        zipCode: data.zipCode,
        street: data.street,
        streetNumber: data.streetNumber,
        complement: data.complement,
        district: data.district,
        city: data.city,
        state: data.state,
        country: data.country ?? "BR",
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error("Failed to create tenant")
    return row
  },

  async updateAddress(id: string, address: TenantAddress & { cnpj?: string }): Promise<void> {
    await db
      .update(tenants)
      .set({ ...address, updatedAt: new Date() })
      .where(eq(tenants.id, id))
  },

  async updateCnpj(id: string, cnpj: string): Promise<void> {
    await db
      .update(tenants)
      .set({ cnpj, updatedAt: new Date() })
      .where(eq(tenants.id, id))
  },

  async updateTheme(id: string, themeJson: string): Promise<void> {
    await db
      .update(tenants)
      .set({ theme: themeJson, updatedAt: new Date() })
      .where(eq(tenants.id, id))
  },

  async updateAiConfig(id: string, aiConfigEncrypted: string): Promise<void> {
    await db
      .update(tenants)
      .set({ aiConfig: aiConfigEncrypted, updatedAt: new Date() })
      .where(eq(tenants.id, id))
  },

  async updateStatus(
    id: string,
    status: TenantStatus,
    notes?: string
  ): Promise<void> {
    const values: Partial<NewTenant> = {
      status,
      statusUpdatedAt: new Date(),
      updatedAt: new Date(),
    }
    if (notes !== undefined) values.internalNotes = notes

    await db.update(tenants).set(values).where(eq(tenants.id, id))
  },

  async updateExternalBillingId(
    id: string,
    externalId: string
  ): Promise<void> {
    await db
      .update(tenants)
      .set({ externalBillingId: externalId, updatedAt: new Date() })
      .where(eq(tenants.id, id))
  },

  async updateLogo(id: string, logoUrl: string | null): Promise<void> {
    await db
      .update(tenants)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(tenants.id, id))
  },

  async findByExternalBillingId(externalId: string): Promise<Tenant | null> {
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.externalBillingId, externalId))
      .limit(1)
    return rows[0] ?? null
  },

  async findByCnpj(cnpjDigitsOnly: string): Promise<Tenant | null> {
    // Busca tanto no formato armazenado (XX.XXX.XXX/XXXX-XX) quanto só dígitos
    const formatted = cnpjDigitsOnly.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    )
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.cnpj, formatted))
      .limit(1)
    return rows[0] ?? null
  },
}
