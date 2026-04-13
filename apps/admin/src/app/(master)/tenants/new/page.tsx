"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type FormState = {
  name: string
  slug: string
  plan: string
  logoUrl: string
  internalNotes: string
  cnpj: string
  zipCode: string
  street: string
  streetNumber: string
  complement: string
  district: string
  city: string
  state: string
  country: string
}

const INITIAL: FormState = {
  name: "", slug: "", plan: "basic", logoUrl: "", internalNotes: "",
  cnpj: "", zipCode: "", street: "", streetNumber: "", complement: "",
  district: "", city: "", state: "", country: "BR",
}

/** Formata CNPJ enquanto o usuário digita: XX.XXX.XXX/XXXX-XX */
function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

/** Formata CEP enquanto o usuário digita: XXXXX-XXX */
function formatZip(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, "$1-$2")
}

export default function NewTenantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target

    // Formatação em tempo real
    let processed = value
    if (name === "cnpj") processed = formatCnpj(value)
    if (name === "zipCode") processed = formatZip(value)

    setForm((prev) => ({ ...prev, [name]: processed }))

    // Auto-gerar slug a partir do nome
    if (name === "name") {
      const slug = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      setForm((prev) => ({ ...prev, name: value, slug }))
    }
  }

  /** Busca endereço pelo CEP na API ViaCEP */
  async function handleCepBlur() {
    const digits = form.zipCode.replace(/\D/g, "")
    if (digits.length !== 8) return

    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) return

      const data = (await res.json()) as {
        erro?: boolean
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
      }

      if (data.erro) return

      setForm((prev) => ({
        ...prev,
        street:   data.logradouro ?? prev.street,
        district: data.bairro     ?? prev.district,
        city:     data.localidade ?? prev.city,
        state:    data.uf         ?? prev.state,
      }))
    } catch {
      // silencia erros de rede — usuário preenche manualmente
    } finally {
      setLoadingCep(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...form,
        logoUrl:      form.logoUrl.trim()      || undefined,
        internalNotes: form.internalNotes.trim() || undefined,
        cnpj:         form.cnpj.trim()         || undefined,
        zipCode:      form.zipCode.trim()       || undefined,
        street:       form.street.trim()        || undefined,
        streetNumber: form.streetNumber.trim()  || undefined,
        complement:   form.complement.trim()    || undefined,
        district:     form.district.trim()      || undefined,
        city:         form.city.trim()          || undefined,
        state:        form.state.trim()         || undefined,
      }

      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = (await res.json()) as { id?: string; message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao criar empresa")
        return
      }

      router.push(`/tenants/${data.id}`)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tenants" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Nova empresa</h1>
          <p className="text-sm text-gray-500">Cadastrar nova empresa no ecossistema</p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* ─── Identificação ─────────────────────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Identificação</h2>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da empresa <span className="text-red-500">*</span>
            </label>
            <input
              id="name" name="name" type="text" required
              value={form.name} onChange={handleChange}
              placeholder="Escritório Silva & Associados"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              id="slug" name="slug" type="text" required
              value={form.slug} onChange={handleChange}
              placeholder="escritorio-silva"
              pattern="[a-z0-9-]+"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Apenas letras minúsculas, números e hífens.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ
              </label>
              <input
                id="cnpj" name="cnpj" type="text"
                value={form.cnpj} onChange={handleChange}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
              />
            </div>

            <div>
              <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
                Plano
              </label>
              <select
                id="plan" name="plan"
                value={form.plan} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
        </section>

        {/* ─── Endereço ──────────────────────────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Endereço</h2>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                CEP
              </label>
              <div className="relative">
                <input
                  id="zipCode" name="zipCode" type="text"
                  value={form.zipCode} onChange={handleChange} onBlur={() => void handleCepBlur()}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
                />
                {loadingCep && (
                  <div className="absolute right-2 top-2.5">
                    <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">Preenchimento automático ao sair do campo.</p>
            </div>

            <div className="col-span-2">
              <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                Logradouro
              </label>
              <input
                id="street" name="street" type="text"
                value={form.street} onChange={handleChange}
                placeholder="Rua, Avenida, Travessa…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="streetNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Número
              </label>
              <input
                id="streetNumber" name="streetNumber" type="text"
                value={form.streetNumber} onChange={handleChange}
                placeholder="123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="complement" className="block text-sm font-medium text-gray-700 mb-1">
                Complemento
              </label>
              <input
                id="complement" name="complement" type="text"
                value={form.complement} onChange={handleChange}
                placeholder="Sala 5, Andar 3…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">
                Bairro
              </label>
              <input
                id="district" name="district" type="text"
                value={form.district} onChange={handleChange}
                placeholder="Centro"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                Cidade
              </label>
              <input
                id="city" name="city" type="text"
                value={form.city} onChange={handleChange}
                placeholder="São Paulo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                UF
              </label>
              <input
                id="state" name="state" type="text"
                value={form.state} onChange={handleChange}
                placeholder="SP"
                maxLength={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent uppercase font-mono"
              />
            </div>
          </div>
        </section>

        {/* ─── Identidade visual ─────────────────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Identidade visual</h2>

          <div>
            <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
              URL da Logo Marca
            </label>
            <input
              id="logoUrl" name="logoUrl" type="url"
              value={form.logoUrl} onChange={handleChange}
              placeholder="https://exemplo.com/logo.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {form.logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logoUrl} alt="Pré-visualização"
                  className="h-10 w-10 rounded object-contain border border-gray-200 bg-gray-50"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
                <span className="text-xs text-gray-400">Pré-visualização</span>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">URL pública da imagem (PNG, JPG ou SVG).</p>
          </div>
        </section>

        {/* ─── Notas internas ────────────────────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Notas internas</h2>
          <div>
            <textarea
              id="internalNotes" name="internalNotes" rows={3}
              value={form.internalNotes} onChange={handleChange}
              placeholder="Observações visíveis apenas ao master global..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>
        </section>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit" disabled={loading}
            className="flex-1 py-2.5 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Criando..." : "Criar empresa"}
          </button>
          <Link
            href="/tenants"
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
