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
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Logo Marca</h2>

      {/* Preview */}
      <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 mb-4 overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Logo da empresa"
            className="max-h-20 max-w-full object-contain"
            onError={() => setPreview(null)}
          />
        ) : (
          <p className="text-xs text-gray-400">Sem logo cadastrada</p>
        )}
      </div>

      {/* Drop zone / botão de upload */}
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
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
          isDragging
            ? "border-brand-400 bg-brand-50"
            : "border-gray-300 hover:border-brand-400 hover:bg-gray-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
            e.target.value = "" // reset para permitir re-upload do mesmo arquivo
          }}
        />

        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Enviando...
          </div>
        ) : (
          <>
            <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-brand-600">Clique para enviar</span> ou arraste aqui
            </p>
            <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG ou WebP — máx. 2 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Logo atualizada com sucesso.
        </div>
      )}

      {preview && !uploading && (
        <button
          type="button"
          onClick={() => void handleRemove()}
          className="mt-3 w-full py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Remover logo
        </button>
      )}
    </div>
  )
}
