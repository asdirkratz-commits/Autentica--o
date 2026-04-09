import { TenantRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  ativo: "text-green-700 bg-green-100",
  inadimplente: "text-yellow-700 bg-yellow-100",
  inativo: "text-gray-600 bg-gray-100",
  bloqueado: "text-red-700 bg-red-100",
}

export default async function DashboardPage() {
  await requireMasterGlobal()

  const allTenants = await TenantRepo.listAll()

  const stats = {
    total: allTenants.length,
    ativos: allTenants.filter((t) => t.status === "ativo").length,
    inadimplentes: allTenants.filter((t) => t.status === "inadimplente").length,
    bloqueados: allTenants.filter((t) => t.status === "bloqueado").length,
    inativos: allTenants.filter((t) => t.status === "inativo").length,
  }

  const recentTenants = allTenants.slice(-5).reverse()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do ecossistema</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total de Empresas", value: stats.total, color: "text-gray-900" },
          { label: "Ativas", value: stats.ativos, color: "text-green-700" },
          { label: "Inadimplentes", value: stats.inadimplentes, color: "text-yellow-700" },
          { label: "Bloqueadas", value: stats.bloqueados, color: "text-red-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Empresas recentes */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Empresas Recentes</h2>
          <Link href="/tenants" className="text-xs text-brand-600 hover:underline">
            Ver todas →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recentTenants.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">
              Nenhuma empresa cadastrada ainda.
            </p>
          )}
          {recentTenants.map((t) => (
            <Link
              key={t.id}
              href={`/tenants/${t.id}`}
              className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-400">{t.slug}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {t.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
