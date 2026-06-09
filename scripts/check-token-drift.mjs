#!/usr/bin/env node
/**
 * Drift-check dos tokens de design do contrato Konto.
 *
 * Garante que os tokens semânticos do contrato (agnóstico de cor) têm VALOR
 * idêntico entre auth, admin e (quando disponível) KontoHub. Compara valores
 * (não formatação), então ordem/espaçamento livres em cada globals.css. Falha
 * (exit 1) em qualquer divergência ou token de contrato ausente.
 *
 * Uso: node scripts/check-token-drift.mjs
 * KontoHub vive em repo separado — caminho via env KONTOHUB_GLOBALS_PATH
 * (default C:/Projetos/KontoHub/src/app/globals.css); se ausente, valida só auth↔admin.
 */
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const CONTRACT_TOKENS = [
  "--k-color-primary", "--k-color-secondary", "--k-color-highlight",
  "--k-surface", "--k-foreground", "--k-success", "--k-warning", "--k-danger",
  "--space-1", "--space-2", "--space-3", "--space-4", "--space-6", "--space-8", "--space-10", "--space-12",
  "--radius-sm", "--radius-md", "--radius-lg", "--radius-full",
]

const SOURCES = [
  { name: "auth", path: resolve(repoRoot, "apps/auth/src/app/globals.css") },
  { name: "admin", path: resolve(repoRoot, "apps/admin/src/app/globals.css") },
  {
    name: "kontohub",
    path: process.env.KONTOHUB_GLOBALS_PATH ?? "C:/Projetos/KontoHub/src/app/globals.css",
    optional: true,
  },
]

function parseTokens(css) {
  // Remove comentários antes de parsear — um token comentado não deve contar.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const map = {}
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
  let m
  while ((m = re.exec(stripped))) map[m[1]] = m[2].trim()
  return map
}

const present = []
for (const s of SOURCES) {
  if (!existsSync(s.path)) {
    if (s.optional) { console.warn(`⚠  ${s.name} não encontrado (${s.path}) — pulando do drift-check`); continue }
    console.error(`✖ arquivo obrigatório ausente: ${s.path}`); process.exit(1)
  }
  present.push({ ...s, tokens: parseTokens(readFileSync(s.path, "utf8")) })
}

const ref = present[0]
let drift = 0
for (const token of CONTRACT_TOKENS) {
  const refVal = ref.tokens[token]
  if (refVal === undefined) { console.error(`✖ ${ref.name}: token de contrato ausente — ${token}`); drift++; continue }
  for (const s of present.slice(1)) {
    const val = s.tokens[token]
    if (val === undefined) { console.error(`✖ ${s.name}: token de contrato ausente — ${token}`); drift++ }
    else if (val !== refVal) { console.error(`✖ drift em ${token}: ${ref.name}="${refVal}" vs ${s.name}="${val}"`); drift++ }
  }
}

if (drift > 0) {
  console.error(`\n${drift} divergência(s) de token de contrato. Sincronize os globals.css.`)
  process.exit(1)
}
console.log(`✓ tokens de contrato idênticos em [${present.map((s) => s.name).join(", ")}] — ${CONTRACT_TOKENS.length} tokens conferidos`)
