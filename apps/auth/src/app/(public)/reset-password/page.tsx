"use client"

import { Suspense, useState, FormEvent } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError("As senhas não coincidem.")
      return
    }

    if (!token) {
      setError("Token inválido. Solicite um novo link de recuperação.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = (await res.json()) as { message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao redefinir senha")
        return
      }

      router.push("/login?reset=success")
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Link inválido</h2>
        <p className="text-sm text-gray-500 mb-6">
          Este link de recuperação é inválido ou expirou.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-brand-600 hover:underline"
        >
          Solicitar novo link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Redefinir senha</h2>
      <p className="text-sm text-gray-500 mb-6">
        Crie uma nova senha para sua conta. Mínimo 8 caracteres, com maiúscula, número e símbolo.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nova senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirmar nova senha
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Salvando..." : "Redefinir senha"}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
