type Props = {
  name: string
  avatarUrl?: string | null
  size?: "sm" | "md" | "lg"
}

const SIZE_CLASSES = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
}

export function UserAvatar({ name, avatarUrl, size = "md" }: Props) {
  const sizeClass = SIZE_CLASSES[size]
  const initial = name.charAt(0).toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-brand-100 flex items-center justify-center shrink-0`}
    >
      <span className="font-semibold text-brand-700">{initial}</span>
    </div>
  )
}
