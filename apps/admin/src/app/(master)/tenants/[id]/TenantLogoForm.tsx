"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

export default function TenantLogoForm({
  tenantId,
  currentLogoUrl,
}: {
  tenantId: string
  currentLogoUrl: string | null
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentLogoUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  function handleFileSelect(file: File) {
    const MAX = 2 * 1024 * 1024
    const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]

    if (!ALLOWED.includes(file.type)) {
      setError("Tipo não permitido. Use PNG, JPG, SVG ou WebP.")
      return
    }
    if (file.size > MAX) {
      setError("Arquivo muito grande. Máximo 2 MB.")
      return
    }

    setError(null)
    // Preview local imediato
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    void upload(file)
  }

  async function upload(file: File) {
    setUploading(true)
    setSuccess(false)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/admin/tenants/${tenantId}/logo`, {
        method: "POST",
        body: formData,
      })

      const data = (await res.json()) as { logoUrl?: string; message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao enviar logo")
        return
      }

      if (data.logoUrl) setPreview(data.logoUrl)
      setSuccess(true)
      router.refresh()
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: null }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        setError(data.message ?? "Erro ao remover logo")
        return
      }

      setPreview(null)
      setSuccess(true)
      router.refresh()
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card">
      <p className="portal-section-label">Logomarca</p>

      {/* Preview */}
      <div className="logo-preview">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Logo da empresa" style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }} onError={() => setPreview(null)} />
        ) : (
          <p style={{ fontSize: 12, color: "#9ca3af" }}>Sem logo cadastrada</p>
        )}
      </div>

      {/* Drop zone / upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFileSelect(file)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`dropzone${isDragging ? " dropzone--drag" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
            e.target.value = ""
          }}
        />

        {uploading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", fontSize: 13, color: "#6b7280" }}>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Enviando...
          </div>
        ) : (
          <>
            <svg className="w-6 h-6" style={{ color: "#9ca3af", margin: "0 auto 4px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p style={{ fontSize: 12, color: "#6b7280" }}>
              <span style={{ fontWeight: 500, color: "var(--k-color-secondary)" }}>Clique para enviar</span> ou arraste aqui
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>PNG, JPG, SVG ou WebP — máx. 2 MB</p>
          </>
        )}
      </div>

      {error && <div className="alert alert--danger" style={{ marginTop: "var(--space-3)" }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginTop: "var(--space-3)" }}>Logo atualizada com sucesso.</div>}

      {preview && !uploading && (
        <button type="button" onClick={() => void handleRemove()} className="btn btn--danger-ghost btn--block btn--sm" style={{ marginTop: "var(--space-3)" }}>
          Remover logo
        </button>
      )}
    </div>
  )
}
