'use strict';
const crypto=require('node:crypto');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function planos(db){return (await db.query('SELECT id,nome,centavos,atualizado_em FROM cadmiv_planos ORDER BY id')).rows;}

// Interface interna para o futuro adaptador do banco. Nunca exposta como confirmação pública.
// A referência é gerada no servidor e pode ser reservada antes da chamada ao provedor.
async function registrarCobranca(db,{clienteId,provedor,referencia,centavosAceitos}){
 if(!/^[a-z0-9_-]{1,60}$/.test(provedor)||typeof referencia!=='string'||!referencia||referencia.length>200)throw fail(400,'Referência de cobrança inválida.');
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  const {rows}=await c.query('SELECT v.combo,v.status,c.privado FROM cadmiv_veiculos v JOIN cadmiv_clientes c ON c.id=v.cliente_id WHERE c.id=$1 FOR UPDATE OF v',[clienteId]);
  if(!rows.length)throw fail(404,'Cadastro não localizado.');
  if(centavosAceitos!==undefined&&rows[0].status!=='PENDENTE')throw fail(409,'O cadastro não precisa de uma cobrança de adesão.');
  const existing=await c.query('SELECT * FROM cadmiv_cobrancas WHERE cliente_id=$1',[clienteId]);
  if(existing.rows.length){
   const old=existing.rows[0];
   if(old.provedor!==provedor||old.referencia!==referencia)throw fail(409,'O cadastro já possui uma cobrança.');
   if(centavosAceitos!==undefined&&old.centavos!==centavosAceitos)throw fail(409,'O valor mudou. Confira o valor antes de gerar o Pix.');
   await c.query('COMMIT');return old;
  }
  const price=await c.query('SELECT centavos FROM cadmiv_planos WHERE id=$1 FOR SHARE',[rows[0].combo]);
  if(centavosAceitos!==undefined&&price.rows[0].centavos!==centavosAceitos)throw fail(409,'O valor mudou. Confira o valor antes de gerar o Pix.');
  const uf=String(rows[0].privado?.uf||'').toUpperCase();
  const result=await c.query('INSERT INTO cadmiv_cobrancas(id,cliente_id,plano,centavos,uf,provedor,referencia) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[crypto.randomUUID(),clienteId,rows[0].combo,price.rows[0].centavos,/^[A-Z]{2}$/.test(uf)?uf:'NI',provedor,referencia]);
  await c.query('COMMIT');return result.rows[0];
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}

// O adaptador precisa autenticar a notificação E consultar a transação no banco antes de chamar.
// Recibo/foto, clique do cliente, status ATIVO e retorno do navegador não são confirmação.
async function confirmarPagamentoVerificado(db,{provedor,referencia,transacao,centavos,moeda,status,pagoEm}){
 if(status!=='CONFIRMADO'||moeda!=='BRL'||!Number.isSafeInteger(centavos)||centavos<=0||typeof transacao!=='string'||!transacao||transacao.length>200||!Number.isFinite(Date.parse(pagoEm))||Date.parse(pagoEm)>Date.now()+60000)throw fail(400,'Confirmação de pagamento inválida.');
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  const {rows}=await c.query('SELECT * FROM cadmiv_cobrancas WHERE provedor=$1 AND referencia=$2 FOR UPDATE',[provedor,referencia]);
  if(!rows.length)throw fail(404,'Cobrança desconhecida.');
  const charge=rows[0];
  if(charge.centavos!==centavos)throw fail(409,'Valor recebido diferente do valor da cobrança.');
  if(Date.parse(pagoEm)<Date.parse(charge.criado_em)-60000)throw fail(409,'Pagamento anterior à cobrança.');
  const old=await c.query('SELECT * FROM cadmiv_recebimentos WHERE cobranca_id=$1',[charge.id]);
  if(old.rows.length){
   if(old.rows[0].provedor!==provedor||old.rows[0].transacao!==transacao)throw fail(409,'A cobrança já tem outro recebimento.');
   await c.query('COMMIT');return {registrado:false,duplicado:true};
  }
  await c.query('INSERT INTO cadmiv_recebimentos(cobranca_id,provedor,transacao,pago_em) VALUES($1,$2,$3,$4)',[charge.id,provedor,transacao,pagoEm]);
  await c.query("UPDATE cadmiv_veiculos SET status='ATIVO',ativado_em=$2 WHERE cliente_id=$1 AND status='PENDENTE'",[charge.cliente_id,pagoEm]);
  await c.query('COMMIT');return {registrado:true,duplicado:false};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function resumo(db,agora=new Date()){
 const {rows}=await db.query(`WITH pagos AS (
 SELECT c.plano,c.uf,c.centavos,r.pago_em AT TIME ZONE 'America/Sao_Paulo' AS local
 FROM cadmiv_recebimentos r JOIN cadmiv_cobrancas c ON c.id=r.cobranca_id
 ), periodo AS (SELECT $1::timestamptz AT TIME ZONE 'America/Sao_Paulo' AS local)
 SELECT
 (SELECT count(*)::int FROM pagos,periodo WHERE pagos.local::date=periodo.local::date) AS hoje,
 (SELECT count(*)::int FROM pagos,periodo WHERE date_trunc('month',pagos.local)=date_trunc('month',periodo.local)) AS mes,
 (SELECT coalesce(sum(centavos),0)::bigint FROM pagos,periodo WHERE date_trunc('month',pagos.local)=date_trunc('month',periodo.local)) AS receita,
 (SELECT coalesce(json_agg(x),'[]') FROM (SELECT plano,count(*)::int AS quantidade,sum(centavos)::bigint AS centavos FROM pagos,periodo WHERE date_trunc('month',pagos.local)=date_trunc('month',periodo.local) GROUP BY plano ORDER BY plano) x) AS por_plano,
 (SELECT coalesce(json_agg(x),'[]') FROM (SELECT uf,count(*)::int AS quantidade FROM pagos,periodo WHERE date_trunc('month',pagos.local)=date_trunc('month',periodo.local) GROUP BY uf ORDER BY quantidade DESC,uf) x) AS por_uf`,[agora.toISOString()]);
 return {...rows[0],planos:await planos(db),atualizado_em:agora.toISOString(),fuso:'America/Sao_Paulo',pix_disponivel:false};
}
module.exports={planos,registrarCobranca,confirmarPagamentoVerificado,resumo};
