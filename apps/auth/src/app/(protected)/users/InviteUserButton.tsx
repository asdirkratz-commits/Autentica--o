"use client"

import { useState, FormEvent } from "react"
import { TextField, SubmitButton } from "@repo/ui"

const PERMISSIONS = [
  { key: "can_invite_users", label: "Convidar usuários" },
  { key: "can_manage_users", label: "Gerenciar usuários" },
  { key: "can_view_reports", label: "Ver relatórios" },
  { key: "can_export_data", label: "Exportar dados" },
] as const

type PermKey = (typeof PERMISSIONS)[number]["key"]

const EMPTY = {
  email: "",
  fullName: "",
  password: "",
  can_invite_users: false,
  can_manage_users: false,
  can_view_reports: false,
  can_export_data: false,
}

export default function InviteUserButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Cadastro direto (o backend define a senha na hora — sem e-mail de convite).
      const res = await fetch("/api/tenant/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          role: "user",
          permissions: {
            can_invite_users: form.can_invite_users,
            can_manage_users: form.can_manage_users,
            can_view_reports: form.can_view_reports,
            can_export_data: form.can_export_data,
          },
        }),
      })

      const data = (await res.json()) as { ok?: boolean; message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao cadastrar usuário.")
        return
      }

      setDone(true)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setError(null)
    setDone(false)
    setForm({ ...EMPTY })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn--primary">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Adicionar usuário
      </button>

      {open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <span className="modal__title">{done ? "Usuário cadastrado" : "Adicionar usuário"}</span>
              <button type="button" onClick={handleClose} className="modal__close" aria-label="Fechar">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal__body">
              {done ? (
                <div className="auth-status">
                  <div className="auth-status__icon auth-status__icon--success">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="auth-subtitle">
                    Usuário cadastrado e ativado nesta empresa. Compartilhe o e-mail e a senha
                    definidos para que ele acesse o sistema.
                  </p>
                  <button type="button" onClick={handleClose} className="btn btn--primary btn--block">
                    Concluir
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
                  <TextField
                    id="invite-email"
                    label={<>E-mail <span className="required">*</span></>}
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="usuario@empresa.com"
                  />
                  <TextField
                    id="invite-name"
                    label={<>Nome completo <span className="required">*</span></>}
                    name="fullName"
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Nome do usuário"
                  />
                  <TextField
                    id="invite-password"
                    label={<>Senha inicial <span className="required">*</span></>}
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    hint="Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo."
                  />

                  <div className="form-field">
                    <span className="label">Permissões</span>
                    {PERMISSIONS.map((perm) => (
                      <label key={perm.key} className="check-row">
                        <input
                          type="checkbox"
                          checked={form[perm.key]}
                          onChange={(e) => setForm((p) => ({ ...p, [perm.key as PermKey]: e.target.checked }))}
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>

                  {error && <div className="alert alert--danger">{error}</div>}

                  <div className="modal__actions">
                    <SubmitButton loading={loading} loadingText="Cadastrando...">
                      Cadastrar usuário
                    </SubmitButton>
                    <button type="button" onClick={handleClose} className="btn btn--ghost">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
