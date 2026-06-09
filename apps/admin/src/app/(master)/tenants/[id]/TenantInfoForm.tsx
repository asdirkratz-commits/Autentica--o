"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Props = {
  tenantId: string
  initial: {
    cnpj?: string | null
    zipCode?: string | null
    street?: string | null
    streetNumber?: string | null
    complement?: string | null
    district?: string | null
    city?: string | null
    state?: string | null
  }
}

function fmtCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function fmtCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export default function TenantInfoForm({ tenantId, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [cnpj, setCnpj] = useState(initial.cnpj ?? "")
  const [zipCode, setZipCode] = useState(initial.zipCode ?? "")
  const [street, setStreet] = useState(initial.street ?? "")
  const [streetNumber, setStreetNumber] = useState(initial.streetNumber ?? "")
  const [complement, setComplement] = useState(initial.complement ?? "")
  const [district, setDistrict] = useState(initial.district ?? "")
  const [city, setCity] = useState(initial.city ?? "")
  const [state, setState] = useState(initial.state ?? "")

  const [cepLoading, setCepLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function fetchCep(raw: string) {
    const digits = raw.replace(/\D/g, "")
    if (digits.length !== 8) return
    setCepLoading(true)
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
      if (data.logradouro) setStreet(data.logradouro)
      if (data.bairro) setDistrict(data.bairro)
      if (data.localidade) setCity(data.localidade)
      if (data.uf) setState(data.uf)
    } finally {
      setCepLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj, zipCode, street, streetNumber, complement, district, city, state }),
      })

      let data: { message?: string } = {}
      try { data = (await res.json()) as { message?: string } } catch { /* noop */ }

      if (!res.ok) {
        setError(data.message ?? `Erro ${res.status}`)
        return
      }

      setSuccess(true)
      setOpen(false)
      router.refresh()
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const hasData = initial.cnpj || initial.city || initial.street

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="portal-link" style={{ marginTop: "var(--space-3)" }}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
        </svg>
        {hasData ? "Editar CNPJ / Endereço" : "Adicionar CNPJ / Endereço"}
      </button>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid #f3f4f6" }}>
      <p className="portal-section-label">CNPJ &amp; endereço</p>

      <div className="form-field">
        <label htmlFor="info-cnpj" className="label">CNPJ</label>
        <input id="info-cnpj" type="text" inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(fmtCnpj(e.target.value))} placeholder="00.000.000/0000-00" className="input input--mono" />
      </div>

      <div className="form-field">
        <label htmlFor="info-cep" className="label">CEP {cepLoading && <span style={{ color: "var(--k-color-secondary)" }}>buscando...</span>}</label>
        <input id="info-cep" type="text" inputMode="numeric" value={zipCode} onChange={(e) => setZipCode(fmtCep(e.target.value))} onBlur={(e) => void fetchCep(e.target.value)} placeholder="00000-000" className="input input--mono" />
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: "1fr 80px", marginBottom: "var(--space-4)" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="info-street" className="label">Logradouro</label>
          <input id="info-street" type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, Av..." className="input" />
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="info-num" className="label">Nº</label>
          <input id="info-num" type="text" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} placeholder="123" className="input" />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="info-complement" className="label">Complemento</label>
        <input id="info-complement" type="text" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Sala, Andar..." className="input" />
      </div>

      <div className="form-field">
        <label htmlFor="info-district" className="label">Bairro</label>
        <input id="info-district" type="text" value={district} onChange={(e) => setDistrict(e.target.value)} className="input" />
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: "1fr 96px", marginBottom: "var(--space-4)" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="info-city" className="label">Cidade</label>
          <input id="info-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input" />
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="info-uf" className="label">UF</label>
          <input id="info-uf" type="text" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SC" maxLength={2} className="input input--mono" style={{ textAlign: "center", textTransform: "uppercase" }} />
        </div>
      </div>

      {error && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: "var(--space-3)" }}>Salvo com sucesso.</div>}

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button type="submit" disabled={loading} className="btn btn--primary btn--block btn--sm">
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null) }} className="btn btn--ghost btn--sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
