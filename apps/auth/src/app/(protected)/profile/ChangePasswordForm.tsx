"use client"

import { useState, FormEvent } from "react"
import { TextField, SubmitButton } from "@repo/ui"

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." })
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = (await res.json()) as { message?: string }

      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Erro ao alterar senha." })
        return
      }

      setMessage({ type: "success", text: "Senha alterada com sucesso." })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setMessage({ type: "error", text: "Erro de conexão. Tente novamente." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <p className="portal-section-label">Alterar senha</p>

      <form onSubmit={(e) => void handlePasswordChange(e)} className="auth-form">
        <TextField
          id="currentPassword"
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <TextField
          id="newPassword"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint="Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo."
        />
        <TextField
          id="confirmPassword"
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {message && (
          <div className={`alert ${message.type === "success" ? "alert--success" : "alert--danger"}`}>
            {message.text}
          </div>
        )}

        <SubmitButton loading={loading} loadingText="Salvando...">
          Alterar senha
        </SubmitButton>
      </form>
    </div>
  )
}
