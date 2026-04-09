type Props = {
  name: string
  slug: string
  className?: string
}

export function TenantBadge({ name, slug, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-7 h-7 bg-brand-100 rounded-md flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-brand-700 uppercase">
          {name.charAt(0)}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-400 truncate font-mono">{slug}</p>
      </div>
    </div>
  )
}
