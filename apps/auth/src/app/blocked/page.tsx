// Página estática de bloqueio — sem dependências de DB ou autenticação
// Retornada pelo middleware com HTTP 403 para tenants bloqueados

export default function BlockedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
        background: "var(--k-surface)",
      }}
    >
      <div className="auth-card auth-status">
        <div className="auth-status__icon auth-status__icon--danger" style={{ width: 64, height: 64 }}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        <h1 className="auth-heading">Acesso bloqueado</h1>
        <p className="auth-subtitle">
          O acesso desta empresa foi suspenso. Entre em contato com o suporte ou com o
          responsável pela conta para regularizar a situação.
        </p>

        <div className="auth-info-card" style={{ textAlign: "left" }}>
          <p style={{ fontWeight: 500, color: "var(--k-foreground)", marginBottom: "var(--space-1)" }}>
            Precisa de ajuda?
          </p>
          <p>
            Entre em contato com nosso suporte pelo e-mail{" "}
            <a href="mailto:suporte@seudominio.com" className="auth-link">
              suporte@seudominio.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
