"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface Props {
  href: string
  icon?: string
  children: React.ReactNode
}

export default function SidebarActiveLink({ href, icon, children }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      className={`sidebar__link${isActive ? " sidebar__link--active" : ""}`}
    >
      {icon && (
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      )}
      {children}
    </Link>
  )
}
