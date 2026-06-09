import { NextResponse } from "next/server"
import { requireActiveTenantMember } from "@/lib/api-guard"
import { getAccessibleApps } from "@/lib/accessible-apps"

// GET /api/tenant/apps — apps disponíveis para o usuário atual.
// Gating em fonte única (lib/accessible-apps), compartilhado com o portal:
//   admin e master_global → todos os apps com assinatura ativa no tenant
//   user                  → interseção com user_app_access
export async function GET(): Promise<NextResponse> {
  const guard = await requireActiveTenantMember()
  if (!guard.ok) return guard.response
  const { userId, tenantId, role, isMasterGlobal } = guard.ctx

  const data = await getAccessibleApps({ userId, tenantId, role, isMasterGlobal })
  return NextResponse.json({ ok: true, data })
}
