/**
 * UserAppAccessRepo — Supabase (public.user_app_access)
 * Migrado do Neon na P4/R4b. user_id / granted_by agora são GoTrue UUID
 * (auth.users.id), consistente com user_tenants / refresh_tokens.
 *
 * Acesso via REST com SUPABASE_SERVICE_ROLE_KEY (bypassa RLS service-role-only, 058).
 */
import { supabase } from "../supabase-client"

type UserAppAccessRow = {
  user_id: string
  tenant_id: string
  app_id: string
  granted_by: string | null
  granted_at: string
}

function enc(v: string): string {
  return encodeURIComponent(v)
}

export const UserAppAccessRepo = {
  /** Retorna os app_ids liberados para um usuário em um tenant */
  async getUserApps(userId: string, tenantId: string): Promise<string[]> {
    const rows = await supabase.from<UserAppAccessRow>("user_app_access").select(
      `select=app_id&user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}`,
    )
    return rows.map((r) => r.app_id)
  },

  /** Verifica se um usuário tem acesso a um app específico */
  async hasAccess(
    userId: string,
    tenantId: string,
    appId: string,
  ): Promise<boolean> {
    const rows = await supabase.from<UserAppAccessRow>("user_app_access").select(
      `select=app_id&user_id=eq.${enc(userId)}&tenant_id=eq.${enc(
        tenantId,
      )}&app_id=eq.${enc(appId)}&limit=1`,
    )
    return rows.length > 0
  },

  /** Libera um app para o usuário (idempotente — não duplica) */
  async grantApp(
    userId: string,
    tenantId: string,
    appId: string,
    grantedBy: string,
  ): Promise<void> {
    if (await this.hasAccess(userId, tenantId, appId)) return
    await supabase.from<UserAppAccessRow>("user_app_access").insert({
      user_id: userId,
      tenant_id: tenantId,
      app_id: appId,
      granted_by: grantedBy,
    } as Partial<UserAppAccessRow>)
  },

  /** Revoga acesso a um app */
  async revokeApp(userId: string, tenantId: string, appId: string): Promise<void> {
    await supabase
      .from<UserAppAccessRow>("user_app_access")
      .delete(
        `user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}&app_id=eq.${enc(
          appId,
        )}`,
      )
  },

  /**
   * Define exatamente quais apps o usuário pode acessar (substitui a lista atual).
   * Se appIds for vazio, revoga todos.
   */
  async setUserApps(
    userId: string,
    tenantId: string,
    appIds: string[],
    grantedBy: string,
  ): Promise<void> {
    await supabase
      .from<UserAppAccessRow>("user_app_access")
      .delete(`user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}`)

    if (appIds.length === 0) return

    await supabase.from<UserAppAccessRow>("user_app_access").insert(
      appIds.map((appId) => ({
        user_id: userId,
        tenant_id: tenantId,
        app_id: appId,
        granted_by: grantedBy,
      })) as Partial<UserAppAccessRow>[],
    )
  },

  /** Remove todos os acessos do usuário no tenant (ao remover o usuário) */
  async revokeAll(userId: string, tenantId: string): Promise<void> {
    await supabase
      .from<UserAppAccessRow>("user_app_access")
      .delete(`user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}`)
  },
}
