import { NextRequest, NextResponse } from "next/server"
import { UserRepo, TenantRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { requireMasterGlobalApi } from "@/lib/api-guard"

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/tenants/[id]/users — usuários da empresa + módulos liberados
export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response

  const { id } = await params

  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
      { status: 404 }
    )
  }

  const members = await UserRepo.getTenantMembers(id)
  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      fullName: m.fullName,
      email: m.email,
      role: m.role,
      status: m.status,
      modulos: m.modulos,
    })),
  })
}
