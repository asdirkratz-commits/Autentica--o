/**
 * CertRepo — certificados digitais e-CNPJ da empresa.
 *
 * Lê/grava a tabela `empresa_certificados` no Supabase — a MESMA tabela que o
 * KontoHub usa (banco compartilhado). O admin grava o certificado cifrado
 * (cofre AES-256-GCM, COFRE_SECRET_KEY) + metadados; o agente Electron do
 * KontoHub lê e descriptografa. Por isso o formato de cifragem e o path de
 * storage precisam casar com os do KontoHub.
 *
 * Colunas sensíveis (storage_path, iv_base64, senha_cifrada, senha_iv) NUNCA
 * são devolvidas ao frontend — só os metadados públicos.
 */
import { supabase } from "../supabase-client"

export type EmpresaCertificado = {
  id: string
  empresaId: string
  cnpj: string
  nomeArquivo: string
  emitidoPara: string
  tipoCertificado: "A1" | "A3"
  dataValidade: string
  dataEmissao: string | null
  ativo: boolean
  observacoes: string | null
  createdAt: string
  updatedAt: string
}

export type CreateCertificadoDTO = {
  empresaId: string
  cnpj: string
  nomeArquivo: string
  emitidoPara: string
  tipoCertificado: "A1" | "A3"
  dataValidade: string // ISO 8601
  dataEmissao?: string | null
  observacoes?: string | null
  storagePath: string
  ivBase64: string
  senhaCifrada: string
  senhaIv: string
}

type CertRow = {
  id: string
  empresa_id: string
  cnpj: string
  nome_arquivo: string
  emitido_para: string
  tipo_certificado: "A1" | "A3"
  data_validade: string
  data_emissao: string | null
  ativo: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
  storage_path?: string | null
  iv_base64?: string | null
  senha_cifrada?: string | null
  senha_iv?: string | null
}

const PUBLIC_COLS =
  "id,empresa_id,cnpj,nome_arquivo,emitido_para,tipo_certificado,data_validade,data_emissao,ativo,observacoes,created_at,updated_at"

/** Escapa valores interpolados em filtros PostgREST (mesma convenção do TenantRepo). */
function enc(v: string): string {
  return encodeURIComponent(v)
}

function fromRow(r: CertRow): EmpresaCertificado {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    cnpj: r.cnpj,
    nomeArquivo: r.nome_arquivo,
    emitidoPara: r.emitido_para,
    tipoCertificado: r.tipo_certificado,
    dataValidade: r.data_validade,
    dataEmissao: r.data_emissao,
    ativo: r.ativo,
    observacoes: r.observacoes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export const CertRepo = {
  async listByEmpresa(empresaId: string): Promise<EmpresaCertificado[]> {
    const rows = await supabase
      .from<CertRow>("empresa_certificados")
      .select(`select=${PUBLIC_COLS}&empresa_id=eq.${enc(empresaId)}&order=ativo.desc,data_validade.desc`)
    return rows.map(fromRow)
  },

  async create(dto: CreateCertificadoDTO): Promise<EmpresaCertificado> {
    // 1. Insere o novo certificado já ativo. A projeção `?select=` garante que as
    //    colunas sensíveis (storage_path/iv/senha) NÃO voltem na resposta REST.
    const inserted = await supabase
      .from<CertRow>(`empresa_certificados?select=${PUBLIC_COLS}`)
      .insert({
        empresa_id: dto.empresaId,
        cnpj: dto.cnpj,
        nome_arquivo: dto.nomeArquivo,
        emitido_para: dto.emitidoPara,
        tipo_certificado: dto.tipoCertificado,
        data_validade: dto.dataValidade,
        data_emissao: dto.dataEmissao ?? null,
        observacoes: dto.observacoes ?? null,
        storage_path: dto.storagePath,
        iv_base64: dto.ivBase64,
        senha_cifrada: dto.senhaCifrada,
        senha_iv: dto.senhaIv,
        ativo: true,
      })
    const row = inserted[0]
    if (!row) throw new Error("Falha ao inserir certificado: resposta vazia do Supabase.")

    // 2. Só DEPOIS desativa os anteriores do mesmo CNPJ (exceto o recém-criado).
    //    Ordem importa: se o insert falhasse, nada seria desativado — a empresa
    //    nunca fica sem certificado ativo (KontoHub depende disso para o e-CAC).
    await supabase
      .from<CertRow>("empresa_certificados")
      .update(
        `empresa_id=eq.${enc(dto.empresaId)}&cnpj=eq.${enc(dto.cnpj)}&ativo=eq.true&id=neq.${enc(row.id)}`,
        { ativo: false, updated_at: new Date().toISOString() },
      )

    return fromRow(row)
  },

  /** Remove o registro e devolve o storage_path (p/ apagar o arquivo cifrado). */
  async removeById(id: string, empresaId: string): Promise<string | null> {
    const deleted = await supabase
      .from<CertRow>("empresa_certificados")
      .delete(`id=eq.${enc(id)}&empresa_id=eq.${enc(empresaId)}`)
    return deleted[0]?.storage_path ?? null
  },
}
