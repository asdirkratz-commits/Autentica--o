# CLAUDE.md — Ecossistema Multi-App: Auth Core

> **Versão:** 1.0  
> **Escopo:** Serviço central de autenticação SSO + base compartilhada para Kontohub, Kontozap e futuros apps  
> **Stack:** Next.js 14 (App Router) · Drizzle ORM · PostgreSQL (Neon/Vercel) · Redis · TailwindCSS · TypeScript strict  
> **Monorepo:** Turborepo  

---

## ÍNDICE

1. [Objetivo e Contexto](#1-objetivo-e-contexto)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Agentes e Módulos](#3-agentes-e-módulos)
4. [Skills (Capacidades Reutilizáveis)](#4-skills-capacidades-reutilizáveis)
5. [Banco de Dados — Schema Completo](#5-banco-de-dados--schema-completo)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)
7. [Regras Obrigatórias de Desenvolvimento](#7-regras-obrigatórias-de-desenvolvimento)
8. [Fluxos Principais](#8-fluxos-principais)
9. [API Contracts](#9-api-contracts)
10. [Ordem de Execução do Desenvolvimento](#10-ordem-de-execução-do-desenvolvimento)

---

## 1. OBJETIVO E CONTEXTO

### O que é este sistema

Um **ecossistema de múltiplos aplicativos web** com **login único (SSO)** e **isolamento total de dados por empresa (multi-tenant)**.

### Aplicativos do ecossistema

| App | Status | Função |
|-----|--------|--------|
| `auth` | **Desenvolver agora** | Provedor de identidade central (SSO) |
| `admin` | **Desenvolver agora** | Painel do dono da plataforma (master_global) |
| `kontohub` | Futuro | Gestão para escritórios de contabilidade |
| `kontozap` | Futuro | Comunicação WhatsApp + VoIP |
| `billing` | Futuro | Faturamento da plataforma (SaaS billing) |

### Princípios arquiteturais

- **SSO:** Um login serve todos os apps via cookie compartilhado no domínio pai
- **Multi-tenant:** Cada empresa acessa apenas seus próprios dados (RLS no PostgreSQL)
- **Portabilidade:** Troca de banco = mudar `DATABASE_URL`. Sem lock-in de provedor
- **Extensibilidade:** Adicionar novo app = inserir 1 linha na tabela `apps` + criar o projeto

---

## 2. ESTRUTURA DE PASTAS

```
/                                   ← raiz do monorepo
├── CLAUDE.md                       ← este arquivo
├── turbo.json                      ← pipeline Turborepo
├── package.json                    ← workspace root
├── .env.example                    ← template de variáveis
├── .env.local                      ← NÃO commitar
│
├── apps/
│   ├── auth/                       ← Serviço de autenticação SSO
│   │   ├── src/
│   │   │   ├── app/                ← Next.js App Router
│   │   │   │   ├── (public)/
│   │   │   │   │   ├── login/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── register/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── forgot-password/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── reset-password/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── (protected)/
│   │   │   │   │   ├── select-tenant/  ← escolha da empresa ao logar
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── profile/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── blocked/            ← página estática de bloqueio
│   │   │   │   │   └── page.tsx
│   │   │   │   └── api/
│   │   │   │       └── auth/
│   │   │   │           ├── login/
│   │   │   │           │   └── route.ts
│   │   │   │           ├── logout/
│   │   │   │           │   └── route.ts
│   │   │   │           ├── refresh/
│   │   │   │           │   └── route.ts
│   │   │   │           ├── validate/
│   │   │   │           │   └── route.ts
│   │   │   │           ├── invite/
│   │   │   │           │   └── route.ts
│   │   │   │           └── webhooks/
│   │   │   │               └── billing/
│   │   │   │                   └── route.ts
│   │   │   ├── lib/
│   │   │   │   ├── jwt.ts              ← emissão e validação de JWT
│   │   │   │   ├── cookies.ts          ← leitura e escrita de cookies
│   │   │   │   ├── password.ts         ← bcrypt helpers
│   │   │   │   └── session.ts          ← gerenciamento de sessões
│   │   │   └── middleware.ts           ← proteção de rotas do app auth
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   └── admin/                      ← Painel exclusivo do master_global
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   │   └── login/
│       │   │   │       └── page.tsx
│       │   │   └── (master)/       ← rotas protegidas por is_master_global
│       │   │       ├── dashboard/
│       │   │       │   └── page.tsx
│       │   │       ├── tenants/
│       │   │       │   ├── page.tsx        ← listagem de todas as empresas
│       │   │       │   ├── [id]/
│       │   │       │   │   └── page.tsx    ← detalhe + alterar status
│       │   │       │   └── new/
│       │   │       │       └── page.tsx    ← cadastro de nova empresa
│       │   │       ├── users/
│       │   │       │   └── page.tsx        ← visão global de usuários
│       │   │       ├── apps/
│       │   │       │   └── page.tsx        ← catálogo de apps
│       │   │       └── audit/
│       │   │           └── page.tsx        ← trilha de auditoria global
│       │   ├── lib/
│       │   │   └── admin-guard.ts      ← verifica is_master_global
│       │   └── middleware.ts
│       ├── package.json
│       └── next.config.ts
│
├── packages/
│   ├── db/                         ← Pacote de banco de dados compartilhado
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── index.ts            ← exporta todos os schemas
│   │   │   │   ├── tenants.ts          ← tabela tenants
│   │   │   │   ├── users.ts            ← tabela users
│   │   │   │   ├── user-tenants.ts     ← tabela user_tenants
│   │   │   │   ├── apps.ts             ← tabela apps
│   │   │   │   ├── app-subscriptions.ts
│   │   │   │   ├── refresh-tokens.ts
│   │   │   │   └── audit-logs.ts
│   │   │   ├── repos/              ← Repository Pattern (NUNCA chamar db direto)
│   │   │   │   ├── TenantRepo.ts
│   │   │   │   ├── UserRepo.ts
│   │   │   │   ├── UserTenantRepo.ts
│   │   │   │   ├── AppRepo.ts
│   │   │   │   ├── RefreshTokenRepo.ts
│   │   │   │   └── AuditRepo.ts
│   │   │   ├── migrations/         ← arquivos .sql gerados pelo Drizzle Kit
│   │   │   ├── client.ts           ← instância do Drizzle (singleton)
│   │   │   ├── rls.ts              ← helper para SET app.current_tenant_id
│   │   │   └── index.ts            ← exportações públicas do pacote
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── auth-shared/                ← Tipos e helpers compartilhados entre todos os apps
│   │   ├── src/
│   │   │   ├── middleware.ts       ← middleware SSO reutilizável (copiar para cada app)
│   │   │   ├── types.ts            ← JWTPayload, TenantStatus, Role, Permission
│   │   │   ├── guards.ts           ← funções: canAccess(), hasRole(), isMasterGlobal()
│   │   │   ├── cache.ts            ← Redis: get/set/invalidate tenant status
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                         ← Componentes visuais compartilhados
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── AppLauncher/    ← menu lateral com apps disponíveis
│   │   │   │   │   ├── index.tsx
│   │   │   │   │   └── AppIcon.tsx
│   │   │   │   ├── TenantBadge/    ← exibe empresa ativa
│   │   │   │   ├── StatusBadge/    ← ativo | inadimplente | bloqueado
│   │   │   │   ├── InadimplenteBanner/ ← aviso de cobrança pendente
│   │   │   │   └── UserAvatar/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── config/                     ← Configurações compartilhadas
│       ├── eslint/
│       │   └── index.js
│       ├── typescript/
│       │   └── base.json
│       └── tailwind/
│           └── base.ts
```

---

## 3. AGENTES E MÓDULOS

> Cada agente tem **uma única responsabilidade**. Nunca misturar lógicas entre agentes.

### 3.1 AuthAgent — `apps/auth/src/lib/`

**Responsabilidade:** Emissão, validação e revogação de tokens JWT.

```typescript
// Contrato público do AuthAgent
interface AuthAgent {
  // Emite par de tokens após login bem-sucedido
  issueTokens(userId: string, tenantId: string, role: Role): Promise<TokenPair>

  // Valida accessToken; retorna payload ou lança JWTError
  verifyAccessToken(token: string): Promise<JWTPayload>

  // Valida refreshToken; emite novo accessToken
  refreshAccessToken(refreshToken: string): Promise<AccessToken>

  // Revoga refreshToken específico (logout)
  revokeToken(tokenHash: string): Promise<void>

  // Revoga TODOS os tokens de um tenant (bloqueio)
  revokeAllTenantTokens(tenantId: string): Promise<void>
}
```

**Regras:**
- `accessToken`: JWT, expira em `JWT_ACCESS_EXPIRES` (padrão 15min)
- `refreshToken`: JWT, expira em `JWT_REFRESH_EXPIRES` (padrão 7d), armazenado como **hash SHA-256** na tabela `refresh_tokens`
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, `domain=COOKIE_DOMAIN`
- **NUNCA** expor token via URL, query string ou body de resposta visível ao JS do cliente

---

### 3.2 SessionAgent — `apps/auth/src/lib/session.ts`

**Responsabilidade:** Gestão do ciclo de vida das sessões.

```typescript
interface SessionAgent {
  createSession(userId: string, tenantId: string, meta: SessionMeta): Promise<Session>
  getActiveSessions(userId: string): Promise<Session[]>
  revokeSession(sessionId: string): Promise<void>
  revokeAllUserSessions(userId: string): Promise<void>
  revokeAllTenantSessions(tenantId: string): Promise<void>
  cleanExpiredSessions(): Promise<number>  // usado pelo cron
}
```

---

### 3.3 TenantAgent — `packages/db/src/repos/TenantRepo.ts`

**Responsabilidade:** CRUD de empresas e controle de status (apenas `master_global`).

```typescript
interface TenantRepo {
  findById(id: string): Promise<Tenant | null>
  findBySlug(slug: string): Promise<Tenant | null>
  listAll(filters?: TenantFilters): Promise<Tenant[]>         // apenas master_global
  create(data: CreateTenantDTO): Promise<Tenant>              // apenas master_global
  updateStatus(id: string, status: TenantStatus, notes?: string): Promise<void>
  updateExternalBillingId(id: string, externalId: string): Promise<void>
}
```

**Regra crítica:** Após `updateStatus`, sempre chamar `CacheAgent.invalidateTenantStatus(id)`.

---

### 3.4 UserAgent — `packages/db/src/repos/UserRepo.ts`

**Responsabilidade:** CRUD de usuários e vínculos com empresas.

```typescript
interface UserRepo {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(data: CreateUserDTO): Promise<User>
  updatePassword(id: string, hash: string): Promise<void>
  updateLastLogin(id: string): Promise<void>

  // Vínculos tenant
  linkToTenant(userId: string, tenantId: string, role: Role): Promise<void>
  getUserTenants(userId: string): Promise<UserTenant[]>
  getUserRoleInTenant(userId: string, tenantId: string): Promise<UserTenant | null>
  setUserStatusInTenant(userId: string, tenantId: string, status: UserStatus): Promise<void>
  updateUserPermissions(userId: string, tenantId: string, permissions: Permissions): Promise<void>
}
```

---

### 3.5 PermissionAgent — `packages/auth-shared/src/guards.ts`

**Responsabilidade:** Verificação de permissões e roles em qualquer ponto da aplicação.

```typescript
interface PermissionAgent {
  isMasterGlobal(payload: JWTPayload): boolean
  hasRole(payload: JWTPayload, role: Role | Role[]): boolean
  canAccess(payload: JWTPayload, permission: string): boolean
  // Regras de hierarquia:
  canManageUser(actor: JWTPayload, target: UserTenant): boolean
  // admin NÃO pode gerenciar owner; owner NÃO pode gerenciar master_global
}
```

---

### 3.6 CacheAgent — `packages/auth-shared/src/cache.ts`

**Responsabilidade:** Cache Redis para status de tenant (evitar consulta ao banco a cada request).

```typescript
interface CacheAgent {
  getTenantStatus(tenantId: string): Promise<TenantStatus | null>
  setTenantStatus(tenantId: string, status: TenantStatus, ttlSeconds?: number): Promise<void>
  invalidateTenantStatus(tenantId: string): Promise<void>  // chamado após qualquer mudança
  
  // TTL padrão: 300 segundos (5 minutos)
  // Ao bloquear tenant: invalidar imediatamente (não esperar TTL expirar)
}
```

---

### 3.7 WebhookAgent — `apps/auth/src/app/api/auth/webhooks/billing/route.ts`

**Responsabilidade:** Receber notificações do sistema de faturamento externo e atualizar status do tenant.

```typescript
// Eventos tratados:
// "payment.overdue"        → status = inadimplente
// "invoice.paid"           → status = ativo
// "subscription.cancelled" → status = bloqueado + revogar sessões
// "subscription.activated" → status = ativo

// Autenticação: HMAC-SHA256(rawBody, BILLING_WEBHOOK_SECRET)
// Todos os eventos (tratados ou não) → registrar em audit_logs
```

---

### 3.8 AuditAgent — `packages/db/src/repos/AuditRepo.ts`

**Responsabilidade:** Registrar todas as ações sensíveis com imutabilidade.

```typescript
interface AuditRepo {
  log(entry: AuditEntry): Promise<void>
}

interface AuditEntry {
  tenantId?: string       // null para ações de master_global
  userId: string          // quem executou
  action: AuditAction     // enum de ações permitidas
  targetType: 'user' | 'tenant' | 'app' | 'session' | 'webhook'
  targetId: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

// Ações que SEMPRE devem gerar audit log:
// tenant.created, tenant.status_changed, tenant.blocked
// user.created, user.invited, user.activated, user.deactivated
// user.role_changed, user.permissions_changed
// session.created, session.revoked, session.all_revoked
// webhook.received, webhook.processed
// auth.login, auth.logout, auth.login_failed
// master.action (qualquer ação do master_global)
```

---

### 3.9 MiddlewareAgent — `packages/auth-shared/src/middleware.ts`

**Responsabilidade:** Middleware SSO reutilizável. **Copiar para `middleware.ts` de cada app.**

```typescript
// Hierarquia de verificação (TOP-DOWN — não alterar a ordem):
// 1. JWT presente e válido?                → não: redirect /login
// 2. Tenant no payload existe?             → não: redirect /login
// 3. Tenant status = "bloqueado"?          → sim: HTTP 403 página estática
// 4. Tenant status = "inativo"?            → sim: HTTP 403 página encerramento
// 5. Tenant status = "inadimplente"?       → sim: injetar header x-tenant-warning
// 6. Usuário status neste tenant = ativo?  → não: HTTP 403 "acesso suspenso"
// 7. Usuário tem acesso ao app atual?      → não: HTTP 403 "app não disponível"
// 8. Tudo ok: injetar headers e prosseguir

// Headers injetados (disponíveis em Server Components via headers()):
// x-user-id        → payload.userId
// x-tenant-id      → payload.tenantId
// x-user-role      → payload.role
// x-tenant-status  → status do tenant (para exibir banners)
// x-user-perms     → JSON.stringify(payload.permissions)
```

---

### 3.10 AppLauncher — `packages/ui/src/components/AppLauncher/`

**Responsabilidade:** Menu lateral com apps disponíveis para o usuário logado.

```typescript
// Lógica:
// 1. Ler payload do cookie (client-side via endpoint /api/auth/validate)
// 2. Filtrar apps onde: app_subscriptions.active = true para o tenant
//                   E: usuário tem acesso àquele app
// 3. Renderizar lista de apps com ícone e link
// 4. Navegar entre apps: cookie HTTP-Only vai automaticamente (sem novo login)
// NUNCA passar token via URL
```

---

## 4. SKILLS (CAPACIDADES REUTILIZÁVEIS)

> Skills são funções/helpers que podem ser usadas por múltiplos agentes.

### 4.1 Skill: JWT

**Arquivo:** `apps/auth/src/lib/jwt.ts`

```typescript
// Implementar usando: jose (biblioteca recomendada — sem dependência de Node crypto nativo)
// Compatível com Edge Runtime do Next.js

export async function signJWT(payload: JWTPayload, expiresIn: string): Promise<string>
export async function verifyJWT(token: string): Promise<JWTPayload>
export function hashToken(token: string): string  // SHA-256 hex
```

---

### 4.2 Skill: Password

**Arquivo:** `apps/auth/src/lib/password.ts`

```typescript
// Usar: bcryptjs (compatível com Edge)
// Custo mínimo: 12

export async function hashPassword(plain: string): Promise<string>
export async function comparePassword(plain: string, hash: string): Promise<boolean>
export function validatePasswordStrength(password: string): ValidationResult
// Mínimo: 8 chars, 1 maiúscula, 1 número, 1 símbolo
```

---

### 4.3 Skill: Cookies

**Arquivo:** `apps/auth/src/lib/cookies.ts`

```typescript
// Configuração padrão dos cookies SSO
const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  domain: process.env.COOKIE_DOMAIN,  // ex: .seudominio.com
  path: '/',
}

export function setAuthCookies(response: NextResponse, tokens: TokenPair): void
export function clearAuthCookies(response: NextResponse): void
export function getTokenFromCookies(request: NextRequest): string | undefined
```

---

### 4.4 Skill: RLS Context

**Arquivo:** `packages/db/src/rls.ts`

```typescript
// SEMPRE usar esta função antes de qualquer query que acesse dados de tenant
// Garanta que seja chamada dentro de uma transaction

export async function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}`)
    return fn()
  })
}
```

---

### 4.5 Skill: Result Pattern

**Arquivo:** `packages/auth-shared/src/types.ts`

```typescript
// Usar Result<T, E> em vez de throws para erros esperados
type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E }

type AppError = {
  code: ErrorCode
  message: string
  statusCode: number
}

enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TENANT_BLOCKED = 'TENANT_BLOCKED',
  TENANT_INACTIVE = 'TENANT_INACTIVE',
  USER_INACTIVE = 'USER_INACTIVE',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NOT_FOUND = 'NOT_FOUND',
}
```

---

### 4.6 Skill: HMAC Webhook Validator

**Arquivo:** `apps/auth/src/lib/webhook.ts`

```typescript
// Valida autenticidade dos webhooks do sistema de faturamento externo
export function validateWebhookSignature(
  rawBody: string,
  signature: string,        // header: x-webhook-signature
  secret: string            // BILLING_WEBHOOK_SECRET
): boolean
// Implementar com: crypto.timingSafeEqual (evita timing attacks)
```

---

## 5. BANCO DE DADOS — SCHEMA COMPLETO

> ORM: Drizzle. Banco: PostgreSQL. Migrations: Drizzle Kit → arquivos `.sql` padrão.  
> **NUNCA** usar extensões proprietárias do Neon no código da aplicação.

### 5.1 Tipos Customizados (Enums)

```sql
CREATE TYPE tenant_status AS ENUM ('ativo', 'inativo', 'inadimplente', 'bloqueado');
CREATE TYPE user_role     AS ENUM ('owner', 'admin', 'user');
CREATE TYPE user_status   AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE app_env       AS ENUM ('production', 'sandbox');
```

---

### 5.2 Tabela: `tenants`

```sql
CREATE TABLE tenants (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  slug                VARCHAR(100) UNIQUE NOT NULL,     -- ex: escritorio-silva
  status              tenant_status NOT NULL DEFAULT 'ativo',
  status_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logo_url            TEXT,                              -- URL da logo marca do tenant
  internal_notes      TEXT,                              -- visível só ao master_global
  external_billing_id VARCHAR(255),                      -- ID no Asaas/Stripe/etc
  plan                VARCHAR(50)  NOT NULL DEFAULT 'basic',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_status ON tenants (status);
CREATE INDEX idx_tenants_slug   ON tenants (slug);
```

**Drizzle Schema:** `packages/db/src/schema/tenants.ts`

```typescript
export const tenants = pgTable('tenants', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  name:               varchar('name', { length: 255 }).notNull(),
  slug:               varchar('slug', { length: 100 }).notNull().unique(),
  status:             tenantStatusEnum('status').notNull().default('ativo'),
  statusUpdatedAt:    timestamp('status_updated_at', { withTimezone: true }).notNull().defaultNow(),
  logoUrl:            text('logo_url'),
  internalNotes:      text('internal_notes'),
  externalBillingId:  varchar('external_billing_id', { length: 255 }),
  plan:               varchar('plan', { length: 50 }).notNull().default('basic'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

### 5.3 Tabela: `users`

```sql
CREATE TABLE users (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    TEXT         NOT NULL,
  full_name        VARCHAR(255) NOT NULL,
  is_master_global BOOLEAN      NOT NULL DEFAULT FALSE,  -- TRUE apenas para o dono da plataforma
  avatar_url       TEXT,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
```

**Drizzle Schema:** `packages/db/src/schema/users.ts`

```typescript
export const users = pgTable('users', {
  id:              uuid('id').primaryKey().defaultRandom(),
  email:           varchar('email', { length: 255 }).notNull().unique(),
  passwordHash:    text('password_hash').notNull(),
  fullName:        varchar('full_name', { length: 255 }).notNull(),
  isMasterGlobal:  boolean('is_master_global').notNull().default(false),
  avatarUrl:       text('avatar_url'),
  lastLoginAt:     timestamp('last_login_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

### 5.4 Tabela: `user_tenants` (RBAC)

```sql
CREATE TABLE user_tenants (
  user_id        UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role           user_role    NOT NULL DEFAULT 'user',
  status         user_status  NOT NULL DEFAULT 'pending',
  permissions    JSONB        NOT NULL DEFAULT '{}',
  invited_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
  invited_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  activated_at   TIMESTAMPTZ,
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX idx_user_tenants_tenant   ON user_tenants (tenant_id);
CREATE INDEX idx_user_tenants_status   ON user_tenants (tenant_id, status);
```

**Estrutura do campo `permissions` (JSONB):**
```json
{
  "can_invite_users": true,
  "can_manage_users": false,
  "can_view_reports": true,
  "can_export_data": false,
  "custom": {}
}
```

**Regras de hierarquia (implementar no PermissionAgent):**
- `admin` NÃO pode alterar ou inativar um `owner`
- `owner` NÃO pode alterar `is_master_global`
- `master_global` é verificado na tabela `users`, não em `user_tenants`

---

### 5.5 Tabela: `apps`

```sql
CREATE TABLE apps (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50)  NOT NULL UNIQUE,   -- 'kontohub', 'kontozap', 'billing'
  display_name VARCHAR(100) NOT NULL,          -- 'KontoHub', 'KontoZap'
  description  TEXT,
  base_url     VARCHAR(255) NOT NULL,          -- https://kontohub.seudominio.com
  icon_url     TEXT,
  api_key      UUID         NOT NULL DEFAULT gen_random_uuid(),  -- comunicação inter-apps
  env          app_env      NOT NULL DEFAULT 'production',
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**Dados iniciais (seed obrigatório):**
```sql
INSERT INTO apps (name, display_name, base_url) VALUES
  ('auth',     'Auth',     'https://auth.seudominio.com'),
  ('admin',    'Admin',    'https://admin.seudominio.com'),
  ('kontohub', 'KontoHub', 'https://kontohub.seudominio.com'),
  ('kontozap', 'KontoZap', 'https://kontozap.seudominio.com');
```

---

### 5.6 Tabela: `app_subscriptions`

```sql
CREATE TABLE app_subscriptions (
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id      UUID        NOT NULL REFERENCES apps(id)    ON DELETE CASCADE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,                -- NULL = sem expiração
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, app_id)
);

CREATE INDEX idx_app_subscriptions_tenant ON app_subscriptions (tenant_id, active);
```

---

### 5.7 Tabela: `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,  -- SHA-256 do token (NUNCA o token em si)
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,                  -- NULL = ativo
  user_agent   TEXT,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user      ON refresh_tokens (user_id, revoked_at);
CREATE INDEX idx_refresh_tokens_tenant    ON refresh_tokens (tenant_id, revoked_at);
CREATE INDEX idx_refresh_tokens_expires   ON refresh_tokens (expires_at)
  WHERE revoked_at IS NULL;
```

---

### 5.8 Tabela: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id           BIGSERIAL   PRIMARY KEY,
  tenant_id    UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(100) NOT NULL,       -- ex: 'tenant.blocked', 'user.deactivated'
  target_type  VARCHAR(50)  NOT NULL,       -- 'tenant' | 'user' | 'app' | 'session'
  target_id    TEXT         NOT NULL,       -- UUID ou identificador do alvo
  metadata     JSONB        NOT NULL DEFAULT '{}',
  ip_address   INET,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Audit logs são IMUTÁVEIS: sem UPDATE, sem DELETE
-- Índices para consultas do painel admin
CREATE INDEX idx_audit_tenant_date   ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_action_date   ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_user_date     ON audit_logs (user_id, created_at DESC);
```

---

### 5.9 Row Level Security (RLS)

```sql
-- HABILITAR em todas as tabelas de negócio dos apps futuros
-- As tabelas do core (auth) não precisam de RLS pois os repos já filtram por tenant_id

-- Padrão para apps futuros (kontohub, kontozap):
ALTER TABLE <tabela_do_app> ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON <tabela_do_app>
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Índice obrigatório em tabelas com RLS:
CREATE INDEX idx_<tabela>_tenant_created ON <tabela> (tenant_id, created_at DESC);
```

**Helper obrigatório (usar em TODA query que toque dados de tenant):**

```typescript
// packages/db/src/rls.ts
export async function withTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}`)
    return fn()
  })
}
```

---

### 5.10 Migration Strategy

```bash
# Gerar migration
pnpm db:generate

# Aplicar em desenvolvimento
pnpm db:migrate

# Aplicar em produção (usa DIRECT_URL, não o pooler)
pnpm db:migrate:prod

# Seed inicial (apps + usuário master_global)
pnpm db:seed
```

```typescript
// drizzle.config.ts
export default {
  schema:    './src/schema/index.ts',
  out:       './src/migrations',
  driver:    'pg',
  dbCredentials: {
    connectionString: process.env.DIRECT_URL!,  // sempre usar DIRECT_URL para migrations
  },
} satisfies Config
```

---

## 6. VARIÁVEIS DE AMBIENTE

```bash
# .env.example — copiar para .env.local e preencher

# ─── Banco de Dados ────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://user:pass@host/db"       # migrations — sem pooler

# ─── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET="gerar-com-openssl-rand-base64-64"     # mínimo 256 bits
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# ─── Cookies SSO ───────────────────────────────────────────────────────────────
COOKIE_DOMAIN=".seudominio.com"                   # domínio pai com ponto
NEXT_PUBLIC_AUTH_URL="https://auth.seudominio.com"

# ─── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL="rediss://default:password@host:port"   # Upstash ou Vercel KV

# ─── Faturamento Externo ────────────────────────────────────────────────────────
BILLING_WEBHOOK_SECRET="gerar-com-openssl-rand-hex-32"

# ─── Usuário Master Global (seed inicial) ──────────────────────────────────────
MASTER_EMAIL="seu@email.com"
MASTER_PASSWORD="senha-temporaria-trocar-apos-deploy"

# ─── App URLs (usadas pelo AppLauncher) ────────────────────────────────────────
NEXT_PUBLIC_KONTOHUB_URL="https://kontohub.seudominio.com"
NEXT_PUBLIC_KONTOZAP_URL="https://kontozap.seudominio.com"
NEXT_PUBLIC_ADMIN_URL="https://admin.seudominio.com"

# ─── Ambiente ──────────────────────────────────────────────────────────────────
NODE_ENV="production"
```

---

## 7. REGRAS OBRIGATÓRIAS DE DESENVOLVIMENTO

### 7.1 Banco de Dados

- [ ] **SEMPRE** usar Drizzle ORM via Repository — **NUNCA** SQL raw direto em componentes ou API routes
- [ ] **SEMPRE** chamar `withTenantContext(tenantId, fn)` antes de queries em tabelas com RLS
- [ ] **NUNCA** usar extensões proprietárias do Neon no código da aplicação
- [ ] **SEMPRE** usar `DIRECT_URL` para migrations, `DATABASE_URL` para queries
- [ ] **SEMPRE** usar `gen_random_uuid()` (padrão PostgreSQL 13+) em vez de `uuid_generate_v4()`
- [ ] **NUNCA** fazer `SELECT *` — sempre listar os campos necessários

### 7.2 Autenticação e Segurança

- [ ] Tokens JWT **APENAS** em cookies `HttpOnly` — **NUNCA** em `localStorage`, `sessionStorage` ou response body
- [ ] **NUNCA** passar token via URL ou query string
- [ ] `refreshToken` armazenado **APENAS** como hash SHA-256 no banco
- [ ] Todas as senhas com bcrypt custo **mínimo 12**
- [ ] Verificar HMAC nos webhooks com `crypto.timingSafeEqual` (evitar timing attacks)
- [ ] Rate limiting em `/api/auth/login`: máximo 5 tentativas por IP por minuto

### 7.3 Permissões

- [ ] Middleware executado em **toda** rota protegida — sem exceções
- [ ] Verificar `is_master_global` diretamente na tabela `users`, não no JWT
- [ ] `admin` **NUNCA** pode alterar ou inativar um `owner`
- [ ] Rotas `/admin/*` verificam `is_master_global` via `MasterGuard` adicional
- [ ] Após mudar status do tenant: **imediatamente** invalidar cache Redis

### 7.4 Código

- [ ] TypeScript `strict: true` em todos os pacotes
- [ ] Usar **Result Pattern** `{ ok: true, data }` / `{ ok: false, error }` — sem throws para erros esperados
- [ ] Testes unitários obrigatórios para: AuthAgent, PermissionAgent, MiddlewareAgent
- [ ] **NUNCA** logar senhas, tokens ou dados pessoais
- [ ] Variáveis de ambiente acessadas apenas via arquivo de configuração — nunca `process.env.X` espalhado

### 7.5 Portabilidade

- [ ] **NUNCA** usar recursos específicos do Neon no código (Branching, etc.)
- [ ] Toda troca de banco = apenas mudar `DATABASE_URL` e `DIRECT_URL`
- [ ] Código deve rodar em Vercel, Docker e VPS sem alterações

---

## 8. FLUXOS PRINCIPAIS

### 8.1 Login SSO

```
1. Usuário acessa kontohub.seudominio.com
2. Middleware detecta: sem cookie válido
3. Redirect → auth.seudominio.com/login?return_to=https://kontohub...
4. Usuário preenche email + senha
5. AuthAgent.verifyCredentials() → ok
6. Se usuário pertence a 1 tenant: selecionar automaticamente
   Se pertence a múltiplos: exibir /select-tenant
7. AuthAgent.issueTokens(userId, tenantId, role)
8. SessionAgent.createSession(...)
9. Cookies setados em .seudominio.com
10. Redirect → return_to URL
11. Middleware do kontohub: cookie válido → acesso liberado
12. Usuário navega para kontozap: cookie já presente → sem novo login
```

### 8.2 Bloqueio de Tenant

```
1. master_global acessa /admin/tenants/[id]
2. Clica em "Bloquear empresa"
3. API PATCH /api/admin/tenants/[id]/status { status: "bloqueado", notes: "..." }
4. MasterGuard verifica is_master_global === true
5. TenantRepo.updateStatus(id, "bloqueado", notes)
6. CacheAgent.invalidateTenantStatus(id)          ← imediato
7. SessionAgent.revokeAllTenantSessions(id)        ← revoga tokens ativos
8. AuditRepo.log({ action: "tenant.blocked", ... })
9. Próximo request de qualquer usuário desse tenant:
   Middleware lê Redis → status "bloqueado" → HTTP 403 página estática
```

### 8.3 Convite de Usuário

```
1. Admin/Owner acessa painel da empresa → Usuários → Convidar
2. Insere: email, role, permissions
3. POST /api/admin/users/invite
4. UserRepo.findByEmail(email):
   ├─ Existe: UserRepo.linkToTenant(userId, tenantId, role) → status: "pending"
   └─ Não existe: UserRepo.create({email, ...}) → UserRepo.linkToTenant(...)
5. Enviar email de convite com link único (token de convite, expira em 48h)
6. Usuário clica no link → define senha → status vira "active"
7. AuditRepo.log({ action: "user.invited", ... })
```

### 8.4 Webhook de Faturamento

```
1. Sistema externo POST /api/auth/webhooks/billing
   Headers: x-webhook-signature: hmac-sha256-do-body
2. WebhookAgent.validateSignature(rawBody, signature) → inválido: HTTP 401
3. Parse do evento
4. Switch por tipo de evento:
   "payment.overdue"        → TenantRepo.updateStatus("inadimplente")
   "invoice.paid"           → TenantRepo.updateStatus("ativo")
   "subscription.cancelled" → TenantRepo.updateStatus("bloqueado")
                               + SessionAgent.revokeAllTenantSessions()
5. CacheAgent.invalidateTenantStatus()
6. AuditRepo.log({ action: "webhook.processed", metadata: { event, tenantId } })
7. HTTP 200 { received: true }
```

---

## 9. API CONTRACTS

### Auth Service

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| POST | `/api/auth/login` | Público | Login com email + senha |
| POST | `/api/auth/logout` | Autenticado | Revoga sessão atual |
| POST | `/api/auth/refresh` | Cookie válido | Renova accessToken |
| GET  | `/api/auth/validate` | Cookie válido | Valida sessão (usado pelos outros apps) |
| POST | `/api/auth/invite/accept` | Token de convite | Define senha e ativa usuário |
| POST | `/api/auth/webhooks/billing` | HMAC signature | Recebe eventos de faturamento |

### Admin API (apenas master_global)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | `/api/admin/tenants` | Lista todas as empresas |
| POST   | `/api/admin/tenants` | Cadastra nova empresa |
| GET    | `/api/admin/tenants/[id]` | Detalhe da empresa |
| PATCH  | `/api/admin/tenants/[id]/status` | Altera status (bloqueio, etc.) |
| GET    | `/api/admin/users` | Lista global de usuários |
| GET    | `/api/admin/audit` | Trilha de auditoria global |
| GET    | `/api/admin/apps` | Catálogo de apps |
| POST   | `/api/admin/apps` | Cadastra novo app |

### Tenant Admin API (owner / admin)

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | `/api/tenant/users` | admin+ | Lista usuários da empresa |
| POST   | `/api/tenant/users/invite` | admin+ | Convida usuário |
| PATCH  | `/api/tenant/users/[id]/status` | admin+ | Ativa/inativa usuário |
| PATCH  | `/api/tenant/users/[id]/permissions` | admin+ | Atualiza permissões |
| GET    | `/api/tenant/apps` | user+ | Apps disponíveis para a empresa |

---

## 10. ORDEM DE EXECUÇÃO DO DESENVOLVIMENTO

O Claude Code deve seguir esta sequência. **Não pular etapas.**

```
FASE 1 — Infraestrutura Base
├── [ ] 1.1 Inicializar monorepo com Turborepo + pnpm workspaces
├── [ ] 1.2 Configurar packages/config (TypeScript, ESLint, Tailwind)
├── [ ] 1.3 Criar packages/db com schema Drizzle (todas as tabelas)
├── [ ] 1.4 Gerar e aplicar migration inicial
└── [ ] 1.5 Criar seed (apps + usuário master_global)

FASE 2 — Auth Service
├── [ ] 2.1 Implementar AuthAgent (JWT, cookies, password)
├── [ ] 2.2 Implementar SessionAgent
├── [ ] 2.3 Implementar todos os Repositories (TenantRepo, UserRepo, etc.)
├── [ ] 2.4 Implementar CacheAgent (Redis)
├── [ ] 2.5 Criar API routes: login, logout, refresh, validate
└── [ ] 2.6 Criar páginas: /login, /select-tenant, /blocked

FASE 3 — Middleware SSO
├── [ ] 3.1 Implementar MiddlewareAgent em packages/auth-shared
├── [ ] 3.2 Implementar PermissionAgent e guards
└── [ ] 3.3 Configurar middleware nos apps auth e admin

FASE 4 — Painel Admin (master_global)
├── [ ] 4.1 Criar layout do app admin com MasterGuard
├── [ ] 4.2 Dashboard com métricas (total tenants, ativos, bloqueados)
├── [ ] 4.3 CRUD de tenants com controle de status
├── [ ] 4.4 Visualização global de usuários
├── [ ] 4.5 Catálogo de apps e subscriptions
└── [ ] 4.6 Trilha de auditoria com filtros

FASE 5 — Funcionalidades de Tenant
├── [ ] 5.1 Painel de usuários da empresa (owner/admin)
├── [ ] 5.2 Fluxo de convite de usuário
├── [ ] 5.3 Ativação via link de convite
└── [ ] 5.4 Matriz de permissões granulares

FASE 6 — Integrações
├── [ ] 6.1 Webhook de faturamento externo
├── [ ] 6.2 AppLauncher (packages/ui)
├── [ ] 6.3 Banner de inadimplência
└── [ ] 6.4 Página de bloqueio estática (403)

FASE 7 — Qualidade
├── [ ] 7.1 Testes unitários: AuthAgent, PermissionAgent, Middleware
├── [ ] 7.2 Testes de integração: fluxo login, bloqueio, convite
├── [ ] 7.3 Revisão de segurança (rate limiting, headers HTTP)
└── [ ] 7.4 Documentação das APIs (OpenAPI/Swagger)
```

---

## NOTAS FINAIS PARA O CLAUDE CODE

1. **Este CLAUDE.md é a fonte da verdade.** Em caso de dúvida, consultar aqui antes de tomar qualquer decisão arquitetural.

2. **Novos apps futuros** (KontoHub, KontoZap, Billing) seguirão este mesmo padrão:
   - Copiar `packages/auth-shared/src/middleware.ts` para o novo app
   - Inserir o app na tabela `apps`
   - Criar `app_subscriptions` para os tenants que contratarem
   - **Zero alteração** no Auth Service ou Admin

3. **Portabilidade garantida:** Toda mudança de provedor de banco é feita alterando apenas `DATABASE_URL` e `DIRECT_URL` no arquivo `.env`. Nenhuma linha de código da aplicação precisa mudar.

4. **Segurança é inegociável:** Nenhuma rota deve ser acessível sem passar pelo middleware. A ordem de verificação do middleware não deve ser alterada sem análise de impacto.

5. **AuditLog é imutável:** A tabela `audit_logs` não recebe UPDATE nem DELETE. Jamais.
