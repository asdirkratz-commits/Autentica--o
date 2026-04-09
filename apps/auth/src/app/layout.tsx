import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Auth — Ecossistema Multi-App",
  description: "Autenticação centralizada SSO",
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
