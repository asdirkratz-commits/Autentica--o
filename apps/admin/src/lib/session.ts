import { RefreshTokenRepo } from "@repo/db"

export async function revokeAllTenantSessions(tenantId: string): Promise<void> {
  await RefreshTokenRepo.revokeAllForTenant(tenantId)
}
