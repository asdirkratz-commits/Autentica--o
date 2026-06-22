"use client"

import { useEffect, useRef, useState } from "react"

type Cert = {
  id: string
  cnpj: string
  nomeArquivo: string
  emitidoPara: string
  tipoCertificado: "A1" | "A3"
  dataValidade: string
  ativo: boolean
}

// A validade é uma data de calendário (não um instante). Lemos só a parte
// YYYY-MM-DD e montamos uma data local, evitando o deslocamento de fuso.
function parseDataLocal(dataStr: string): Date {
  const [ano, mes, dia] = dataStr.slice(0, 10).split("-")
  return new Date(Number(ano), Number(mes ?? 1) - 1, Number(dia ?? 1))
}

function diasParaVencer(dataStr: string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((parseDataLocal(dataStr).getTime() - hoje.getTime()) / 86_400_000)
}

function formatarData(dataStr: string): string {
  return parseDataLocal(dataStr).toLocaleDateString("pt-BR")
}

function BadgeValidade({ data }: { data: string }) {
  const dias = diasParaVencer(data)
  const vencido = dias < 0
  const alerta = dias >= 0 && dias <= 30

  const bg = vencido ? "#fee2e2" : alerta ? "#fef9c3" : "#dcfce7"
  const color = vencido ? "#b91c1c" : alerta ? "#854d0e" : "#166534"
  const label = vencido ? `Vencido há ${Math.abs(dias)} dias` : `Vence em ${dias} dias — ${formatarData(data)}`

  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: bg, color, fontWeight: 500 }}>
      {label}
    </span>
  )
}

export default function TenantCertificadoForm({
  tenantId,
  initialCnpj,
}: {
  tenantId: string
  initialCnpj?: string | null
}) {
  const [certs, setCerts] = useState<Cert[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadando, setUploadando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    cnpj: initialCnpj ? initialCnpj.replace(/\D/g, "") : "",
    emitidoPara: "",
    senha: "",
    dataValidade: "",
    tipoCertificado: "A1" as "A1" | "A3",
    dataEmissao: "",
    observacoes: "",
  })
  const [arquivo, setArquivo] = useState<File | null>(null)

  async function carregar() {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/tenants/${tenantId}/certificados`)
      const d = (await r.json()) as unknown
      setCerts(Array.isArray(d) ? (d as Cert[]) : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  function setF<K extends keyof typeof form>(key: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!arquivo) {
      setErro("Selecione o arquivo .pfx ou .p12.")
      return
    }
    setErro(null)
    setSucesso(null)
    setUploadando(true)
    try {
      const fd = new FormData()
      fd.append("arquivo", arquivo)
      fd.append("senha", form.senha)
      fd.append("cnpj", form.cnpj.replace(/\D/g, ""))
      fd.append("emitido_para", form.emitidoPara)
      fd.append("data_validade", form.dataValidade)
      fd.append("tipo_certificado", form.tipoCertificado)
      if (form.dataEmissao) fd.append("data_emissao", form.dataEmissao)
      if (form.observacoes) fd.append("observacoes", form.observacoes)

      const r = await fetch(`/api/admin/tenants/${tenantId}/certificados`, { method: "POST", body: fd })
      const d = (await r.json()) as { message?: string }
      if (!r.ok) {
        setErro(d.message ?? "Erro no upload.")
        return
      }

      setSucesso("Certificado enviado com sucesso.")
      setMostrarForm(false)
      setArquivo(null)
      setForm({
        cnpj: initialCnpj ? initialCnpj.replace(/\D/g, "") : "",
        emitidoPara: "",
        senha: "",
        dataValidade: "",
        tipoCertificado: "A1",
        dataEmissao: "",
        observacoes: "",
      })
      await carregar()
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setUploadando(false)
    }
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Remover certificado "${nome}"?`)) return
    const r = await fetch(`/api/admin/tenants/${tenantId}/certificados/${id}`, { method: "DELETE" })
    if (r.ok) {
      setSucesso("Certificado removido.")
      await carregar()
    } else {
      setErro("Erro ao remover.")
    }
  }

  const ativos = certs.filter((c) => c.ativo)
  const inativos = certs.filter((c) => !c.ativo)

  return (
    <div className="card">
      <p className="portal-section-label">Certificado e-CNPJ</p>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: "var(--space-3)" }}>
        Certificado digital do escritório, usado para acessar o e-CAC via procuração eletrônica.
      </p>

      {erro && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{erro}</div>}
      {sucesso && <div className="alert alert--success" style={{ marginBottom: "var(--space-3)" }}>{sucesso}</div>}

      {loading ? (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Carregando…</p>
      ) : ativos.length === 0 && !mostrarForm ? (
        <div style={{ padding: "var(--space-4)", background: "#f9fafb", borderRadius: "var(--radius-md)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Nenhum certificado ativo.</p>
        </div>
      ) : (
        ativos.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-2)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{c.emitidoPara}</p>
              <p style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                {c.nomeArquivo} · {c.tipoCertificado}
              </p>
            </div>
            <BadgeValidade data={c.dataValidade} />
            <button
              type="button"
              onClick={() => void remover(c.id, c.nomeArquivo)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4, flexShrink: 0 }}
              title="Remover certificado"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </button>
          </div>
        ))
      )}

      {inativos.length > 0 && (
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>+ {inativos.length} certificado(s) inativo(s)</p>
      )}

      {!mostrarForm && (
        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: "var(--space-3)" }}
          onClick={() => {
            setMostrarForm(true)
            setErro(null)
            setSucesso(null)
          }}
        >
          + Enviar certificado
        </button>
      )}

      {mostrarForm && (
        <form onSubmit={(e) => void handleUpload(e)} style={{ marginTop: "var(--space-4)", borderTop: "1px solid #e5e7eb", paddingTop: "var(--space-4)" }}>
          <div className="form-field">
            <label className="label">Arquivo .pfx / .p12 *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pfx,.p12"
              style={{ display: "none" }}
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <button type="button" className="btn btn--block" onClick={() => fileRef.current?.click()}>
              {arquivo ? arquivo.name : "Selecionar arquivo"}
            </button>
            {arquivo && <span style={{ fontSize: 11, color: "#6b7280" }}>{(arquivo.size / 1024).toFixed(1)} KB</span>}
          </div>

          <div className="form-field">
            <label className="label">CNPJ vinculado *</label>
            <input
              className="input input--mono"
              required
              placeholder="00.000.000/0001-00"
              value={form.cnpj}
              onChange={(e) => setF("cnpj", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="label">Tipo</label>
            <select
              className="input"
              value={form.tipoCertificado}
              onChange={(e) => setF("tipoCertificado", e.target.value as "A1" | "A3")}
            >
              <option value="A1">A1 (arquivo)</option>
              <option value="A3">A3 (token/smart card)</option>
            </select>
          </div>

          <div className="form-field">
            <label className="label">Emitido para (nome no certificado) *</label>
            <input
              className="input"
              required
              placeholder="Razão Social Ltda"
              value={form.emitidoPara}
              onChange={(e) => setF("emitidoPara", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="label">Senha do certificado *</label>
            <input
              className="input"
              type="password"
              required
              autoComplete="new-password"
              value={form.senha}
              onChange={(e) => setF("senha", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="label">Data de validade *</label>
            <input
              className="input"
              type="date"
              required
              value={form.dataValidade}
              onChange={(e) => setF("dataValidade", e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            <button type="submit" className="btn btn--primary" disabled={uploadando}>
              {uploadando ? "Enviando…" : "Enviar certificado"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMostrarForm(false)
                setArquivo(null)
                setErro(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
