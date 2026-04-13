-- Migration: 0004_audit_logs_nullable_userid
-- Remove NOT NULL de audit_logs.user_id para permitir eventos de sistema sem usuário
-- (ex: tentativa de login com e-mail inexistente)
-- A constraint ON DELETE SET NULL já existia mas era contraditória com NOT NULL

ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;
