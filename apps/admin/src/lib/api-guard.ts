import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { UserRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

export type AdminApiResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Guard Node-runtime para rotas /api/admin/**.
 *
 * O middleware admin só checa a flag master_global do JWT, que é um snapshot de
 * até 15min — um master revogado manteria acesso às rotas privilegiadas até o
 * token expirar. Aqui revalidamos is_master_global contra o banco antes de
 * qualquer leitura/mutação privilegiada.
 */
export async function requireMasterGlobalApi(): Promise<AdminApiResult> {
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error, { status: 401 }),
    }
  }

  const user = await UserRepo.findById(userId)
  if (!user || !user.isMasterGlobal) {
    return {
      ok: false,
      response: NextResponse.json(err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error, { status: 403 }),
    }
  }

  return { ok: true, userId }
}
