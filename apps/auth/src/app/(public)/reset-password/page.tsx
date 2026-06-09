"use client"

import { Suspense, useState, FormEvent } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { TextField, SubmitButton } from "@repo/ui"

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
      <div className="auth-status">
        <div className="auth-status__icon auth-status__icon--danger">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="auth-heading">Link inválido</h1>
        <p className="auth-subtitle">Este link de recuperação é inválido ou expirou.</p>
        <Link href="/forgot-password" className="auth-link">Solicitar novo link</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="auth-heading">Redefinir senha</h1>
      <p className="auth-subtitle">
        Crie uma nova senha para sua conta. Mínimo 8 caracteres, com maiúscula, número e símbolo.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
        <TextField
          id="password"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <TextField
          id="confirm"
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />

        {error && <div className="alert alert--danger">{error}</div>}

        <SubmitButton loading={loading} loadingText="Salvando...">
          Redefinir senha
        </SubmitButton>
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
