"use client"

import { Suspense, useState, FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { TextField, SubmitButton } from "@repo/ui"
import { safeReturnTo } from "@/lib/safe-redirect"

type Tenant = { tenantId: string; role: string; name: string; slug: string }

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get("return_to")) ?? "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tenants, setTenants] = useState<Tenant[] | null>(null)

  async function handleSubmit(e: FormEvent, tenantId?: string) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenantId }),
      })

      const data = (await res.json()) as {
        ok?: boolean
        requiresTenantSelection?: boolean
        tenants?: Tenant[]
        message?: string
      }

      if (!res.ok) {
        setError(data.message ?? "Credenciais inválidas")
        return
      }

      if (data.requiresTenantSelection && data.tenants) {
        setTenants(data.tenants)
        return
      }

      router.push(returnTo)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (tenants) {
    return (
      <div>
        <h1 className="auth-heading">Selecione a empresa</h1>
        <p className="auth-subtitle">Sua conta está vinculada a múltiplas empresas.</p>

        <div>
          {tenants.map((t) => (
            <button
              key={t.tenantId}
              type="button"
              onClick={(e) => void handleSubmit(e as unknown as FormEvent, t.tenantId)}
              disabled={loading}
              className="tenant-option"
            >
              <span className="min-w-0">
                <span className="tenant-option__name">{t.name}</span>
                <span className="tenant-option__slug">{t.slug}</span>
              </span>
              <span className="tenant-option__role">{t.role}</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={() => setTenants(null)} className="auth-footnote auth-link" style={{ background: "none", border: "none", cursor: "pointer" }}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="auth-heading">Entrar na sua conta</h1>
      <p className="auth-subtitle">Bem-vindo de volta ao ecossistema.</p>

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

        <TextField
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          labelAccessory={
            <Link href="/forgot-password" className="auth-link" style={{ fontSize: 12 }}>
              Esqueceu a senha?
            </Link>
          }
        />

        {error && <div className="alert alert--danger">{error}</div>}

        <SubmitButton loading={loading} loadingText="Entrando...">
          Entrar
        </SubmitButton>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
