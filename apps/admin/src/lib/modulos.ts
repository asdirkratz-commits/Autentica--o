/**
 * Catálogo de módulos do KontoHub para liberação por usuário (user_tenants.modulos).
 *
 * ESPELHA o catálogo do KontoHub (`src/config/modules.tsx` + `src/config/module-access.ts`).
 * Ao adicionar/remover um módulo no KontoHub, atualizar esta lista — não há tabela
 * de catálogo compartilhada; o gating do KontoHub compara contra estes ids.
 */
export const MODULOS_KONTOHUB: { id: string; label: string }[] = [
  { id: "cadastros", label: "Cadastros" },
  { id: "ir-bolsa", label: "IR Bolsa" },
  { id: "dirpf", label: "DIRPF" },
  { id: "lcdpr", label: "LCDPR" },
  { id: "nfe", label: "NFe" },
  { id: "kontozap", label: "KontoZap" },
  { id: "financeiro", label: "Financeiro" },
  { id: "itr", label: "ITR" },
  { id: "kontohelp", label: "KontoHelp" },
]

export const MODULO_IDS = MODULOS_KONTOHUB.map((m) => m.id)
