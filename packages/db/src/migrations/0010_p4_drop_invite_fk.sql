-- Migration: 0010_p4_drop_invite_fk
-- Remove FK invite_tokens.invited_by → users.id
--
-- Motivo: actorId = JWT sub = GoTrue UUID desde P3. O campo invited_by agora
-- recebe GoTrue UUIDs que não existem na tabela Neon users.id, quebrando a FK.
-- A coluna é mantida apenas como referência informacional (sem integridade FK).
--
-- Rollback: não aplicável — re-adicionar a FK exigiria que todos os invited_by
-- apontem para ids válidos em users, o que não é garantido pós-P3.

ALTER TABLE "invite_tokens"
  DROP CONSTRAINT IF EXISTS "invite_tokens_invited_by_users_id_fk";
