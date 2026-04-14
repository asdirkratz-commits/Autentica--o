import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Konto — Autenticação",
  description: "Acesso ao ecossistema Konto Contabilidade",
}

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
