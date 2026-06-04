# Migrations — Runbook de reconciliação (2026-06-04)

## Problema encontrado

O fluxo de migrations estava num estado híbrido quebrado:

- `_journal.json` tinha só **0000–0003**, mas a pasta tinha `.sql` até **0007** → 0004–0007 **órfãos** (o `migrate()` do Drizzle nem os via).
- `when` de 0002/0003 estava **abaixo** do 0001 → o `migrate()` (que decide aplicar por `when` vs `created_at` da última aplicada) **pulava** 0002/0003 silenciosamente.
- 0002–0007 foram **escritas à mão** (sem snapshots em `meta/`), fora do fluxo `drizzle-kit generate`.
- `apply-pending.ts` era um workaround manual que cobria **só** colunas de 0002/0003.

### Estado real do banco antes do fix (introspecção)
- `drizzle.__drizzle_migrations`: só 0000 e 0001 registradas.
- 0002/0003: aplicadas (colunas existiam) mas **não registradas**.
- **0004 (audit nullable): NÃO aplicada** (`user_id` ainda NOT NULL).
- **0005 (remove owner): NÃO aplicada** (enum ainda tinha `owner`) → **drift DB↔código** (schema Drizzle já declarava `admin/user`).
- **0006 (user_app_access): NÃO aplicada** → tabela ausente, **mas referenciada em runtime** por `apps/auth/.../api/tenant/apps/route.ts` + `UserAppAccessRepo` → **endpoint quebrado**.
- 0007 (apps parent): aplicada (manual), não registrada.

## O que foi feito

1. **Migrations tornadas idempotentes** (seguras p/ re-run): `0005` (guard `IF EXISTS owner` em DO-block), `0006` (`CREATE TABLE/INDEX IF NOT EXISTS`), `0007` (`ADD COLUMN/INDEX IF NOT EXISTS`). `0004` já era idempotente (`DROP NOT NULL`).
2. **`_journal.json` completado e ordenado**: 8 entradas (0000–0007) com `when` monotônico (0002–0007 acima do 0001).
3. **`pnpm --filter @repo/db run migrate`** rodado → aplicou as pendentes (0004/0005/0006) idempotentemente e **registrou todas** em `drizzle.__drizzle_migrations`.

### Estado verificado após o fix
- `user_role` = `[admin, user]`; `audit_logs.user_id` nullable; `user_app_access` existe; `apps.parent_app_id` existe; `user_tenants` 1 linha role=`admin`; `drizzle.__drizzle_migrations` = 8 registros.

## Como aplicar em OUTRO ambiente (ex: produção, se for um banco separado)

```bash
pnpm --filter @repo/db run migrate   # idempotente; aplica o que faltar e registra
```
As migrations agora são idempotentes e o journal está completo — `migrate()` é seguro e é a fonte de verdade. O `apply-pending.ts` deixou de ser necessário no fluxo (pode ser mantido como safety net ou removido).

## Pendência de processo (decisão do time)
- Voltaram pro fluxo `drizzle-kit` (migrations geradas) ou assumem migrations à mão como padrão? Hoje 0002–0007 são à mão (sem snapshots). Se for gerar novas via `drizzle-kit generate`, reconciliar os snapshots primeiro.
