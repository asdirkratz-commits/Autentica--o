import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { TenantRepo, UserRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

export type TenantApiContext = {
  userId: string
  tenantId: string
  /** Papel VIVO do vínculo no tenant (do banco, não do header obsoleto). */
  role: string | null
  isMasterGlobal: boolean
}

export type TenantGuardResult =
  | { ok: true; ctx: TenantApiContext }
  | { ok: false; response: NextResponse }

function deny(code: ErrorCode, message: string, status: number): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json(err(code, message, status).error, { status }) }
}

/**
 * Guard Node-runtime para rotas /api/tenant/**.
 *
 * O middleware Edge não acessa o banco, então a IDENTIDADE chega por headers já
 * confiáveis (SEC-01). Mas o STATUS embutido no JWT é um snapshot de até 15min:
 * um usuário desativado ou um tenant bloqueado manteria acesso à API até o token
 * expirar. Aqui revalidamos contra o banco a cada chamada:
 *  - tenant vivo (bloqueado/inativo cortam; inadimplente ainda opera);
 *  - vínculo do usuário ativo neste tenant;
 *  - flag master_global vigente (não confia no claim).
 *
 * Retorna o papel VIVO do banco, para que um downgrade de role tenha efeito
 * imediato em vez de esperar a expiração do token.
 */
export async function requireActiveTenantMember(): Promise<TenantGuardResult> {
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")
  const claimsMaster = hdrs.get("x-master-global") === "true"

  if (!userId || !tenantId) {
    return deny(ErrorCode.UNAUTHORIZED, "Não autenticado", 401)
  }

  const tenant = await TenantRepo.findById(tenantId)
  if (!tenant || tenant.status === "bloqueado" || tenant.status === "inativo") {
    return deny(ErrorCode.FORBIDDEN, "Empresa indisponível", 403)
  }

  const membership = await UserRepo.getUserRoleInTenant(userId, tenantId)

  if (claimsMaster) {
    const user = await UserRepo.findById(userId)
    if (!user || !user.isMasterGlobal) {
      return deny(ErrorCode.FORBIDDEN, "Acesso negado", 403)
    }
    return { ok: true, ctx: { userId, tenantId, role: membership?.role ?? null, isMasterGlobal: true } }
  }

  if (!membership || membership.status !== "active") {
    return deny(ErrorCode.FORBIDDEN, "Acesso suspenso", 403)
  }

  return { ok: true, ctx: { userId, tenantId, role: membership.role, isMasterGlobal: false } }
}
