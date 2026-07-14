/**
 * Ids de módulo do KontoHub — usados APENAS como defesa server-side ao liberar
 * módulos de um usuário (aceitar só ids conhecidos).
 *
 * FONTE DE VERDADE: KontoHub `src/config/module-access.ts`. Ao adicionar/remover
 * módulo lá, refletir aqui. (Substitui o espelho de `apps/admin/src/lib/modulos.ts`
 * como catálogo desta feature.)
 */
export const MODULO_IDS: readonly string[] = [
  "cadastros",
  "ir-bolsa",
  "dirpf",
  "lcdpr",
  "nfe",
  "kontozap",
  "financeiro",
  "itr",
  "kontohelp",
]
