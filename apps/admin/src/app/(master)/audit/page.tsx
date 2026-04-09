import { AuditRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"

const ACTION_COLORS: Record<string, string> = {
  "auth.login": "bg-blue-100 text-blue-700",
  "auth.login_failed": "bg-red-100 text-red-700",
  "auth.logout": "bg-gray-100 text-gray-600",
  "tenant.blocked": "bg-red-100 text-red-700",
  "tenant.status_changed": "bg-yellow-100 text-yellow-700",
  "tenant.created": "bg-green-100 text-green-700",
  "user.created": "bg-green-100 text-green-700",
  "user.invited": "bg-blue-100 text-blue-700",
  "user.activated": "bg-green-100 text-green-700",
  "user.deactivated": "bg-red-100 text-red-700",
  "webhook.received": "bg-purple-100 text-purple-700",
  "webhook.processed": "bg-purple-100 text-purple-700",
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>
}) {
  await requireMasterGlobal()
  const { action, page } = await searchParams

  const offset = Math.max(0, (parseInt(page ?? "1") - 1) * 50)

  const logs = await AuditRepo.list({
    action: action as Parameters<typeof AuditRepo.list>[0]["action"],
    limit: 50,
    offset,
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Trilha de Auditoria</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro imutável de todas as ações sensíveis do sistema
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          {logs.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-gray-400">
              Nenhum registro de auditoria encontrado.
            </p>
          )}
          {logs.map((log) => (
            <div key={log.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 ${
                      ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {log.action}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">
                      <span className="font-mono text-gray-700">{log.userId}</span>
                      {" → "}
                      <span className="text-gray-600">{log.targetType}</span>
                      {" "}
                      <span className="font-mono text-gray-700 truncate">{log.targetId}</span>
                    </p>
                    {log.ipAddress && (
                      <p className="text-xs text-gray-400 mt-0.5">IP: {log.ipAddress}</p>
                    )}
                    {Object.keys(log.metadata as object).length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          ))}
        </div>

        {logs.length === 50 && (
          <div className="px-6 py-3 border-t border-gray-100 text-center">
            <a
              href={`/audit?page=${parseInt(page ?? "1") + 1}`}
              className="text-xs text-brand-600 hover:underline"
            >
              Próxima página →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
