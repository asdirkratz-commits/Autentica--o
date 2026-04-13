-- Migration: 0002_tenant_cnpj_address
-- Adiciona campos de CNPJ e endereço completo na tabela tenants

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "cnpj"          VARCHAR(18),
  ADD COLUMN IF NOT EXISTS "zip_code"      VARCHAR(9),
  ADD COLUMN IF NOT EXISTS "street"        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "street_number" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "complement"    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "district"      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "city"          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "state"         VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "country"       VARCHAR(2) DEFAULT 'BR';

CREATE INDEX IF NOT EXISTS "idx_tenants_cnpj" ON "tenants" ("cnpj");
