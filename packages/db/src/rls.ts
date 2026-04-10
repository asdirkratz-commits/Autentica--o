import { sql } from "drizzle-orm"
import { db } from "./client"

export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL app.current_tenant_id = ${tenantId}`
    )
    return fn(tx)
  })
}
