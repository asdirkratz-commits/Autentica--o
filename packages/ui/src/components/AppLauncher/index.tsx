"use client"

import { useState, useEffect, useRef } from "react"
import { AppIcon } from "./AppIcon"

type AppEntry = {
  appId: string
  name: string
  displayName: string
  baseUrl: string
  iconUrl?: string | null
  active: boolean
}

type Props = {
  /** URL do endpoint que retorna os apps do tenant (/api/tenant/apps) */
  appsEndpoint?: string
  className?: string
}

export function AppLauncher({ appsEndpoint = "/api/tenant/apps", className = "" }: Props) {
  const [open, setOpen] = useState(false)
  const [apps, setApps] = useState<AppEntry[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || apps.length > 0) return

    setLoading(true)
    void fetch(appsEndpoint)
      .then((r) => r.json())
      .then((data: { data?: AppEntry[] }) => {
        setApps(data.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, appsEndpoint, apps.length])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const activeApps = apps.filter((a) => a.active)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Apps disponíveis"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-expanded={open}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
            Apps disponíveis
          </p>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && activeApps.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              Nenhum app disponível.
            </p>
          )}

          {!loading && activeApps.length > 0 && (
            <div className="grid grid-cols-3 gap-1">
              {activeApps.map((app) => (
                <AppIcon
                  key={app.appId}
                  name={app.name}
                  displayName={app.displayName}
                  baseUrl={app.baseUrl}
                  iconUrl={app.iconUrl}
                  active={app.active}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
