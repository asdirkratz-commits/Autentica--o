import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Konto — Autenticação",
  description: "Acesso ao ecossistema Konto Contabilidade",
}

// Renderização dinâmica em todo o app: o CSP com nonce por requisição (middleware)
// só é aplicado aos scripts do Next em páginas SSR — páginas estáticas não recebem
// o nonce e seriam bloqueadas pelo script-src estrito (F-09/S01c).
export const dynamic = "force-dynamic"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  )
}
