import { AppRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"

export default async function AppsPage() {
  await requireMasterGlobal()

  const allApps = await AppRepo.listAll()

  // Separar apps raiz dos módulos filhos
  const topLevel = allApps.filter((a) => !a.parentAppId)
  const childrenByParent = new Map<string, typeof allApps>()
  for (const app of allApps) {
    if (app.parentAppId) {
      const list = childrenByParent.get(app.parentAppId) ?? []
      list.push(app)
      childrenByParent.set(app.parentAppId, list)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Apps</h1>
        <p className="text-sm text-gray-500 mt-1">Catálogo de aplicativos do ecossistema</p>
      </div>

      {allApps.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          Nenhum app cadastrado. Execute o seed para inserir os apps iniciais.
        </div>
      )}

      <div className="space-y-4">
        {topLevel.map((app) => {
          const children = childrenByParent.get(app.id) ?? []

          return (
            <div
              key={app.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              {/* App pai */}
              <div className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-brand-700 font-bold text-sm uppercase">
                    {app.name.charAt(0)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-gray-800">{app.displayName}</p>
                    <span className="text-xs font-mono text-gray-400">{app.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        app.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {app.active ? "Ativo" : "Inativo"}
                    </span>
                    {children.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                        {children.length} módulo{children.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {app.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{app.description}</p>
                  )}

                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span className="truncate">{app.baseUrl}</span>
                    <span>·</span>
                    <span className="font-mono">{app.env}</span>
                    <span>·</span>
                    <span>API Key: {app.apiKey.slice(0, 8)}…</span>
                  </div>
                </div>
              </div>

              {/* Módulos filhos */}
              {children.length > 0 && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {children.map((child) => (
                    <div
                      key={child.id}
                      className="px-5 py-3 flex items-center gap-4 bg-gray-50/60"
                    >
                      <div className="w-2 h-2 rounded-full bg-gray-300 ml-4 shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-medium text-gray-700">{child.displayName}</p>
                          <span className="text-xs font-mono text-gray-400">{child.name}</span>
                          <span
                            className={`text-xs px-1.5 py-px rounded-full font-medium ${
                              child.active
                                ? "bg-green-100 text-green-600"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {child.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        {child.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{child.description}</p>
                        )}
                        <p className="text-xs text-gray-400 truncate mt-0.5">{child.baseUrl}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
