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

    let processed = value
    if (name === "cnpj") processed = formatCnpj(value)
    if (name === "zipCode") processed = formatZip(value)

    setForm((prev) => ({ ...prev, [name]: processed }))

    if (name === "name") {
      const slug = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
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
        logoUrl:       form.logoUrl.trim()       || undefined,
        internalNotes: form.internalNotes.trim() || undefined,
        cnpj:          form.cnpj.trim()          || undefined,
        zipCode:       form.zipCode.trim()       || undefined,
        street:        form.street.trim()        || undefined,
        streetNumber:  form.streetNumber.trim()  || undefined,
        complement:    form.complement.trim()    || undefined,
        district:      form.district.trim()      || undefined,
        city:          form.city.trim()          || undefined,
        state:         form.state.trim()         || undefined,
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
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Link href="/tenants" className="portal-link" aria-label="Voltar">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="portal-greeting">Nova empresa</h1>
          <p className="portal-greeting-sub">Cadastrar nova empresa no ecossistema.</p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Identificação */}
        <section className="card">
          <p className="portal-section-label">Identificação</p>

          <div className="form-field">
            <label htmlFor="name" className="label">Nome da empresa <span className="required">*</span></label>
            <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} placeholder="Escritório Silva & Associados" className="input" />
          </div>

          <div className="form-field">
            <label htmlFor="slug" className="label">Slug <span className="required">*</span></label>
            <input id="slug" name="slug" type="text" required value={form.slug} onChange={handleChange} placeholder="escritorio-silva" pattern="[a-z0-9-]+" className="input input--mono" />
            <p className="auth-hint">Apenas letras minúsculas, números e hífens.</p>
          </div>

          <div className="form-grid form-grid--2" style={{ marginBottom: 0 }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="cnpj" className="label">CNPJ</label>
              <input id="cnpj" name="cnpj" type="text" value={form.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" maxLength={18} className="input input--mono" />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="plan" className="label">Plano</label>
              <select id="plan" name="plan" value={form.plan} onChange={handleChange} className="select">
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
        </section>

        {/* Endereço */}
        <section className="card">
          <p className="portal-section-label">Endereço</p>

          <div className="form-grid form-grid--3">
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="zipCode" className="label">CEP</label>
              <div style={{ position: "relative" }}>
                <input id="zipCode" name="zipCode" type="text" value={form.zipCode} onChange={handleChange} onBlur={() => void handleCepBlur()} placeholder="00000-000" maxLength={9} className="input input--mono" />
                {loadingCep && (
                  <div style={{ position: "absolute", right: 8, top: 10 }}>
                    <svg className="w-4 h-4 animate-spin" style={{ color: "#9ca3af" }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="auth-hint">Preenchimento automático ao sair do campo.</p>
            </div>
            <div className="form-field" style={{ marginBottom: 0, gridColumn: "span 2" }}>
              <label htmlFor="street" className="label">Logradouro</label>
              <input id="street" name="street" type="text" value={form.street} onChange={handleChange} placeholder="Rua, Avenida, Travessa…" className="input" />
            </div>
          </div>

          <div className="form-grid form-grid--3" style={{ marginTop: "var(--space-4)" }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="streetNumber" className="label">Número</label>
              <input id="streetNumber" name="streetNumber" type="text" value={form.streetNumber} onChange={handleChange} placeholder="123" className="input" />
            </div>
            <div className="form-field" style={{ marginBottom: 0, gridColumn: "span 2" }}>
              <label htmlFor="complement" className="label">Complemento</label>
              <input id="complement" name="complement" type="text" value={form.complement} onChange={handleChange} placeholder="Sala 5, Andar 3…" className="input" />
            </div>
          </div>

          <div className="form-grid form-grid--3" style={{ marginTop: "var(--space-4)" }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="district" className="label">Bairro</label>
              <input id="district" name="district" type="text" value={form.district} onChange={handleChange} placeholder="Centro" className="input" />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="city" className="label">Cidade</label>
              <input id="city" name="city" type="text" value={form.city} onChange={handleChange} placeholder="São Paulo" className="input" />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="state" className="label">UF</label>
              <input id="state" name="state" type="text" value={form.state} onChange={handleChange} placeholder="SP" maxLength={2} className="input input--mono" style={{ textTransform: "uppercase" }} />
            </div>
          </div>
        </section>

        {/* Identidade visual */}
        <section className="card">
          <p className="portal-section-label">Identidade visual</p>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="logoUrl" className="label">URL da logomarca</label>
            <input id="logoUrl" name="logoUrl" type="url" value={form.logoUrl} onChange={handleChange} placeholder="https://exemplo.com/logo.png" className="input" />
            {form.logoUrl && (
              <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logoUrl} alt="Pré-visualização" style={{ height: 40, width: 40, borderRadius: "var(--radius-sm)", objectFit: "contain", border: "1px solid #e5e7eb", background: "#f9fafb" }} onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none" }} />
                <span className="auth-hint" style={{ marginTop: 0 }}>Pré-visualização</span>
              </div>
            )}
            <p className="auth-hint">URL pública da imagem (PNG, JPG ou SVG).</p>
          </div>
        </section>

        {/* Notas internas */}
        <section className="card">
          <p className="portal-section-label">Notas internas</p>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <textarea id="internalNotes" name="internalNotes" rows={3} value={form.internalNotes} onChange={handleChange} placeholder="Observações visíveis apenas ao master global..." aria-label="Notas internas" className="textarea" />
          </div>
        </section>

        {error && <div className="alert alert--danger">{error}</div>}

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="submit" disabled={loading} className="btn btn--primary btn--block">
            {loading ? "Criando..." : "Criar empresa"}
          </button>
          <Link href="/tenants" className="btn btn--ghost">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
