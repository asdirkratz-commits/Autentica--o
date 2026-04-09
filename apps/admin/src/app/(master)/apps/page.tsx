import { AppRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"

export default async function AppsPage() {
  await requireMasterGlobal()

  const allApps = await AppRepo.listAll()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Apps</h1>
        <p className="text-sm text-gray-500 mt-1">Catálogo de aplicativos do ecossistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allApps.length === 0 && (
          <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
            Nenhum app cadastrado. Execute o seed para inserir os apps iniciais.
          </div>
        )}
        {allApps.map((app) => (
          <div
            key={app.id}
            className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <span className="text-brand-700 font-bold text-sm uppercase">
                  {app.name.charAt(0)}
                </span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  app.active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {app.active ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div>
              <p className="font-semibold text-gray-800">{app.displayName}</p>
              <p className="text-xs text-gray-400 font-mono">{app.name}</p>
              {app.description && (
                <p className="text-xs text-gray-500 mt-1">{app.description}</p>
              )}
            </div>

            <div className="text-xs text-gray-400 truncate" title={app.baseUrl}>
              {app.baseUrl}
            </div>

            <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
              <span className="font-mono">{app.env}</span>
              <span className="mx-2">·</span>
              <span>API Key: {app.apiKey.slice(0, 8)}…</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
