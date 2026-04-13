-- Migration: 0006_user_app_access
-- Controle de acesso a apps por usuário dentro de um tenant.
--
-- Regras:
--   - admin e master_global têm acesso a todos os apps do tenant (verificado no middleware)
--   - user só acessa apps que estejam nesta tabela para seu (user_id, tenant_id)
--   - ao cadastrar um usuário, o admin define quais apps ele pode acessar
--   - ao revogar, remove-se a linha correspondente

CREATE TABLE "user_app_access" (
  "user_id"    UUID        NOT NULL REFERENCES "users"("id")   ON DELETE CASCADE,
  "tenant_id"  UUID        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "app_id"     UUID        NOT NULL REFERENCES "apps"("id")    ON DELETE CASCADE,
  "granted_by" UUID        REFERENCES "users"("id")            ON DELETE SET NULL,
  "granted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("user_id", "tenant_id", "app_id")
);

CREATE INDEX "idx_user_app_access_user_tenant"
  ON "user_app_access" ("user_id", "tenant_id");

CREATE INDEX "idx_user_app_access_tenant_app"
  ON "user_app_access" ("tenant_id", "app_id");
