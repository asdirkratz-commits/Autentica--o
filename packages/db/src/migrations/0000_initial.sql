-- Migration: 0000_initial
-- Criação do schema completo do ecossistema de autenticação SSO multi-tenant

-- ─── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "tenant_status" AS ENUM ('ativo', 'inativo', 'inadimplente', 'bloqueado');
CREATE TYPE "user_role"     AS ENUM ('owner', 'admin', 'user');
CREATE TYPE "user_status"   AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE "app_env"       AS ENUM ('production', 'sandbox');

-- ─── tenants ─────────────────────────────────────────────────────────────────
CREATE TABLE "tenants" (
  "id"                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                VARCHAR(255) NOT NULL,
  "slug"                VARCHAR(100) NOT NULL UNIQUE,
  "status"              "tenant_status" NOT NULL DEFAULT 'ativo',
  "status_updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "internal_notes"      TEXT,
  "external_billing_id" VARCHAR(255),
  "plan"                VARCHAR(50)  NOT NULL DEFAULT 'basic',
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_tenants_status" ON "tenants" ("status");
CREATE INDEX "idx_tenants_slug"   ON "tenants" ("slug");

-- ─── users ───────────────────────────────────────────────────────────────────
CREATE TABLE "users" (
  "id"               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"            VARCHAR(255) NOT NULL UNIQUE,
  "password_hash"    TEXT        NOT NULL,
  "full_name"        VARCHAR(255) NOT NULL,
  "is_master_global" BOOLEAN     NOT NULL DEFAULT FALSE,
  "avatar_url"       TEXT,
  "last_login_at"    TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_users_email" ON "users" ("email");

-- ─── user_tenants (RBAC) ─────────────────────────────────────────────────────
CREATE TABLE "user_tenants" (
  "user_id"      UUID        NOT NULL REFERENCES "users"("id")   ON DELETE CASCADE,
  "tenant_id"    UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "role"         "user_role" NOT NULL DEFAULT 'user',
  "status"       "user_status" NOT NULL DEFAULT 'pending',
  "permissions"  JSONB       NOT NULL DEFAULT '{}',
  "invited_by"   UUID        REFERENCES "users"("id") ON DELETE SET NULL,
  "invited_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "activated_at" TIMESTAMPTZ,
  PRIMARY KEY ("user_id", "tenant_id")
);

CREATE INDEX "idx_user_tenants_tenant" ON "user_tenants" ("tenant_id");
CREATE INDEX "idx_user_tenants_status" ON "user_tenants" ("tenant_id", "status");

-- ─── apps ────────────────────────────────────────────────────────────────────
CREATE TABLE "apps" (
  "id"           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"         VARCHAR(50)  NOT NULL UNIQUE,
  "display_name" VARCHAR(100) NOT NULL,
  "description"  TEXT,
  "base_url"     VARCHAR(255) NOT NULL,
  "icon_url"     TEXT,
  "api_key"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "env"          "app_env"   NOT NULL DEFAULT 'production',
  "active"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── app_subscriptions ───────────────────────────────────────────────────────
CREATE TABLE "app_subscriptions" (
  "tenant_id"  UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "app_id"     UUID        NOT NULL REFERENCES "apps"("id")    ON DELETE CASCADE,
  "active"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tenant_id", "app_id")
);

CREATE INDEX "idx_app_subscriptions_tenant" ON "app_subscriptions" ("tenant_id", "active");

-- ─── refresh_tokens ──────────────────────────────────────────────────────────
CREATE TABLE "refresh_tokens" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     UUID        NOT NULL REFERENCES "users"("id")   ON DELETE CASCADE,
  "tenant_id"   UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "token_hash"  TEXT        NOT NULL UNIQUE,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "revoked_at"  TIMESTAMPTZ,
  "user_agent"  TEXT,
  "ip_address"  INET,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_refresh_tokens_user"    ON "refresh_tokens" ("user_id",   "revoked_at");
CREATE INDEX "idx_refresh_tokens_tenant"  ON "refresh_tokens" ("tenant_id", "revoked_at");
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" ("expires_at");

-- ─── audit_logs (imutável) ───────────────────────────────────────────────────
CREATE TABLE "audit_logs" (
  "id"          BIGSERIAL    PRIMARY KEY,
  "tenant_id"   UUID         REFERENCES "tenants"("id") ON DELETE SET NULL,
  "user_id"     UUID         NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "action"      VARCHAR(100) NOT NULL,
  "target_type" VARCHAR(50)  NOT NULL,
  "target_id"   TEXT         NOT NULL,
  "metadata"    JSONB        NOT NULL DEFAULT '{}',
  "ip_address"  INET,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_audit_tenant_date" ON "audit_logs" ("tenant_id", "created_at" DESC);
CREATE INDEX "idx_audit_action_date" ON "audit_logs" ("action",    "created_at" DESC);
CREATE INDEX "idx_audit_user_date"   ON "audit_logs" ("user_id",   "created_at" DESC);

-- ─── invite_tokens ───────────────────────────────────────────────────────────
CREATE TABLE "invite_tokens" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"       VARCHAR(255) NOT NULL,
  "tenant_id"   UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "role"        "user_role"  NOT NULL,
  "permissions" JSONB       NOT NULL DEFAULT '{}',
  "invited_by"  UUID        NOT NULL REFERENCES "users"("id")   ON DELETE CASCADE,
  "token_hash"  TEXT        NOT NULL UNIQUE,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "used_at"     TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_invite_tokens_email_tenant" ON "invite_tokens" ("email", "tenant_id");
CREATE INDEX "idx_invite_tokens_expires"      ON "invite_tokens" ("expires_at");

-- ─── password_reset_tokens ───────────────────────────────────────────────────
CREATE TABLE "password_reset_tokens" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT        NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_password_reset_user"    ON "password_reset_tokens" ("user_id");
CREATE INDEX "idx_password_reset_expires" ON "password_reset_tokens" ("expires_at");
