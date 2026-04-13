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
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left text-xs text-brand-600 hover:text-brand-700 font-medium mt-2 flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
        </svg>
        {hasData ? "Editar CNPJ / Endereço" : "Adicionar CNPJ / Endereço"}
      </button>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-600">CNPJ &amp; Endereço</p>

      {/* CNPJ */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">CNPJ</label>
        <input
          type="text"
          inputMode="numeric"
          value={cnpj}
          onChange={(e) => setCnpj(fmtCnpj(e.target.value))}
          placeholder="00.000.000/0000-00"
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* CEP */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          CEP
          {cepLoading && <span className="ml-1 text-brand-500">buscando...</span>}
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={zipCode}
          onChange={(e) => setZipCode(fmtCep(e.target.value))}
          onBlur={(e) => void fetchCep(e.target.value)}
          placeholder="00000-000"
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Logradouro + número */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Logradouro</label>
          <input
            type="text"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Rua, Av..."
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="w-20">
          <label className="block text-xs text-gray-500 mb-1">Nº</label>
          <input
            type="text"
            value={streetNumber}
            onChange={(e) => setStreetNumber(e.target.value)}
            placeholder="123"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Complemento */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Complemento</label>
        <input
          type="text"
          value={complement}
          onChange={(e) => setComplement(e.target.value)}
          placeholder="Sala, Andar..."
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Bairro */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Bairro</label>
        <input
          type="text"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Cidade + Estado */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Cidade</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-gray-500 mb-1">UF</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="SC"
            maxLength={2}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono text-center uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">Salvo com sucesso.</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="px-4 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
