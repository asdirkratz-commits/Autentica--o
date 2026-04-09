type Props = {
  name: string
  displayName: string
  baseUrl: string
  iconUrl?: string | null
  active: boolean
}

export function AppIcon({ name, displayName, baseUrl, iconUrl, active }: Props) {
  if (!active) return null

  return (
    <a
      href={baseUrl}
      title={displayName}
      className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-100 transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center group-hover:bg-brand-100 transition-colors overflow-hidden">
        {iconUrl ? (
          <img src={iconUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-brand-700 font-bold text-sm uppercase">
            {name.charAt(0)}
          </span>
        )}
      </div>
      <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors text-center leading-tight max-w-[56px] truncate">
        {displayName}
      </span>
    </a>
  )
}
