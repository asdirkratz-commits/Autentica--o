-- Migration: 0003_tenant_theme_ai
-- Adiciona coluna de tema (cores white-label) e configuração de IA por tenant

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "theme"     TEXT,
  ADD COLUMN IF NOT EXISTS "ai_config" TEXT;   -- JSON criptografado (chaves de IA)
