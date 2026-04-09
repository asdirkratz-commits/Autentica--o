import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, env } from "@repo/auth-shared"
import { validateWebhookSignature } from "@/lib/webhook"
import { revokeAllTenantSessions } from "@/lib/session"
import { cache } from "@/lib/redis"

type BillingEvent = {
  event: string
  externalTenantId: string
  metadata?: Record<string, unknown>
}

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()
  const signature = request.headers.get("x-webhook-signature") ?? ""

  // Validar HMAC
  const isValid = validateWebhookSignature(rawBody, signature, env.BILLING_WEBHOOK_SECRET)
  if (!isValid) {
    return NextResponse.json(
      err(ErrorCode.INVALID_SIGNATURE, "Assinatura inválida", 401).error,
      { status: 401 }
    )
  }

  let payload: BillingEvent
  try {
    payload = JSON.parse(rawBody) as BillingEvent
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { event, externalTenantId, metadata } = payload

  // Registrar recebimento (mesmo eventos desconhecidos)
  const tenant = await TenantRepo.findByExternalBillingId(externalTenantId)

  await AuditRepo.log({
    tenantId: tenant?.id,
    userId: SYSTEM_USER_ID,
    action: "webhook.received",
    targetType: "webhook",
    targetId: externalTenantId,
    metadata: { event, ...metadata },
  })

  if (!tenant) {
    // Tenant não encontrado — registrar e responder OK (não rejeitar webhook)
    return NextResponse.json({ received: true })
  }

  // Processar evento
  switch (event) {
    case "payment.overdue":
      await TenantRepo.updateStatus(tenant.id, "inadimplente")
      await cache.invalidateTenantStatus(tenant.id)
      break

    case "invoice.paid":
    case "subscription.activated":
      await TenantRepo.updateStatus(tenant.id, "ativo")
      await cache.invalidateTenantStatus(tenant.id)
      break

    case "subscription.cancelled":
      await TenantRepo.updateStatus(tenant.id, "bloqueado")
      await cache.invalidateTenantStatus(tenant.id)
      await revokeAllTenantSessions(tenant.id)
      break

    default:
      // Evento não tratado — apenas registrado
      break
  }

  await AuditRepo.log({
    tenantId: tenant.id,
    userId: SYSTEM_USER_ID,
    action: "webhook.processed",
    targetType: "webhook",
    targetId: tenant.id,
    metadata: { event, externalTenantId },
  })

  return NextResponse.json({ received: true })
}
