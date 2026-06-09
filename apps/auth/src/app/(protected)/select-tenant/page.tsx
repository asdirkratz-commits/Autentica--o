import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { UserRepo } from "@repo/db"
import { TenantRepo } from "@repo/db"
import { safeReturnTo } from "@/lib/safe-redirect"
import SelectTenantClient from "./SelectTenantClient"

export default async function SelectTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>
}) {
  const { return_to: rawReturnTo } = await searchParams
  const returnTo = safeReturnTo(rawReturnTo)
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")

  if (!userId) {
    redirect("/login")
  }

  const isMasterGlobal = hdrs.get("x-master-global") === "true"

  const userTenants = await UserRepo.getUserTenants(userId)
  const activeTenants = userTenants.filter((ut) => ut.status === "active")

  // master_global sem tenants vai direto para o perfil (não precisa de empresa)
  if (activeTenants.length === 0) {
    if (isMasterGlobal) redirect(returnTo ?? "/profile")
    redirect("/login")
  }

  if (activeTenants.length === 1 && activeTenants[0]) {
    redirect(returnTo ?? "/")
  }

  // Buscar detalhes dos tenants
  const tenantDetails = await Promise.all(
    activeTenants.map(async (ut) => {
      const tenant = await TenantRepo.findById(ut.tenantId)
      return {
        tenantId: ut.tenantId,
        role: ut.role,
        name: tenant?.name ?? ut.tenantId,
        slug: tenant?.slug ?? "",
        status: tenant?.status ?? "ativo",
      }
    })
  )

  const availableTenants = tenantDetails.filter(
    (t) => t.status !== "bloqueado" && t.status !== "inativo"
  )

  return (
    <div className="portal" style={{ maxWidth: 440 }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 className="portal-greeting">Selecione a empresa</h1>
        <p className="portal-greeting-sub">Escolha com qual empresa você deseja acessar agora.</p>
      </div>
      <SelectTenantClient tenants={availableTenants} returnTo={returnTo ?? "/"} />
    </div>
  )
}
