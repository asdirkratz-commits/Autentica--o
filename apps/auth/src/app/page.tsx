import { redirect } from "next/navigation"

// Rota raiz — redireciona para o perfil (protected layout lida com autenticação)
export default function RootPage() {
  redirect("/dashboard")
}
