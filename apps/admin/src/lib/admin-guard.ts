import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { UserRepo } from "@repo/db"

export type AdminUser = {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
}

/**
 * Verificação adicional de is_master_global para Server Components.
 * O middleware já garante o acesso, mas esta função fornece os dados do usuário.
 */
export async function requireMasterGlobal(): Promise<AdminUser> {
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")

  if (!userId) {
    redirect(`${process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"}/login`)
  }

  // x-user-id = GoTrue UUID (JWT sub) → buscar por gotrue_id, não por users.id (id Neon).
  const user = await UserRepo.findByGoTrueId(userId)

  if (!user || !user.isMasterGlobal) {
    redirect(`${process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"}/login`)
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
  }
}
