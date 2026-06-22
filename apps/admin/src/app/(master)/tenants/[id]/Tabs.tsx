"use client"

import { useState, type ReactNode } from "react"

export type TabDef = { key: string; label: string; content: ReactNode }

/**
 * Abas genéricas. O conteúdo de cada aba é renderizado no servidor e passado como
 * ReactNode — só a troca de aba é client-side. Permite manter info/auditoria como
 * server components e os forms como client components, tudo sob a mesma navegação.
 */
export default function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "")
  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: "var(--space-1)",
          padding: 4,
          background: "#f3f4f6",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--space-5)",
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => {
          const isActive = t.key === current?.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              style={{
                flex: "1 0 auto",
                whiteSpace: "nowrap",
                padding: "var(--space-2) var(--space-4)",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                color: isActive ? "var(--k-color-primary)" : "#6b7280",
                background: isActive ? "#fff" : "transparent",
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,.08)" : "none",
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div>{current?.content}</div>
    </div>
  )
}
