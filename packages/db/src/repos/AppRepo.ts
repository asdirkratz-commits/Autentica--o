/**
 * AppRepo — Supabase (public.apps + public.app_subscriptions)
 * Migrado do Neon na P4/R4b. O catálogo de apps e as assinaturas por tenant agora
 * vivem no Supabase do KontoHub; o app de Auth deixa de ler essas tabelas do Neon.
 *
 * Identidade/segurança: acesso via REST com SUPABASE_SERVICE_ROLE_KEY (bypassa RLS).
 * As tabelas têm RLS habilitado sem policy → somente service_role acessa (migration 058).
 */
import { supabase } from "../supabase-client"

type AppRow = {
  id: string
  name: string
  display_name: string
  description: string | null
  base_url: string
  icon_url: string | null
  api_key: string
  env: "production" | "sandbox"
  active: boolean
  parent_app_id: string | null
  created_at: string
}

type AppSubscriptionRow = {
  tenant_id: string
  app_id: string
  active: boolean
  expires_at: string | null
  created_at: string
}

// Linha de app_subscriptions com o app embutido (PostgREST embedding `apps(*)`).
type AppSubscriptionWithAppRow = AppSubscriptionRow & { apps: AppRow }

export type App = {
  id: string
  name: string
  displayName: string
  description: string | null
  baseUrl: string
  iconUrl: string | null
  apiKey: string
  env: "production" | "sandbox"
  active: boolean
  parentAppId: string | null
  createdAt: Date
}

export type AppSubscription = {
  tenantId: string
  appId: string
  active: boolean
  expiresAt: Date | null
  createdAt: Date
}

export type CreateAppDTO = {
  name: string
  displayName: string
  description?: string
  baseUrl: string
  iconUrl?: string
}

function enc(v: string): string {
  return encodeURIComponent(v)
}

function fromAppRow(r: AppRow): App {
  return {
    id: r.id,
    name: r.name,
    displayName: r.display_name,
    description: r.description,
    baseUrl: r.base_url,
    iconUrl: r.icon_url,
    apiKey: r.api_key,
    env: r.env,
    active: r.active,
    parentAppId: r.parent_app_id,
    createdAt: new Date(r.created_at),
  }
}

function fromSubRow(r: AppSubscriptionRow): AppSubscription {
  return {
    tenantId: r.tenant_id,
    appId: r.app_id,
    active: r.active,
    expiresAt: r.expires_at ? new Date(r.expires_at) : null,
    createdAt: new Date(r.created_at),
  }
}

export const AppRepo = {
  async findById(id: string): Promise<App | null> {
    const rows = await supabase.from<AppRow>("apps").select(
      `id=eq.${enc(id)}&limit=1`,
    )
    return rows[0] ? fromAppRow(rows[0]) : null
  },

  async findByName(name: string): Promise<App | null> {
    const rows = await supabase.from<AppRow>("apps").select(
      `name=eq.${enc(name)}&limit=1`,
    )
    return rows[0] ? fromAppRow(rows[0]) : null
  },

  async listAll(): Promise<App[]> {
    const rows = await supabase.from<AppRow>("apps").select("order=name.asc")
    return rows.map(fromAppRow)
  },

  async listActive(): Promise<App[]> {
    const rows = await supabase.from<AppRow>("apps").select(
      "active=eq.true&order=name.asc",
    )
    return rows.map(fromAppRow)
  },

  async create(data: CreateAppDTO): Promise<App> {
    const rows = await supabase.from<AppRow>("apps").insert({
      name: data.name,
      display_name: data.displayName,
      description: data.description ?? null,
      base_url: data.baseUrl,
      icon_url: data.iconUrl ?? null,
    } as Partial<AppRow>)
    const row = rows[0]
    if (!row) throw new Error("Failed to create app")
    return fromAppRow(row)
  },

  async setActive(id: string, active: boolean): Promise<void> {
    await supabase.from<AppRow>("apps").update(`id=eq.${enc(id)}`, {
      active,
    } as Partial<AppRow>)
  },

  async getSubscriptionsForTenant(
    tenantId: string,
  ): Promise<(AppSubscription & { app: App })[]> {
    // PostgREST embedding: traz o app (apps) junto da assinatura numa só chamada.
    const rows = await supabase
      .from<AppSubscriptionWithAppRow>("app_subscriptions")
      .select(
        `select=tenant_id,app_id,active,expires_at,created_at,apps(*)&tenant_id=eq.${enc(
          tenantId,
        )}&active=eq.true`,
      )
    return rows.map((r) => ({
      ...fromSubRow(r),
      app: fromAppRow(r.apps),
    }))
  },

  async subscribeToApp(
    tenantId: string,
    appId: string,
    expiresAt?: Date,
  ): Promise<void> {
    // Upsert manual (PK composta tenant_id+app_id): atualiza se existir, senão insere.
    const existing = await supabase
      .from<AppSubscriptionRow>("app_subscriptions")
      .select(`tenant_id=eq.${enc(tenantId)}&app_id=eq.${enc(appId)}&limit=1`)
    if (existing[0]) {
      await supabase
        .from<AppSubscriptionRow>("app_subscriptions")
        .update(`tenant_id=eq.${enc(tenantId)}&app_id=eq.${enc(appId)}`, {
          active: true,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
        } as Partial<AppSubscriptionRow>)
      return
    }
    await supabase.from<AppSubscriptionRow>("app_subscriptions").insert({
      tenant_id: tenantId,
      app_id: appId,
      active: true,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    } as Partial<AppSubscriptionRow>)
  },

  async unsubscribeFromApp(tenantId: string, appId: string): Promise<void> {
    await supabase
      .from<AppSubscriptionRow>("app_subscriptions")
      .update(`tenant_id=eq.${enc(tenantId)}&app_id=eq.${enc(appId)}`, {
        active: false,
      } as Partial<AppSubscriptionRow>)
  },
}
