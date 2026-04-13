"use client"

import { useState, FormEvent } from "react"

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
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-5">Alterar senha</h2>

      <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Senha atual
          </label>
          <input
            id="currentPassword"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Nova senha
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">
            Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo.
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {message && (
          <div className={`rounded-lg px-3 py-2 text-sm border ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Salvando..." : "Alterar senha"}
        </button>
      </form>
    </div>
  )
}
