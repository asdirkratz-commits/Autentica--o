-- Migration: 0005_remove_owner_role
-- Remove o valor 'owner' do enum user_role.
-- Hierarquia final: master_global (campo na tabela users) → admin → user
--
-- PostgreSQL não permite DROP VALUE em enums diretamente.
-- Estratégia: renomear o tipo antigo, criar o novo sem 'owner',
-- atualizar as colunas que o usam e remover o tipo antigo.

-- 1. Converter colunas que usam o enum para TEXT temporariamente
ALTER TABLE "user_tenants"   ALTER COLUMN "role" TYPE TEXT;
ALTER TABLE "invite_tokens"  ALTER COLUMN "role" TYPE TEXT;

-- 2. Reclassificar qualquer 'owner' existente para 'admin'
UPDATE "user_tenants"  SET "role" = 'admin' WHERE "role" = 'owner';
UPDATE "invite_tokens" SET "role" = 'admin' WHERE "role" = 'owner';

-- 3. Remover o enum antigo e criar o novo sem 'owner'
DROP TYPE "user_role";
CREATE TYPE "user_role" AS ENUM ('admin', 'user');

-- 4. Converter as colunas de volta para o novo enum
ALTER TABLE "user_tenants"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";
ALTER TABLE "user_tenants"
  ALTER COLUMN "role" SET DEFAULT 'user';

ALTER TABLE "invite_tokens"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";
