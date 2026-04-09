import { TenantRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  ativo: "text-green-700 bg-green-100",
  inadimplente: "text-yellow-700 bg-yellow-100",
  inativo: "text-gray-600 bg-gray-100",
  bloqueado: "text-red-700 bg-red-100",
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireMasterGlobal()
  const { status } = await searchParams

  const validStatuses = ["ativo", "inativo", "inadimplente", "bloqueado"] as const
  type TenantStatus = typeof validStatuses[number]
  const filterStatus = validStatuses.includes(status as TenantStatus)
    ? (status as TenantStatus)
    : undefined

  const tenants = await TenantRepo.listAll(filterStatus ? { status: filterStatus } : undefined)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-1">{tenants.length} empresa(s) encontrada(s)</p>
        </div>
        <Link
          href="/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova empresa
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {[
          { label: "Todas", value: "" },
          { label: "Ativas", value: "ativo" },
          { label: "Inadimplentes", value: "inadimplente" },
          { label: "Bloqueadas", value: "bloqueado" },
          { label: "Inativas", value: "inativo" },
        ].map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/tenants?status=${f.value}` : "/tenants"}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (filterStatus ?? "") === f.value
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-400"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Empresa</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plano</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criada em</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                  Nenhuma empresa encontrada.
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.slug}</p>
                </td>
                <td className="px-6 py-4 text-gray-600 capitalize">{t.plan}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/tenants/${t.id}`}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
