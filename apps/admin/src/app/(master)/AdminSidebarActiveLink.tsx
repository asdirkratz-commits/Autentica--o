"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface Props {
  href: string
  icon: string
  children: React.ReactNode
}

export default function AdminSidebarActiveLink({ href, icon, children }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
        isActive
          ? "bg-brand-600 text-white"
          : "text-gray-300 hover:bg-gray-800 hover:text-white"
      }`}
    >
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      {children}
    </Link>
  )
}
