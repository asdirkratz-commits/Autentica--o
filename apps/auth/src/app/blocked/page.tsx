// Página estática de bloqueio — sem dependências de DB ou autenticação
// Retornada pelo middleware com HTTP 403 para tenants bloqueados

export default function BlockedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Acesso bloqueado
        </h1>

        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          O acesso desta empresa foi suspenso. Entre em contato com o suporte
          ou com o responsável pela conta para regularizar a situação.
        </p>

        <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 text-sm text-gray-600">
          <p className="font-medium text-gray-800 mb-1">Precisa de ajuda?</p>
          <p>
            Entre em contato com nosso suporte pelo e-mail{" "}
            <a
              href="mailto:suporte@seudominio.com"
              className="text-brand-600 hover:underline"
            >
              suporte@seudominio.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
