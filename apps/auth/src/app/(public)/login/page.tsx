"use client"

import { Suspense, useState, FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

type Tenant = { tenantId: string; role: string; name: string; slug: string }

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("return_to") ?? "/"

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
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Selecione a empresa</h2>
        <p className="text-sm text-gray-500 mb-6">
          Sua conta está vinculada a múltiplas empresas.
        </p>
        <div className="space-y-2">
          {tenants.map((t) => (
            <button
              key={t.tenantId}
              onClick={(e) => {
                void handleSubmit(e as unknown as FormEvent, t.tenantId)
              }}
              disabled={loading}
              className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition-colors text-left disabled:opacity-50"
            >
              <div className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">
                  {t.name}
                </span>
                <span className="block text-xs text-gray-400 truncate">{t.slug}</span>
              </div>
              <span className="ml-2 text-xs text-gray-400 capitalize shrink-0">{t.role}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setTenants(null)}
          className="mt-4 text-sm text-brand-600 hover:underline"
        >
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Entrar na sua conta</h2>
      <p className="text-sm text-gray-500 mb-6">
        Bem-vindo de volta ao ecossistema.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Senha
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-brand-600 hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "Entrando..." : "Entrar"}
        </button>
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
