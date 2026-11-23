'use strict';
const https = require('node:https');
const tls = require('node:tls');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const QRCode = require('qrcode');
const { registrarCobranca, confirmarPagamentoVerificado } = require('./financeiro');

function erro(status, message, code = 'EFI_RESPOSTA_INVALIDA') {
  // Mensagens definidas neste arquivo; nunca registrar o corpo retornado pelo banco.
  console.error('CADMIV Pix:', code, message);
  return Object.assign(new Error(message), { status, code });
}
const valor = centavos => (centavos / 100).toFixed(2);
const expiracao = 86400;

function diagnosticoResposta(data) {
  const nomes = new Set([
    'chave_invalida', 'valor_invalido', 'txid_duplicado', 'cobranca_nao_encontrada',
    'erro_aplicacao', 'documento_bloqueado', 'invalid_client', 'invalid_request', 'insufficient_scope',
    'CobOperacaoInvalida', 'CobConsultaInvalida', 'CobNaoEncontrada',
    'AcessoNegado', 'RequisicaoInvalida'
  ]);
  const texto = JSON.stringify(data ?? '').toLowerCase();
  const sinais = [
    ['CERTIFICADO_NAO_ENVIADO', /no required ssl certificate|client certificate (is required|required|not provided)|certificate_required/],
    ['CERTIFICADO_RECUSADO', /ssl certificate error|bad_certificate|certificate verify failed/],
    ['CHAVE_PIX', /chave|pix.?key/],
    ['IDENTIFICADOR_TXID', /txid/],
    ['VALOR', /valor|amount/],
    ['PERMISSAO', /scope|permiss|acesso negado/],
    ['FORMATO', /schema|propriedade|property|validation|validacao|validação/]
  ].filter(([, pattern]) => pattern.test(texto)).map(([nome]) => nome);
  const tipo = typeof data?.type === 'string' ? data.type.split('/').at(-1) : '';
  const nome = [data?.nome, data?.error, tipo].find(item => nomes.has(item));
  const camposPermitidos = new Set([
    'chave', 'txid', 'calendario.expiracao', 'valor.original', 'valor.modalidadeAlteracao',
    'body.chave', 'body.valor.original', 'body.valor.modalidadeAlteracao',
    'body.calendario.expiracao', 'cob.body.chave', 'cob.body.valor.original',
    'cob.body.valor.modalidadeAlteracao', 'cob.body.calendario.expiracao', 'cob.params.txid'
  ]);
  const campos = Array.isArray(data?.violacoes)
    ? data.violacoes.map(item => item?.propriedade).filter(item => camposPermitidos.has(item))
    : [];
  return ' Tipo=' + (nome || 'NAO_CLASSIFICADO') + ' Campos=' + (campos.join(',') || 'NAO_INFORMADOS')
    + ' Indicacao=' + (sinais.join(',') || 'SEM_INDICACAO');
}

function conectar(env) {
  const ambiente = env.EFI_PIX_AMBIENTE;
  const hosts = Object.freeze({
    producao: 'pix.api.efipay.com.br',
    homologacao: 'pix-h.api.efipay.com.br'
  });
  if (!Object.hasOwn(hosts, ambiente)) throw Error('Configure EFI_PIX_AMBIENTE.');
  if (!env.EFI_PIX_CLIENT_ID || !env.EFI_PIX_CLIENT_SECRET ||
      !env.EFI_PIX_CHAVE || !env.EFI_PIX_CERTIFICADO) {
    throw Error('Configure as credenciais, a chave Pix e o caminho do certificado Efí.');
  }
  const arquivo = fs.readFileSync(env.EFI_PIX_CERTIFICADO);
  const pfx = env.EFI_PIX_CERTIFICADO.endsWith('.b64')
    ? Buffer.from(arquivo.toString('ascii').trim(), 'base64')
    : arquivo;
  const secureContext = tls.createSecureContext({
    pfx,
    passphrase: env.EFI_PIX_CERTIFICADO_SENHA || '',
    minVersion: 'TLSv1.2'
  });
  const agent = new https.Agent({ secureContext, keepAlive: true, maxSockets: 8 });
  const basic = Buffer.from(env.EFI_PIX_CLIENT_ID + ':' + env.EFI_PIX_CLIENT_SECRET).toString('base64');
  let token, renovar;

  function request(method, path, authorization, body) {
    const json = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const etapa = path === '/oauth/token' ? 'AUTENTICACAO' : method === 'PUT' ? 'EMISSAO' : 'CONSULTA';
      const falhaConexao = () => reject(erro(502, 'Falha de conexão segura ou tempo limite na etapa ' + etapa, 'EFI_CONEXAO_' + etapa));
      const headers = { Authorization: authorization, Accept: 'application/json' };
      if (json) Object.assign(headers, {
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json)
      });
      const req = https.request({
        hostname: hosts[ambiente], agent, method, path, headers,
        signal: AbortSignal.timeout(8000)
      }, res => {
        const chunks = [];
        let size = 0;
        res.on('error', falhaConexao);
        res.on('data', chunk => {
          size += chunk.length;
          if (size > 256 * 1024) res.destroy(erro(502, 'Resposta Efí muito grande.'));
          else chunks.push(chunk);
        });
        res.on('end', () => {
          let data;
          const texto = Buffer.concat(chunks).toString();
          try { data = JSON.parse(texto); } catch {
            // O diagnóstico classifica o texto em memória, sem imprimir sua resposta.
            data = { respostaNaoJson: texto };
          }
          resolve({ status: res.statusCode, data });
        });
      });
      req.on('error', falhaConexao);
      req.end(json ?? undefined);
    });
  }

  async function autorizar() {
    if (token?.expira > Date.now()) return token.valor;
    renovar ??= request('POST', '/oauth/token', 'Basic ' + basic, { grant_type: 'client_credentials' })
      .then(({ status, data }) => {
        if (status !== 200 || typeof data?.access_token !== 'string' || !data.access_token) {
          throw erro(502, 'A autenticação Efí falhou.', 'EFI_AUTENTICACAO_HTTP_' + status);
        }
        token = { valor: data.access_token, expira: Date.now() + Math.max(0, Number(data.expires_in) - 30) * 1000 };
        return token.valor;
      }).finally(() => { renovar = null; });
    return renovar;
  }

  return async (method, txid, body) => {
    const path = '/v2/cob/' + txid;
    let acesso = await autorizar();
    let resposta = await request(method, path, 'Bearer ' + acesso, body);
    if (resposta.status === 401) {
      if (token?.valor === acesso) token = null;
      acesso = await autorizar();
      resposta = await request(method, path, 'Bearer ' + acesso, body);
    }
    const { status, data } = resposta;
    if (method === 'GET' && (status === 404 ||
        (status === 400 && data?.nome === 'cobranca_nao_encontrada'))) return null;
    if (status < 200 || status >= 300 || !data) {
      throw erro(502, 'A consulta ou emissão na Efí falhou.' + diagnosticoResposta(data),
        'EFI_' + (method === 'PUT' ? 'EMISSAO' : 'CONSULTA') + '_HTTP_' + status);
    }
    return data;
  };
}

function criarPix(db, env = process.env, request) {
  if (!env.EFI_PIX_AMBIENTE) return null;
  const provedor = 'efi-' + env.EFI_PIX_AMBIENTE;
  const chave = env.EFI_PIX_CHAVE;
  const api = request ?? conectar(env);
  const simulado = env.EFI_PIX_AMBIENTE === 'homologacao';

  async function estado(clienteId, { qr = false } = {}) {
    const { rows: [row] } = await db.query(`
      SELECT v.status, p.centavos AS preco, c.*, r.pago_em
      FROM cadmiv_veiculos v JOIN cadmiv_planos p ON p.id=v.combo
      LEFT JOIN cadmiv_cobrancas c ON c.cliente_id=v.cliente_id
      LEFT JOIN cadmiv_recebimentos r ON r.cobranca_id=c.id
      WHERE v.cliente_id=$1`, [clienteId]);
    if (!row || (row.provedor && row.provedor !== provedor)) return { disponivel: false };
    const { centavos, pix_expira_em, pix_copia_cola, pago_em } = row;
    if (pago_em) return { disponivel: true, status: 'PAGO', centavos, simulado };
    if (row.status !== 'PENDENTE') return { disponivel: false };
    if (pix_expira_em && Date.parse(pix_expira_em) <= Date.now()) {
      return { disponivel: true, status: 'EXPIRADO', centavos, simulado };
    }
    if (pix_copia_cola) return {
      disponivel: true, status: 'AGUARDANDO', centavos, simulado, expira_em: pix_expira_em,
      ...(qr ? { copia_cola: pix_copia_cola, imagem: await QRCode.toDataURL(pix_copia_cola) } : {})
    };
    return { disponivel: true, status: 'DISPONIVEL', centavos: centavos ?? row.preco, simulado };
  }

  async function verificar(cobranca, resposta) {
    const { referencia, centavos } = cobranca;
    if (resposta.txid !== referencia || resposta.chave !== chave || resposta.valor?.original !== valor(centavos)) {
      throw erro(502, 'Dados da cobrança Efí divergentes.');
    }
    if (resposta.status === 'CONCLUIDA') {
      const [pix] = Array.isArray(resposta.pix) ? resposta.pix : [];
      if (resposta.pix?.length !== 1 || pix?.txid !== referencia || pix.valor !== valor(centavos) ||
          !/^E[A-Za-z0-9]{31}$/.test(pix.endToEndId) || pix.devolucoes?.length) {
        throw erro(502, 'Recebimento Efí divergente ou com devolução.');
      }
      await confirmarPagamentoVerificado(db, {
        provedor, referencia, centavos, transacao: pix.endToEndId, pagoEm: pix.horario,
        moeda: 'BRL', status: 'CONFIRMADO'
      });
      await db.query('UPDATE cadmiv_cobrancas SET pix_proxima_consulta=NULL WHERE id=$1', [cobranca.id]);
    } else if (resposta.status === 'ATIVA') {
      const fim = Date.parse(resposta.calendario?.criacao) + Number(resposta.calendario?.expiracao) * 1000;
      const copia = resposta.pixCopiaECola;
      if (!Number.isFinite(fim) || typeof copia !== 'string' || !copia.startsWith('000201') || copia.length > 1024) {
        throw erro(502, 'A Efí não retornou um Pix válido.');
      }
      await db.query(`UPDATE cadmiv_cobrancas SET pix_expira_em=$2,pix_copia_cola=$3 WHERE id=$1`,
        [cobranca.id, new Date(fim).toISOString(), copia]);
    } else if (['REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP'].includes(resposta.status)) {
      await db.query(`UPDATE cadmiv_cobrancas SET pix_expira_em=now(),pix_proxima_consulta=NULL WHERE id=$1`, [cobranca.id]);
    } else {
      throw erro(502, 'Situação da cobrança Efí desconhecida.');
    }
  }

  async function emitir(clienteId, centavosAceitos) {
    if (!Number.isSafeInteger(centavosAceitos) || centavosAceitos <= 0) throw erro(400, 'Confira o valor da cobrança.');
    const referencia = createHash('sha256').update(provedor + ':' + clienteId).digest('hex').slice(0, 32);
    const cobranca = await registrarCobranca(db, { clienteId, provedor, referencia, centavosAceitos });
    await db.query(`UPDATE cadmiv_cobrancas SET pix_proxima_consulta=now()+interval '45 seconds'
      WHERE id=$1 AND pix_proxima_consulta IS NULL AND pix_expira_em IS NULL
      AND NOT EXISTS (SELECT 1 FROM cadmiv_recebimentos WHERE cobranca_id=$1)`, [cobranca.id]);
    let resposta = await api('GET', referencia);
    if (!resposta) {
      if (cobranca.pix_expira_em) throw erro(502, 'A cobrança registrada não foi localizada na Efí.');
      try {
        resposta = await api('PUT', referencia, {
          chave, calendario: { expiracao }, valor: { original: valor(cobranca.centavos) }
        });
      } catch (e) {
        resposta = await api('GET', referencia);
        if (!resposta) throw e;
      }
    }
    await verificar(cobranca, resposta);
    return estado(clienteId, { qr: true });
  }

  async function conciliar() {
    const { rows } = await db.query(`
      WITH lote AS (
        SELECT c.id FROM cadmiv_cobrancas c
        WHERE c.provedor=$1 AND c.pix_proxima_consulta<=now()
        AND NOT EXISTS (SELECT 1 FROM cadmiv_recebimentos r WHERE r.cobranca_id=c.id)
        ORDER BY c.pix_proxima_consulta LIMIT 8 FOR UPDATE SKIP LOCKED
      )
      UPDATE cadmiv_cobrancas c SET pix_proxima_consulta=now()+
        CASE WHEN c.pix_expira_em<=now() OR c.criado_em<now()-interval '1 day'
          THEN interval '1 hour' ELSE interval '1 minute' END
      FROM lote WHERE c.id=lote.id RETURNING c.*`, [provedor]);
    await Promise.all(rows.map(async cobranca => {
      try {
        const resposta = await api('GET', cobranca.referencia);
        if (resposta) await verificar(cobranca, resposta);
      } catch {
        console.error('CADMIV: falha ao conciliar cobrança Pix. A consulta será repetida.');
      }
    }));
  }
  return { estado, emitir, conciliar };
}

module.exports = { criarPix };
