import { eq, and } from "drizzle-orm"
import { db } from "../client.js"
import { tenants, type Tenant, type NewTenant } from "../schema/index.js"

type TenantStatus = "ativo" | "inativo" | "inadimplente" | "bloqueado"

export type TenantFilters = {
  status?: TenantStatus
  plan?: string
}

export type CreateTenantDTO = {
  name: string
  slug: string
  plan?: string
  internalNotes?: string
}

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
        internalNotes: data.internalNotes,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error("Failed to create tenant")
    return row
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

  async findByExternalBillingId(externalId: string): Promise<Tenant | null> {
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.externalBillingId, externalId))
      .limit(1)
    return rows[0] ?? null
  },
}
