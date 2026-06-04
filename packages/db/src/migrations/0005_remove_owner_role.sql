-- Migration: 0005_remove_owner_role (idempotente)
-- Remove o valor 'owner' do enum user_role.
-- Hierarquia final: master_global (campo na tabela users) → admin → user
--
-- PostgreSQL não permite DROP VALUE em enums. Estratégia: converter colunas para TEXT,
-- reclassificar 'owner'→'admin', recriar o enum sem 'owner' e reconverter.
-- Idempotente: só executa se 'owner' ainda existir no enum.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'owner'
  ) THEN
    -- 1. Remover default e converter colunas para TEXT
    ALTER TABLE "user_tenants"  ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "user_tenants"  ALTER COLUMN "role" TYPE TEXT;
    ALTER TABLE "invite_tokens" ALTER COLUMN "role" TYPE TEXT;

    -- 2. Reclassificar 'owner' → 'admin'
    UPDATE "user_tenants"  SET "role" = 'admin' WHERE "role" = 'owner';
    UPDATE "invite_tokens" SET "role" = 'admin' WHERE "role" = 'owner';

    -- 3. Recriar o enum sem 'owner'
    DROP TYPE "user_role";
    CREATE TYPE "user_role" AS ENUM ('admin', 'user');

    -- 4. Reconverter as colunas e restaurar default
    ALTER TABLE "user_tenants"
      ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";
    ALTER TABLE "user_tenants"
      ALTER COLUMN "role" SET DEFAULT 'user';
    ALTER TABLE "invite_tokens"
      ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";
  END IF;
END $$;
