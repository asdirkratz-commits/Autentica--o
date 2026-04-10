import type { JWTPayload, Role, UserPermissions } from "./types"
import type { UserTenant } from "@repo/db"

export function isMasterGlobal(payload: JWTPayload): boolean {
  return payload.isMasterGlobal === true
}

export function hasRole(payload: JWTPayload, role: Role | Role[]): boolean {
  const roles = Array.isArray(role) ? role : [role]
  return roles.includes(payload.role)
}

export function canAccess(
  payload: JWTPayload,
  permission: keyof UserPermissions
): boolean {
  if (isMasterGlobal(payload)) return true
  if (payload.role === "owner") return true
  return payload.permissions[permission] === true
}

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 2,
  admin: 1,
  user: 0,
}

export function canManageUser(
  actor: JWTPayload,
  target: UserTenant
): boolean {
  if (isMasterGlobal(actor)) return true

  const actorLevel = ROLE_HIERARCHY[actor.role] ?? 0
  const targetLevel = ROLE_HIERARCHY[target.role as Role] ?? 0

  // actor must have strictly higher rank than target
  return actorLevel > targetLevel
}

export function requireMasterGlobal(payload: JWTPayload): void {
  if (!isMasterGlobal(payload)) {
    throw new Error("Forbidden: master_global required")
  }
}

export function requireRole(payload: JWTPayload, role: Role | Role[]): void {
  if (!hasRole(payload, role) && !isMasterGlobal(payload)) {
    throw new Error(`Forbidden: role ${Array.isArray(role) ? role.join("/") : role} required`)
  }
}
