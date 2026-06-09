"use client"

import { Suspense, useState, FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { TextField, SubmitButton } from "@repo/ui"

function AcceptInviteForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError("Token de convite inválido ou ausente.")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, fullName }),
      })

      const data = (await res.json()) as { ok?: boolean; message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao aceitar convite.")
        return
      }

      setSuccess(true)
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
        <p className="auth-subtitle">
          O link de convite é inválido ou expirou. Solicite um novo convite ao administrador.
        </p>
        <Link href="/login" className="auth-link">Ir para o login</Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-status">
        <div className="auth-status__icon auth-status__icon--success">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="auth-heading">Conta ativada!</h1>
        <p className="auth-subtitle">
          Sua conta foi ativada com sucesso. Faça login para acessar o sistema.
        </p>
        <Link href="/login" className="btn btn--primary">Ir para o login</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="auth-heading">Aceitar convite</h1>
      <p className="auth-subtitle">
        Defina sua senha para ativar sua conta no ecossistema.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
        <TextField
          id="fullName"
          label="Nome completo"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Seu nome completo"
        />

        <TextField
          id="password"
          label={<>Senha <span className="required">*</span></>}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          hint="Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo."
        />

        <TextField
          id="confirmPassword"
          label={<>Confirmar senha <span className="required">*</span></>}
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && <div className="alert alert--danger">{error}</div>}

        <SubmitButton loading={loading} loadingText="Ativando conta...">
          Ativar conta
        </SubmitButton>
      </form>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  )
}
