-- Migration 0009: P3 — adiciona gotrue_id a users e desacopla FKs para GoTrue UUIDs
--
-- Objetivo: permitir que refresh_tokens e audit_logs usem GoTrue UUID (auth.users.id)
-- enquanto Neon continua como registro de identidade com campo gotrue_id como bridge.
-- password_reset_tokens.user_id passará a armazenar GoTrue UUID, então a FK para
-- users.id (Neon UUID) é removida.
--
-- Rollback:
--   ALTER TABLE "password_reset_tokens"
--     ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
--     FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "gotrue_id";

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gotrue_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_gotrue_id" ON "users" ("gotrue_id");

-- Popula o usuário existente com o GoTrue UUID (9ac3f94b-572b-46e6-b0ec-0f10e127d4a6)
UPDATE "users"
SET "gotrue_id" = '9ac3f94b-572b-46e6-b0ec-0f10e127d4a6'
WHERE "email" = 'asdirkratz@gmail.com';

-- Remove FK de password_reset_tokens → users (passará a usar GoTrue UUID como user_id)
ALTER TABLE "password_reset_tokens"
  DROP CONSTRAINT IF EXISTS "password_reset_tokens_user_id_fkey";
