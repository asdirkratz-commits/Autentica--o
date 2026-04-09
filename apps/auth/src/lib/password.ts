import bcrypt from "bcryptjs"

const BCRYPT_COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export function validatePasswordStrength(password: string): ValidationResult {
  if (password.length < 8) {
    return { valid: false, reason: "A senha deve ter no mínimo 8 caracteres" }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: "A senha deve ter pelo menos uma letra maiúscula" }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: "A senha deve ter pelo menos um número" }
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, reason: "A senha deve ter pelo menos um símbolo" }
  }
  return { valid: true }
}
