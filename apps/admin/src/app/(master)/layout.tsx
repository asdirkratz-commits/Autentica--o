import { requireMasterGlobal } from "@/lib/admin-guard"
import AdminTopbar from "./AdminTopbar"

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireMasterGlobal()
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"

  return (
    <>
      <AdminTopbar
        userName={user.fullName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl ?? null}
        authUrl={authUrl}
      />
      <main className="app-main">
        <div className="page-content">{children}</div>
      </main>
    </>
  )
}
