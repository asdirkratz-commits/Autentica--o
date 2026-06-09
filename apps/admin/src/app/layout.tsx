import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Admin — Painel Master Global",
  description: "Painel de administração do ecossistema multi-app",
}

// Renderização dinâmica: necessária para o CSP com nonce por requisição (F-09/S01c).
export const dynamic = "force-dynamic"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
