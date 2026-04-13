// ─── Domain types ─────────────────────────────────────────────────────────────

export type TenantStatus = "ativo" | "inativo" | "inadimplente" | "bloqueado"
export type Role = "admin" | "user"
export type UserStatus = "active" | "inactive" | "pending"

export type UserPermissions = {
  can_invite_users?: boolean
  can_manage_users?: boolean
  can_view_reports?: boolean
  can_export_data?: boolean
  custom?: Record<string, boolean>
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export type JWTPayload = {
  sub: string          // userId
  tenantId: string
  role: Role
  isMasterGlobal: boolean
  permissions: UserPermissions
  iat?: number
  exp?: number
}

export type TokenPair = {
  accessToken: string
  refreshToken: string
}

export type AccessToken = {
  accessToken: string
}

// ─── Result Pattern ───────────────────────────────────────────────────────────

export type AppError = {
  code: ErrorCode
  message: string
  statusCode: number
}

export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  TENANT_BLOCKED = "TENANT_BLOCKED",
  TENANT_INACTIVE = "TENANT_INACTIVE",
  USER_INACTIVE = "USER_INACTIVE",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  TOKEN_ALREADY_USED = "TOKEN_ALREADY_USED",
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(
  code: ErrorCode,
  message: string,
  statusCode = 400
): { ok: false; error: AppError } {
  return { ok: false, error: { code, message, statusCode } }
}

// ─── Session metadata ─────────────────────────────────────────────────────────

export type SessionMeta = {
  userAgent?: string
  ipAddress?: string
}

// ─── Tenant theme (white-label) ───────────────────────────────────────────────

export type TenantTheme = {
  primary:    string  // ex: "#1a56db"
  secondary:  string  // ex: "#7e3af2"
  accent:     string  // ex: "#0694a2"
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export const DEFAULT_THEME: TenantTheme = {
  primary:   "#2563eb",
  secondary: "#7c3aed",
  accent:    "#0891b2",
}

/** Valida e normaliza um objeto de tema; retorna o tema padrão para campos inválidos */
export function parseTenantTheme(raw: unknown): TenantTheme {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THEME }
  const t = raw as Record<string, unknown>
  return {
    primary:   typeof t.primary   === "string" && HEX_RE.test(t.primary)   ? t.primary   : DEFAULT_THEME.primary,
    secondary: typeof t.secondary === "string" && HEX_RE.test(t.secondary) ? t.secondary : DEFAULT_THEME.secondary,
    accent:    typeof t.accent    === "string" && HEX_RE.test(t.accent)    ? t.accent    : DEFAULT_THEME.accent,
  }
}
