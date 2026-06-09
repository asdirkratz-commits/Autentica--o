import Image from "next/image"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="auth-layout">
      {/* Painel esquerdo — identidade Konto */}
      <div className="auth-brand">
        <Image
          src="/logo.jpg"
          alt="Konto Contabilidade"
          width={320}
          height={120}
          className="object-contain"
          priority
        />
        <p className="auth-brand__tagline">
          Ecossistema integrado para escritórios de contabilidade
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div className="auth-panel">
        {/* Logo visível só no mobile */}
        <div className="auth-panel__mobile-logo">
          <Image
            src="/logo.jpg"
            alt="Konto Contabilidade"
            width={200}
            height={75}
            className="object-contain"
            priority
          />
        </div>

        <div className="auth-card">
          {children}
        </div>
      </div>
    </div>
  )
}
