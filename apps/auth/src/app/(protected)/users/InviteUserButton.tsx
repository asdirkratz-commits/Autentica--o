"use client"

import { useState, FormEvent } from "react"

type Props = {
  actorRole: string
}

export default function InviteUserButton({ actorRole }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: "",
    role: "user" as "admin" | "user",
    can_invite_users: false,
    can_manage_users: false,
    can_view_reports: false,
    can_export_data: false,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = e.target
    const value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value
    setForm((prev) => ({ ...prev, [target.name]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInviteLink(null)

    try {
      const res = await fetch("/api/tenant/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          role: form.role,
          permissions: {
            can_invite_users: form.can_invite_users,
            can_manage_users: form.can_manage_users,
            can_view_reports: form.can_view_reports,
            can_export_data: form.can_export_data,
          },
        }),
      })

      const data = (await res.json()) as {
        ok?: boolean
        data?: { inviteLink: string }
        message?: string
      }

      if (!res.ok) {
        setError(data.message ?? "Erro ao enviar convite.")
        return
      }

      setInviteLink(data.data?.inviteLink ?? null)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setError(null)
    setInviteLink(null)
    setForm({
      email: "",
      role: "user",
      can_invite_users: false,
      can_manage_users: false,
      can_view_reports: false,
      can_export_data: false,
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Convidar usuário
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            {inviteLink ? (
              <div>
                <div className="mb-4 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Convite gerado!</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Copie e envie o link abaixo para o usuário. Ele expira em 48 horas.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all mb-4">
                  {inviteLink}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => void navigator.clipboard.writeText(inviteLink)}
                    className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Copiar link
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 py-2 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold text-gray-900">Convidar usuário</h3>
                  <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                  <div>
                    <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                      E-mail <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="invite-email"
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      placeholder="usuario@empresa.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
                      Função
                    </label>
                    <select
                      id="invite-role"
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    >
                      {actorRole === "owner" && <option value="admin">Administrador</option>}
                      <option value="user">Usuário</option>
                    </select>
                  </div>

                  {form.role === "user" && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Permissões</p>
                      <div className="space-y-2">
                        {[
                          { key: "can_invite_users", label: "Convidar usuários" },
                          { key: "can_manage_users", label: "Gerenciar usuários" },
                          { key: "can_view_reports", label: "Ver relatórios" },
                          { key: "can_export_data", label: "Exportar dados" },
                        ].map((perm) => (
                          <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              name={perm.key}
                              checked={form[perm.key as keyof typeof form] as boolean}
                              onChange={handleChange}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="text-sm text-gray-600">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? "Enviando..." : "Gerar convite"}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
