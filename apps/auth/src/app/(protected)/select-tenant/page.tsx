import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { UserRepo } from "@repo/db"
import { TenantRepo } from "@repo/db"
import SelectTenantClient from "./SelectTenantClient"

export default async function SelectTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>
}) {
  const { return_to: returnTo } = await searchParams
  const hdrs = await headers()
  const userId = hdrs.get("x-user-id")

  if (!userId) {
    redirect("/login")
  }

  const userTenants = await UserRepo.getUserTenants(userId)
  const activeTenants = userTenants.filter((ut) => ut.status === "active")

  if (activeTenants.length === 0) {
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
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Selecione a empresa</h1>
      <p className="text-sm text-gray-500 mb-8">
        Escolha com qual empresa você deseja acessar agora.
      </p>
      <SelectTenantClient tenants={availableTenants} returnTo={returnTo ?? "/"} />
    </div>
  )
}
