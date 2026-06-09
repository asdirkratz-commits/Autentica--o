"use client"

import { useState, FormEvent } from "react"
import Link from "next/link"
import { TextField, SubmitButton } from "@repo/ui"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        setError(data.message ?? "Erro ao processar solicitação")
        return
      }

      setSubmitted(true)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="auth-status">
        <div className="auth-status__icon auth-status__icon--success">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="auth-heading">Verifique seu e-mail</h1>
        <p className="auth-subtitle">
          Se o endereço <strong>{email}</strong> estiver cadastrado, você receberá as instruções de recuperação em breve.
        </p>
        <Link href="/login" className="auth-link">Voltar para o login</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="auth-heading">Recuperar senha</h1>
      <p className="auth-subtitle">
        Informe seu e-mail e enviaremos as instruções para redefinir sua senha.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
        <TextField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
        />

        {error && <div className="alert alert--danger">{error}</div>}

        <SubmitButton loading={loading} loadingText="Enviando...">
          Enviar instruções
        </SubmitButton>
      </form>

      <p className="auth-footnote">
        Lembrou a senha?{" "}
        <Link href="/login" className="auth-link">Entrar</Link>
      </p>
    </div>
  )
}
