import type { ButtonHTMLAttributes, ReactNode } from "react"

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  loading?: boolean
  /** Texto exibido enquanto `loading` (ex.: "Entrando..."). Default: children. */
  loadingText?: ReactNode
  children: ReactNode
}

/**
 * Botão de submit primário, largura total, com estado de carregamento.
 * Usa as classes globais .btn/.btn--primary/.btn--block. Compartilhado entre
 * as telas de auth.
 */
export function SubmitButton({ loading, loadingText, children, disabled, className, ...rest }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={`btn btn--primary btn--block${className ? ` ${className}` : ""}`}
      disabled={loading || disabled}
      {...rest}
    >
      {loading ? (loadingText ?? children) : children}
    </button>
  )
}
