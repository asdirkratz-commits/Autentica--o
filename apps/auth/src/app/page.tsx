import { redirect } from "next/navigation"

// Rota raiz — landing padrão do ecossistema = KontoHub (app único hoje).
// Middleware já garante autenticação antes de chegar aqui. O portal de
// identidade continua acessível em /dashboard (perfil, admin), mas deixou
// de ser a tela inicial. Quando houver 2+ apps, trocar por um lançador.
export default function RootPage() {
  redirect(process.env.NEXT_PUBLIC_KONTOHUB_URL ?? "/dashboard")
}
