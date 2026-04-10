import Image from "next/image"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Painel esquerdo — identidade Konto */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{ backgroundColor: "#0d2b35" }}
      >
        <Image
          src="/logo.jpg"
          alt="Konto Contabilidade"
          width={320}
          height={120}
          className="object-contain"
          priority
        />
        <p className="mt-8 text-center text-sm max-w-xs" style={{ color: "#4dcfe0" }}>
          Ecossistema integrado para escritórios de contabilidade
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Logo visível só no mobile */}
        <div className="lg:hidden mb-8">
          <Image
            src="/logo.jpg"
            alt="Konto Contabilidade"
            width={200}
            height={75}
            className="object-contain"
            priority
          />
        </div>

        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
