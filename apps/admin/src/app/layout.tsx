import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Admin — Painel Master Global",
  description: "Painel de administração do ecossistema multi-app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
