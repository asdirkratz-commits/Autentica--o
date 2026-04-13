-- Migration: 0007_apps_parent
-- Adiciona parent_app_id em apps para agrupar módulos sob um app pai.
--
-- Exemplo: kontohub_ir_bolsa, kontohub_lcdpr, kontohub_nfe
-- terão parent_app_id apontando para o id do app 'kontohub'.
--
-- Apps sem pai (kontohub, kontozap, auth, admin) têm parent_app_id = NULL.

ALTER TABLE "apps"
  ADD COLUMN "parent_app_id" UUID REFERENCES "apps"("id") ON DELETE SET NULL;

CREATE INDEX "idx_apps_parent"
  ON "apps" ("parent_app_id")
  WHERE "parent_app_id" IS NOT NULL;
