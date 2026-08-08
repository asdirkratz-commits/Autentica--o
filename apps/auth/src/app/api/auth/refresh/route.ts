import { NextRequest, NextResponse } from "next/server"
import { RefreshTokenRepo, UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin, env } from "@repo/auth-shared"
import { verifyJWT, hashToken, signJWT } from "@/lib/jwt"
import { revokeSession } from "@/lib/session"
import { setAccessCookie, clearAuthCookies, getRefreshTokenFromCookies } from "@/lib/cookies"
import { cache } from "@/lib/redis"
import { checkRateLimit } from "@/lib/rate-limit"
import { getSupabaseUserTenantsByGoTrueId } from "@/lib/supabase-user-tenants"

/**
 * IP de quem fez o pedido, só quando é mesmo um endereço.
 *
 * `X-Forwarded-For` é escolhido por quem chama (a rota é alcançável direto, já
 * que `enforceSameOrigin` libera pedido sem `Origin`), e o destino é uma coluna
 * `inet`: texto que não é endereço derruba a gravação. Aceita IPv4 sem zero à
 * esquerda e IPv6 com no máximo uma abreviação `::`, incluindo a forma mapeada
 * `::ffff:1.2.3.4`.
 */
function ipDoPedido(request: NextRequest): string | null {
  const bruto = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (!bruto) return null

  const octeto = (o: string) => /^(0|[1-9]\d{0,2})$/.test(o) && Number(o) <= 255
  const ehIpv4 = (s: string) => {
    const partes = s.split(".")
    return partes.length === 4 && partes.every(octeto)
  }
  if (ehIpv4(bruto)) return bruto

  if (!bruto.includes(":")) return null
  const abreviado = bruto.includes("::")
  // `:::` é abreviação dupla sobreposta — o `split("::")` não a enxerga.
  if (bruto.includes(":::")) return null
  if (bruto.split("::").length > 2) return null
  if (bruto.startsWith(":") && !bruto.startsWith("::")) return null
  if (bruto.endsWith(":") && !bruto.endsWith("::")) return null

  const grupos = bruto.split(":")
  const ultimo = grupos[grupos.length - 1] ?? ""
  const temIpv4Final = ultimo.includes(".")
  if (temIpv4Final && !ehIpv4(ultimo)) return null
  // O IPv4 do fim ocupa duas palavras de 16 bits.
  const palavras = grupos.filter(g => g !== "").length + (temIpv4Final ? 1 : 0)
  // Sem `::` o endereço é completo: exatamente 8 palavras, nem mais nem menos.
  if (!abreviado && palavras !== 8) return null
  if (abreviado && palavras >= 8) return null

  const hexOk = grupos.every((g, i) => {
    if (g === "") return true
    if (i === grupos.length - 1 && temIpv4Final) return true
    return /^[0-9a-fA-F]{1,4}$/.test(g)
  })
  return hexOk ? bruto : null
}

/**
 * Renova o token de ACESSO a partir de um refresh token válido.
 *
 * O refresh token NÃO é trocado aqui, de propósito. Trocá-lo a cada renovação
 * exige revogar o anterior, e a renovação é disparada por requisição: quando o
 * token de acesso vence, TODAS as chamadas que a tela tem em voo pedem renovação
 * com o mesmo refresh token. Com troca, a primeira revoga e as demais chegam com
 * um token recém-revogado — indistinguível, para a detecção de reuso, de um token
 * roubado sendo reapresentado. A consequência seria derrubar todas as sessões do
 * usuário várias vezes por dia, com alarme falso de roubo na auditoria.
 *
 * Sem troca não há escrita nenhuma no caminho quente: N renovações simultâneas
 * apenas assinam N tokens de acesso e não disputam nada.
 *
 * O que se perde e o que fica:
 *  · perde-se a troca periódica do refresh token dentro da sessão — um refresh
 *    token roubado vale até o prazo emitido no login, sem ser detectado pela
 *    reapresentação;
 *  · fica de pé a detecção de reuso para token REVOGADO (logout, troca de senha,
 *    revogação administrativa), que é onde ela de fato acusa;
 *  · fica o teto absoluto da sessão: como o prazo do refresh token não é
 *    empurrado a cada renovação, ela expira no prazo do login e exige entrar de
 *    novo — não vira sessão eterna;
 *  · e os claims (papel, módulos, master global, nome) são RELIDOS do banco a
 *    cada renovação, então rebaixar alguém alcança o usuário em até 15 minutos.
 *    Quando a leitura dos vínculos ou a do usuário não responde, a renovação é
 *    RECUSADA (503) — o token só é assinado com autorização confirmada, nunca a
 *    partir do que o token anterior dizia.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const refreshToken = getRefreshTokenFromCookies(request)

  if (!refreshToken) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Refresh token ausente", 401).error,
      { status: 401 }
    )
  }

  // Verificar JWT
  const payload = await verifyJWT(refreshToken)
  if (!payload) {
    const response = NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Refresh token inválido ou expirado", 401).error,
      { status: 401 }
    )
    clearAuthCookies(response)
    return response
  }

  // Verificar se token está no banco e não foi revogado
  const tokenHash = hashToken(refreshToken)
  const storedToken = await RefreshTokenRepo.findByHash(tokenHash)
  if (!storedToken) {
    // Token revogado sendo reapresentado. Sem rotação, isto DEIXOU de ser
    // evidência de roubo: revogar é exatamente o que logout em outro dispositivo,
    // troca de senha e bloqueio de empresa fazem, e o navegador daquele outro
    // dispositivo continua com o cookie até o prazo. Tratar como roubo aqui
    // derrubaria a sessão de quem trocou a senha — justamente a que a troca
    // promete preservar — e encheria a auditoria de alarme falso, afogando o
    // sinal para quando houver um caso real. Encerra só esta sessão e registra
    // como o que é: token de sessão encerrada apresentado de novo.
    const reused = await RefreshTokenRepo.findAnyByHash(tokenHash)
    // Teto de registros por token por janela (o do limitador de login: 5/min).
    // Sem teto, qualquer um com um refresh token revogado antigo (capturado de
    // um logout) escreve em `audit_logs` a cada requisição, de graça e sem
    // credencial — afogando justamente o sinal que este registro existe para
    // preservar, e queimando cota do banco. Fica dentro do mesmo try/catch do
    // registro: falha ao contar não pode derrubar o `clearAuthCookies` abaixo,
    // que é o que tira o cookie morto do navegador.
    //
    // E o registro NUNCA pode derrubar o encerramento da sessão. `ip_address` é
    // coluna `inet` e o valor vem de um cabeçalho escolhido por quem chama:
    // bastava mandar `X-Forwarded-For: dead:beef` para o INSERT estourar, a
    // rota devolver 500 e o `clearAuthCookies` abaixo nunca rodar — quem tem
    // sessão encerrada ficaria em erro para sempre, sem chegar ao login, e o
    // registro que ele deveria deixar sumiria junto. Por isso: endereço só se
    // for endereço, e falha de auditoria não interrompe.
    if (reused) {
      try {
        const { allowed } = await checkRateLimit(tokenHash, "revoked_presented")
        if (allowed) {
          await AuditRepo.log({
            userId: payload.sub,
            action: "session.revoked",
            targetType: "session",
            targetId: payload.sub,
            metadata: { reason: "revoked_token_presented" },
            ipAddress: ipDoPedido(request) ?? undefined,
          })
        }
      } catch (e) {
        console.error("[refresh] falha ao registrar apresentação de token revogado:", e)
      }
    }
    const response = NextResponse.json(
      err(ErrorCode.TOKEN_EXPIRED, "Refresh token revogado ou inválido", 401).error,
      { status: 401 }
    )
    clearAuthCookies(response)
    return response
  }

  // Verificar status do tenant (master sem tenant usa sentinela "master")
  if (payload.tenantId && payload.tenantId !== "master") {
    const tenantStatus = await cache.getTenantStatus(payload.tenantId)
    if (tenantStatus === "bloqueado" || tenantStatus === "inativo") {
      await revokeSession(refreshToken)
      const response = NextResponse.json(
        err(ErrorCode.TENANT_BLOCKED, "Empresa bloqueada", 403).error,
        { status: 403 }
      )
      clearAuthCookies(response)
      return response
    }
  }

  // payload.sub = GoTrue UUID (pós-P3); tokens pré-P3 (Neon UUID) já expiraram
  const user = await UserRepo.findByGoTrueId(payload.sub)
  if (!user) {
    // A busca no GoTrue devolve o MESMO `null` para "não existe" e para "não
    // respondeu" (429/5xx/rede). Como a sessão que chegou aqui tem linha ATIVA
    // em refresh_tokens, "o usuário sumiu" é a hipótese improvável — e apagar o
    // cookie por um soluço de rede desloga alguém no meio do trabalho, sem volta
    // possível. Devolve indisponível e NÃO limpa: quem tem o refresh token
    // válido tenta de novo.
    return NextResponse.json(
      err(ErrorCode.INTERNAL_ERROR, "Não foi possível confirmar a sessão agora", 503).error,
      { status: 503 }
    )
  }

  // "master" é sentinela do JWT (master_global sem tenant). Normaliza para
  // undefined ANTES de qualquer consulta por tenant — passar "master" a uma
  // coluna uuid quebra (invalid input syntax for type uuid). Volta a ser
  // "master" só na hora de assinar o token novo.
  const sessionTenantId = payload.tenantId === "master" ? undefined : payload.tenantId

  // UMA leitura dos vínculos serve papel, situação, módulos e permissões — a
  // mesma que o login usa, então os claims saem idênticos aos dele. Antes eram
  // duas consultas à mesma tabela (`getUserRoleInTenant` + esta) e duas ao mesmo
  // usuário do GoTrue: como a renovação passou a acontecer em toda requisição
  // sem token, cada chamada duplicada vira carga multiplicada por tela e empurra
  // o projeto para o limite de requisições — que é justamente o que faz a
  // recusa abaixo disparar.
  //
  // `null` significa FALHOU (env ausente, 429, 5xx, rede) — nunca "não tem
  // vínculo". Confundir os dois assinaria um token sem módulos, e o KontoHub lê
  // ausência como NENHUM módulo: o usuário levaria "Sem acesso ao módulo" por 15
  // minutos, com a mensagem culpando permissão. E o caminho contrário — repetir
  // o que o token trazia — é pior: `payload` vem do refresh token, assinado no
  // login e nunca reemitido, então devolveria os módulos DO LOGIN, ressuscitando
  // acesso revogado. Não dá para afirmar a autorização: não assina.
  const supabaseTenants = user.goTrueId
    ? await getSupabaseUserTenantsByGoTrueId(user.goTrueId)
    : null
  // Recusar só quando a leitura FAZ FALTA. Master global sem empresa não tem
  // vínculo para checar — papel, módulos e permissões dele não saem daqui —, e
  // negar a renovação dele por uma leitura que não seria usada o deixaria preso
  // na tela de indisponibilidade por um soluço alheio.
  if (sessionTenantId && supabaseTenants === null) {
    console.warn("[refresh] leitura de vínculos indisponível — sessão não renovada")
    return NextResponse.json(
      err(ErrorCode.INTERNAL_ERROR, "Não foi possível confirmar a sessão agora", 503).error,
      { status: 503 }
    )
  }
  const vinculo = sessionTenantId
    ? supabaseTenants?.find(t => t.tenantId === sessionTenantId)
    : undefined

  // Vínculo ausente é tão excludente quanto vínculo inativo — é o que sobra
  // quando alguém é removido da empresa. Recusa e limpa o cookie, mas NÃO revoga:
  // revogar é escrita permanente e "lista vazia" também é o que uma leitura
  // cega devolve (policy nova, réplica atrasada). Um acidente desses viraria
  // revogação em massa sem volta; recusar já basta, porque a mesma verificação
  // reprova de novo no pedido seguinte.
  if (sessionTenantId && !vinculo) {
    const response = NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
      { status: 403 }
    )
    clearAuthCookies(response)
    return response
  }

  if (vinculo && vinculo.status !== "active") {
    const response = NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado a esta empresa", 403).error,
      { status: 403 }
    )
    clearAuthCookies(response)
    return response
  }

  // Projeção explícita: `permissions` é JSONB livre na tabela, e copiá-lo
  // inteiro para dentro do token deixa o tamanho do cookie à mercê do que alguém
  // gravar ali. Cookie acima de ~4 KB o navegador descarta EM SILÊNCIO — com a
  // renovação acontecendo a cada requisição, isso viraria laço sem mensagem.
  const p = vinculo?.permissions ?? {}
  const permissions = {
    can_invite_users: p.can_invite_users === true,
    can_manage_users: p.can_manage_users === true,
    can_view_reports: p.can_view_reports === true,
    can_export_data:  p.can_export_data  === true,
  }
  const modulos       = vinculo?.modulos
  const isMasterGlobal = user.isMasterGlobal
  const fullName       = user.fullName

  // Sessão sem empresa só se sustenta em ser master global. Todas as guardas
  // acima dependem de haver empresa; sem esta linha, um master global rebaixado
  // continuaria renovando por dias uma sessão que o próprio login recusaria
  // ("Usuário sem empresa ativa"), com `x-empresa-id: master` chegando à camada
  // de dados.
  if (!sessionTenantId && !isMasterGlobal) {
    const response = NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Usuário sem empresa ativa", 403).error,
      { status: 403 }
    )
    clearAuthCookies(response)
    return response
  }

  // Papel RELIDO do vínculo, não copiado do token que está sendo renovado. Com a
  // sessão se renovando sozinha, copiar o papel antigo congelaria o cargo: quem
  // fosse rebaixado de Administrador continuaria entrando nas telas de
  // administração enquanto não fechasse a aba. Sem vínculo só chega aqui o
  // master global sem empresa, cujo papel não vem de vínculo nenhum.
  const role = vinculo?.role ?? payload.role

  // Só o token de ACESSO é reemitido; o refresh token do navegador segue o mesmo.
  // sub = payload.sub, o UUID do GoTrue que o token já carrega
  const accessToken = await signJWT(
    {
      sub: payload.sub,
      tenantId: sessionTenantId ?? "master",
      role,
      isMasterGlobal,
      permissions,
      nome: fullName,
      modulos,
    },
    env.JWT_ACCESS_EXPIRES,
  )

  const response = NextResponse.json({ ok: true })
  setAccessCookie(response, accessToken)
  return response
}
