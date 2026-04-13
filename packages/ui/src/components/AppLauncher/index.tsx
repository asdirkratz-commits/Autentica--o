"use client"

import { useState, useEffect, useRef } from "react"
import { AppIcon } from "./AppIcon"

type AppEntry = {
  appId: string
  name: string
  displayName: string
  baseUrl: string
  iconUrl?: string | null
  parentAppId?: string | null
  active: boolean
}

type AppGroup = {
  parent: AppEntry
  children: AppEntry[]
}

type Props = {
  /** URL do endpoint que retorna os apps do usuário (/api/tenant/apps) */
  appsEndpoint?: string
  className?: string
}

/**
 * Agrupa apps pelo parentAppId.
 * Apps sem pai formam grupos de um só elemento (sem filhos).
 * Apps filhos são agrupados sob o app pai correspondente.
 * Apps filhos cujo pai não está na lista (não assinado) ficam como raiz.
 */
function groupApps(apps: AppEntry[]): AppGroup[] {
  const byId = new Map(apps.map((a) => [a.appId, a]))
  const groups: AppGroup[] = []
  const addedAsChild = new Set<string>()

  // Primeiro: criar grupos para apps que são pai de algum outro
  for (const app of apps) {
    if (!app.parentAppId) {
      const children = apps.filter(
        (a) => a.parentAppId === app.appId
      )
      children.forEach((c) => addedAsChild.add(c.appId))
      groups.push({ parent: app, children })
    }
  }

  // Segundo: apps filhos cujo pai não aparece na lista ficam como raiz
  for (const app of apps) {
    if (app.parentAppId && !addedAsChild.has(app.appId) && !byId.has(app.parentAppId)) {
      groups.push({ parent: app, children: [] })
    }
  }

  return groups
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
        setApps((data.data ?? []).filter((a) => a.active))
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

  const groups = groupApps(apps)

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
        <div className="absolute right-0 top-10 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
            Apps disponíveis
          </p>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && groups.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              Nenhum app disponível.
            </p>
          )}

          {!loading && groups.length > 0 && (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.parent.appId}>
                  {/* App pai — sempre exibido como link */}
                  <AppIcon
                    name={group.parent.name}
                    displayName={group.parent.displayName}
                    baseUrl={group.parent.baseUrl}
                    iconUrl={group.parent.iconUrl}
                    active={group.parent.active}
                  />

                  {/* Módulos filhos — exibidos em grid abaixo do pai */}
                  {group.children.length > 0 && (
                    <div className="mt-1 ml-3 pl-3 border-l border-gray-100 grid grid-cols-2 gap-1">
                      {group.children.map((child) => (
                        <AppIcon
                          key={child.appId}
                          name={child.name}
                          displayName={child.displayName}
                          baseUrl={child.baseUrl}
                          iconUrl={child.iconUrl}
                          active={child.active}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
