-- Migration: 0008_refresh_tokens_nullable_tenant
-- Permite refresh tokens sem tenant (master_global sem empresa selecionada), de
-- modo que a rotação e a detecção de reuse de refresh token (F-06) também cubram
-- esse caso — antes, a sessão desse usuário não era persistida e ficava sem rede.
-- A FK para tenants permanece (NULL não viola a referência).
-- Operação metadata-only no Postgres (instantânea, sem reescrita de tabela).
--
-- Rollback: ALTER TABLE "refresh_tokens" ALTER COLUMN "tenant_id" SET NOT NULL;
--   (aplicável apenas se não houver linhas com tenant_id NULL no momento)

ALTER TABLE "refresh_tokens" ALTER COLUMN "tenant_id" DROP NOT NULL;
