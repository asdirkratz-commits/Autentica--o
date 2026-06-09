#!/usr/bin/env node
/**
 * Drift-check dos COMPONENTES de contrato Konto entre auth e admin.
 *
 * Os tokens já são garantidos por check-token-drift.mjs. Este script fecha a
 * dívida correlata: o CSS de componente é duplicado em cada app (cada globals.css
 * tem seu próprio bloco), então uma classe compartilhada podia divergir sem que
 * nada acusasse. Aqui, para um conjunto CURADO de seletores que o contrato exige
 * idênticos (shell, card, badge núcleo, tabela, botões, alert núcleo, primitivos
 * de formulário, check-row, code-mono, portal), comparamos as DECLARAÇÕES
 * (normalizadas: ordem/espaçamento livres) entre auth e admin. Falha (exit 1) em
 * qualquer divergência ou seletor ausente.
 *
 * NÃO entram aqui classes legitimamente específicas de cada app (ex.: .auth-*,
 * .kpi, .dropzone, .radio-card) nem as que divergem por design (.sidebar__brand,
 * .info-row, agrupamento de .input, variantes .badge--brand/--info). Adicionar um
 * seletor a SHARED_SELECTORS é a forma de promover uma classe a "contrato".
 *
 * Uso: node scripts/check-component-drift.mjs
 * (KontoHub vive em repo separado com um sistema de componentes próprio e mais
 * rico; por ora o guard cobre auth↔admin, que partilham os packages do monorepo.)
 */
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const SOURCES = [
  { name: "auth", path: resolve(repoRoot, "apps/auth/src/app/globals.css") },
  { name: "admin", path: resolve(repoRoot, "apps/admin/src/app/globals.css") },
]

/** Seletores que o contrato exige IDÊNTICOS entre auth e admin (chaves normalizadas). */
const SHARED_SELECTORS = [
  // App shell
  ".app-shell", ".sidebar", ".sidebar__nav", ".sidebar__link",
  ".sidebar__link:hover, .sidebar__link--active",
  ".sidebar__section", ".sidebar__section-label", ".sidebar__footer",
  ".sidebar__user", ".sidebar__avatar", ".sidebar__avatar img",
  ".sidebar__user-info", ".sidebar__user-name", ".sidebar__user-email",
  ".sidebar__logout", ".sidebar__logout:hover", ".main-content", ".page-content",
  // Portal
  ".portal-greeting", ".portal-greeting-sub", ".portal-section-label",
  ".portal-link", ".portal-link:hover", ".portal-avatar", ".portal-avatar img",
  // Card
  ".card",
  // Badge (núcleo + variantes compartilhadas)
  ".badge", ".badge--success", ".badge--warning", ".badge--danger",
  ".badge--neutral", ".badge--master",
  // Tabela
  ".table-wrapper", ".table", ".table th", ".table td",
  ".table tbody tr:last-child td", ".table__row--hover:hover", ".table__empty",
  // Botões
  ".btn", ".btn--primary", ".btn--primary:hover:not(:disabled)",
  ".btn--ghost", ".btn--ghost:hover:not(:disabled)",
  ".btn--success", ".btn--success:hover:not(:disabled)",
  ".btn--danger", ".btn--danger:hover:not(:disabled)",
  ".btn--block", ".btn--sm", ".btn:disabled",
  // Alert (núcleo)
  ".alert", ".alert--danger", ".alert--success",
  // Primitivos de formulário
  ".form-field", ".label", ".required", ".auth-hint",
  // Check row
  ".check-row", '.check-row input[type="checkbox"]', ".check-row span",
  // Mono
  ".code-mono",
]

function normSelector(sel) {
  return sel.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim()
}

function normDecls(body) {
  return body
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const idx = d.indexOf(":")
      if (idx === -1) return d.replace(/\s+/g, " ")
      const prop = d.slice(0, idx).trim()
      const val = d.slice(idx + 1).trim().replace(/\s+/g, " ")
      return `${prop}: ${val}`
    })
    .sort()
    .join("; ")
}

/** Coleta regras de nível 0 (ignora blocos @layer/@media e statements @import/@tailwind). */
function parseRules(css) {
  // Remove comentários e at-STATEMENTS (@import/@tailwind, terminados em `;` sem
  // bloco) antes do walk. O @import de fontes do Google tem `;` DENTRO da url()
  // (wght@400;500;600;700) — tratá-lo como statement por caractere `;` quebraria;
  // por isso a remoção é feita com regex ciente de url()/aspas. Restam apenas
  // regras reais e blocos @layer/@media (com `{}`), tratados pelo skip de seletor.
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g, "")
    .replace(/@(?:tailwind|charset|namespace)[^;{}]*;/g, "")
  const rules = {}
  let i = 0
  const n = stripped.length
  let buf = ""
  while (i < n) {
    const ch = stripped[i]
    if (ch === "{") {
      const selector = buf.trim()
      let depth = 1
      let j = i + 1
      while (j < n && depth > 0) {
        if (stripped[j] === "{") depth++
        else if (stripped[j] === "}") depth--
        j++
      }
      if (!selector.startsWith("@")) {
        rules[normSelector(selector)] = normDecls(stripped.slice(i + 1, j - 1))
      }
      buf = ""
      i = j
      continue
    }
    buf += ch
    i++
  }
  return rules
}

const parsed = []
for (const s of SOURCES) {
  if (!existsSync(s.path)) {
    console.error(`✖ arquivo obrigatório ausente: ${s.path}`)
    process.exit(1)
  }
  parsed.push({ ...s, rules: parseRules(readFileSync(s.path, "utf8")) })
}

const [ref, ...rest] = parsed
let drift = 0
for (const selector of SHARED_SELECTORS) {
  const refDecls = ref.rules[selector]
  if (refDecls === undefined) {
    console.error(`✖ ${ref.name}: seletor de contrato ausente — ${selector}`)
    drift++
    continue
  }
  for (const s of rest) {
    const decls = s.rules[selector]
    if (decls === undefined) {
      console.error(`✖ ${s.name}: seletor de contrato ausente — ${selector}`)
      drift++
    } else if (decls !== refDecls) {
      console.error(`✖ drift em "${selector}":`)
      console.error(`    ${ref.name}:  ${refDecls}`)
      console.error(`    ${s.name}: ${decls}`)
      drift++
    }
  }
}

if (drift > 0) {
  console.error(`\n${drift} divergência(s) de componente de contrato. Sincronize os globals.css.`)
  process.exit(1)
}
console.log(
  `✓ componentes de contrato idênticos em [${parsed.map((s) => s.name).join(", ")}] — ${SHARED_SELECTORS.length} seletores conferidos`
)
