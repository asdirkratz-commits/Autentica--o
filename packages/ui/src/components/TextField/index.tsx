import type { InputHTMLAttributes, ReactNode } from "react"

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: ReactNode
  /** Texto auxiliar abaixo do campo (ex.: requisitos de senha). */
  hint?: ReactNode
  /** Elemento à direita do label (ex.: link "Esqueceu a senha?"). */
  labelAccessory?: ReactNode
}

/**
 * Campo de formulário do contrato Konto: label + input + hint opcional.
 * Usa as classes globais .form-field/.label/.input (definidas no globals.css
 * do app consumidor). Compartilhado entre as telas de auth.
 */
export function TextField({ id, label, hint, labelAccessory, ...inputProps }: TextFieldProps) {
  return (
    <div className="form-field">
      <div className="label__row">
        <label htmlFor={id} className="label">{label}</label>
        {labelAccessory}
      </div>
      <input id={id} className="input" {...inputProps} />
      {hint ? <p className="auth-hint">{hint}</p> : null}
    </div>
  )
}
