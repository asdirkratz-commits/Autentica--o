import type { TenantStatus } from "@repo/auth-shared"

type Props = {
  status: TenantStatus
  size?: "sm" | "md"
}

const CONFIG: Record<TenantStatus, { label: string; classes: string }> = {
  ativo:        { label: "Ativo",        classes: "bg-green-100 text-green-700 border-green-200" },
  inadimplente: { label: "Inadimplente", classes: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  inativo:      { label: "Inativo",      classes: "bg-gray-100 text-gray-500 border-gray-200" },
  bloqueado:    { label: "Bloqueado",    classes: "bg-red-100 text-red-700 border-red-200" },
}

export function StatusBadge({ status, size = "sm" }: Props) {
  const { label, classes } = CONFIG[status] ?? CONFIG.inativo
  const sizeClass = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${sizeClass} ${classes}`}>
      {label}
    </span>
  )
}
