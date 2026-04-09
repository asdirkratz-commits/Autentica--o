// ─── Domain types ─────────────────────────────────────────────────────────────

export type TenantStatus = "ativo" | "inativo" | "inadimplente" | "bloqueado"
export type Role = "owner" | "admin" | "user"
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
): Result<never> {
  return { ok: false, error: { code, message, statusCode } }
}

// ─── Session metadata ─────────────────────────────────────────────────────────

export type SessionMeta = {
  userAgent?: string
  ipAddress?: string
}
