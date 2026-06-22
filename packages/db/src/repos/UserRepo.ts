/**
 * UserRepo — Supabase (auth.users via GoTrue Admin API + public.user_tenants REST)
 * Migrado do Neon na P5/R4c. IDENTIDADE UNIFICADA EM GoTrue id:
 *   - `User.id` AGORA É o GoTrue UUID (= auth.users.id = JWT sub). Não há mais "id Neon".
 *   - perfil/senha/email/master vêm de auth.users (app_metadata, server-controlled);
 *   - memberships vêm de public.user_tenants (chaveado por auth.users.id).
 *
 * Reconciliação de vocabulário (user_tenants é compartilhado com o KontoHub):
 *   role:   admin ⇄ Administrador · user ⇄ Colaborador · (Master → admin na leitura)
 *   status: active ⇄ ativo · inactive ⇄ inativo · pending ⇄ pendente · (bloqueado → inactive)
 *
 * Senha: o GoTrue é o único validador. Os fluxos (login/invite/reset/change) já chamam
 * o GoTrue diretamente; os métodos de senha aqui (updatePassword/...) viram no-op.
 */
import { supabase } from "../supabase-client"
import { goTrueAdmin, type GoTrueUser } from "../gotrue-admin"
import { type User, type UserTenant, type UserPermissions } from "../schema/index"

export type TenantMember = {
  userId: string
  role: string
  status: string
  permissions: UserPermissions
  invitedAt: Date
  activatedAt: Date | null
  email: string
  fullName: string
  avatarUrl: string | null
  lastLoginAt: Date | null
  modulos: string[]
}

type Role = "admin" | "user"
type UserStatus = "active" | "inactive" | "pending"

export type CreateUserDTO = {
  email: string
  /** Plaintext — o GoTrue é quem armazena/valida a senha (não há mais hash no Neon). */
  password: string
  fullName: string
  isMasterGlobal?: boolean
  avatarUrl?: string
}

type UserTenantRow = {
  user_id: string
  tenant_id: string
  role: "Master" | "Administrador" | "Colaborador"
  status: "ativo" | "inativo" | "bloqueado" | "pendente"
  permissions: unknown
  invited_by: string | null
  invited_at: string
  activated_at: string | null
  nome: string | null
  modulos: string[]
}

function enc(v: string): string {
  return encodeURIComponent(v)
}

// ── Mapeamentos de vocabulário ───────────────────────────────────────────────
function roleToLegacy(role: string): Role {
  return role === "Colaborador" ? "user" : "admin" // Master/Administrador → admin
}
function roleToSupabase(role: Role): "Administrador" | "Colaborador" {
  return role === "admin" ? "Administrador" : "Colaborador"
}
function statusToLegacy(s: string): UserStatus {
  if (s === "ativo") return "active"
  if (s === "pendente") return "pending"
  return "inactive" // inativo | bloqueado
}
function statusToSupabase(s: UserStatus): "ativo" | "inativo" | "pendente" {
  if (s === "active") return "ativo"
  if (s === "pending") return "pendente"
  return "inativo"
}

// ── Construtores de tipos de domínio ─────────────────────────────────────────
function toUser(gt: GoTrueUser): User {
  return {
    id: gt.id, // GoTrue UUID — chave canônica
    email: gt.email ?? "",
    passwordHash: "", // não exposto: o GoTrue valida a senha
    fullName: gt.fullName ?? "",
    isMasterGlobal: gt.isMasterGlobal,
    avatarUrl: gt.avatarUrl,
    lastLoginAt: gt.lastSignInAt,
    goTrueId: gt.id,
    createdAt: gt.createdAt,
    updatedAt: gt.updatedAt,
  }
}

function toUserTenant(r: UserTenantRow): UserTenant {
  return {
    userId: r.user_id,
    tenantId: r.tenant_id,
    role: roleToLegacy(r.role),
    status: statusToLegacy(r.status),
    permissions: (r.permissions ?? {}) as UserTenant["permissions"],
    invitedBy: r.invited_by,
    invitedAt: new Date(r.invited_at),
    activatedAt: r.activated_at ? new Date(r.activated_at) : null,
  }
}

const UT_COLS = "user_id,tenant_id,role,status,permissions,invited_by,invited_at,activated_at,nome,modulos"

export const UserRepo = {
  // ── Perfil (GoTrue) ────────────────────────────────────────────────────────
  /** Busca por GoTrue UUID (= User.id pós-R4c). */
  async findById(id: string): Promise<User | null> {
    const gt = await goTrueAdmin.getById(id)
    return gt ? toUser(gt) : null
  },

  /** Alias explícito — id já É o GoTrue id; mantido para os call sites existentes. */
  async findByGoTrueId(goTrueId: string): Promise<User | null> {
    const gt = await goTrueAdmin.getById(goTrueId)
    return gt ? toUser(gt) : null
  },

  async findByEmail(email: string): Promise<User | null> {
    const gt = await goTrueAdmin.findByEmail(email)
    return gt ? toUser(gt) : null
  },

  async create(data: CreateUserDTO): Promise<User> {
    const gt = await goTrueAdmin.create({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      isMasterGlobal: data.isMasterGlobal,
      avatarUrl: data.avatarUrl,
    })
    return toUser(gt)
  },

  // ── Senha: no-ops (o GoTrue é o validador; os fluxos já o atualizam direto) ──
  async updatePassword(_id: string, _hash: string): Promise<void> {
    /* no-op pós-R4c — ver reset/change/invite que chamam updateGoTruePassword */
  },
  async updatePasswordByGoTrueId(_goTrueId: string, _hash: string): Promise<void> {
    /* no-op pós-R4c */
  },
  /** id já é o GoTrue id — bridge Neon→GoTrue não é mais necessária. */
  async setGoTrueId(_neonId: string, _goTrueId: string): Promise<void> {
    /* no-op pós-R4c */
  },
  /** O GoTrue registra last_sign_in_at na emissão do token. */
  async updateLastLogin(_id: string): Promise<void> {
    /* no-op pós-R4c */
  },

  // ── Memberships (Supabase user_tenants, por GoTrue id) ──────────────────────
  async linkToTenant(
    userId: string,
    tenantId: string,
    role: Role,
    invitedBy?: string,
  ): Promise<void> {
    // onConflictDoNothing: não duplica o vínculo (UNIQUE user_id+tenant_id).
    const existing = await supabase
      .from<UserTenantRow>("user_tenants")
      .select(`user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}&limit=1`)
    if (existing[0]) return
    await supabase.from<UserTenantRow>("user_tenants").insert({
      user_id: userId,
      tenant_id: tenantId,
      role: roleToSupabase(role),
      status: "pendente",
      invited_by: invitedBy ?? null,
    } as Partial<UserTenantRow>)
  },

  async getUserTenants(userId: string): Promise<UserTenant[]> {
    const rows = await supabase
      .from<UserTenantRow>("user_tenants")
      .select(`select=${UT_COLS}&user_id=eq.${enc(userId)}`)
    return rows.map(toUserTenant)
  },

  async getUserRoleInTenant(
    userId: string,
    tenantId: string,
  ): Promise<UserTenant | null> {
    const rows = await supabase
      .from<UserTenantRow>("user_tenants")
      .select(
        `select=${UT_COLS}&user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}&limit=1`,
      )
    return rows[0] ? toUserTenant(rows[0]) : null
  },

  async setUserStatusInTenant(
    userId: string,
    tenantId: string,
    status: UserStatus,
  ): Promise<void> {
    const patch: Partial<UserTenantRow> & { activated_at?: string } = {
      status: statusToSupabase(status),
    }
    if (status === "active") patch.activated_at = new Date().toISOString()
    await supabase
      .from<UserTenantRow>("user_tenants")
      .update(`user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}`, patch)
  },

  async updateUserPermissions(
    userId: string,
    tenantId: string,
    permissions: UserPermissions,
  ): Promise<void> {
    await supabase
      .from<UserTenantRow>("user_tenants")
      .update(`user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}`, {
        permissions,
      } as Partial<UserTenantRow>)
  },

  async updateRole(userId: string, tenantId: string, role: Role): Promise<void> {
    await supabase
      .from<UserTenantRow>("user_tenants")
      .update(`user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}`, {
        role: roleToSupabase(role),
      } as Partial<UserTenantRow>)
  },

  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    const rows = await supabase
      .from<UserTenantRow>("user_tenants")
      .select(`select=${UT_COLS}&tenant_id=eq.${enc(tenantId)}&order=invited_at.asc`)
    // Perfil (email/nome/avatar/último login) vem do GoTrue, por usuário.
    // .catch isola falha de um lookup: um membro com perfil indisponível não
    // derruba a lista inteira (degrada para nome/email vazio nessa linha).
    const profiles = await Promise.all(
      rows.map((r) => goTrueAdmin.getById(r.user_id).catch(() => null)),
    )
    return rows.map((r, i) => {
      const p = profiles[i]
      return {
        userId: r.user_id,
        role: roleToLegacy(r.role),
        status: statusToLegacy(r.status),
        permissions: (r.permissions ?? {}) as UserPermissions,
        invitedAt: new Date(r.invited_at),
        activatedAt: r.activated_at ? new Date(r.activated_at) : null,
        email: p?.email ?? "",
        fullName: p?.fullName ?? r.nome ?? "",
        avatarUrl: p?.avatarUrl ?? null,
        lastLoginAt: p?.lastSignInAt ?? null,
        modulos: r.modulos ?? [],
      }
    })
  },

  /**
   * Atualiza os módulos liberados de um usuário num tenant (user_tenants.modulos).
   * É o que o KontoHub lê no login → claim `modulos` do JWT → gating de módulos.
   */
  async updateUserModulos(
    userId: string,
    tenantId: string,
    modulos: string[],
  ): Promise<void> {
    await supabase
      .from<UserTenantRow>("user_tenants")
      .update(`user_id=eq.${enc(userId)}&tenant_id=eq.${enc(tenantId)}`, {
        modulos,
      } as Partial<UserTenantRow>)
  },

  /** Lista todos os usuários da plataforma (Master Global) — via GoTrue Admin. */
  async listAllUsers(): Promise<User[]> {
    const gts = await goTrueAdmin.listAll()
    return gts
      .map(toUser)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  },

  // ── Backfill GoTrue: concluído (sem Neon, nada pendente) ────────────────────
  async findAllWithoutGoTrueId(): Promise<Pick<User, "id" | "email">[]> {
    return []
  },
  async countWithoutGoTrueId(): Promise<number> {
    return 0
  },
}
