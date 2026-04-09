type Props = {
  /** URL da página de pagamento/regularização */
  paymentUrl?: string
  className?: string
}

export function InadimplenteBanner({ paymentUrl, className = "" }: Props) {
  return (
    <div
      className={`bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 flex items-center justify-between gap-4 ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-4 h-4 text-yellow-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-sm text-yellow-800 truncate">
          <span className="font-semibold">Pagamento pendente.</span>{" "}
          Regularize sua conta para evitar a suspensão do serviço.
        </p>
      </div>
      {paymentUrl && (
        <a
          href={paymentUrl}
          className="shrink-0 text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Regularizar agora
        </a>
      )}
    </div>
  )
}
