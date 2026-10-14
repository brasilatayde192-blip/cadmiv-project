'use strict';
const {vigencia}=require('./vigencia');
const {createHash}=require('node:crypto');
const DIA=86400000;
function lembrete(v,agora){
 if(!['ATIVO','ROUBO','ADORMECIDO'].includes(v.status))return null;
 const {valido_ate}=vigencia(v,agora);if(!valido_ate)return null;
 const restante=new Date(valido_ate)-agora;
 return restante<=0?{tipo:'vencido',valido_ate}:restante<=7*DIA?{tipo:'aviso',valido_ate}:null;
}
// O banco conserva a chave e o conteúdo para repetir falhas sem duplicar o e-mail.
// Após 23 horas, falhas ambíguas ficam pendentes para conferência, sem novo envio.
async function enviarLembretes(db,{send,origin,from,now=()=>new Date()}){
 if(!send||!from)return;
 const url=new URL('/login.html?renovar=1',origin);
 if(url.protocol!=='https:')throw Error('Configure APP_ORIGIN com HTTPS para os lembretes.');
 const agora=now();
 const {rows}=await db.query("SELECT c.id,c.email,v.status,v.ativado_em,v.renovado_em FROM cadmiv_clientes c JOIN cadmiv_veiculos v ON v.cliente_id=c.id WHERE v.status IN ('ATIVO','ROUBO','ADORMECIDO')");
 for(const v of rows){
  const aviso=lembrete(v,agora);if(!aviso)continue;
  const key='renovacao-'+createHash('sha256').update(v.id+'|'+aviso.valido_ate+'|'+aviso.tipo).digest('hex');
  const data=new Date(aviso.valido_ate).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const payload={from,to:[v.email],subject:'CADMIV — lembrete de renovação do Cartão Digital',text:
   'Prezado cliente,\n\n'+(aviso.tipo==='vencido'?'Seu Cartão Digital venceu em ':'Seu Cartão Digital vencerá em ')+data+'.\n\nSeu cadastro continua guardado na CADMIV. Acesse sua conta para consultar a situação e as orientações de renovação:\n'+url.href+'\n\nA nova validade de um ano começa após a confirmação do pagamento da renovação. Se o PIX ainda estiver indisponível, aguarde a liberação na sua área do cliente.\n\nA CADMIV não solicita sua senha por e-mail.\n\nCADMIV — Cadastro Mobilidade Individual Veículo Autopropelido'};
  await db.query('INSERT INTO cadmiv_lembretes(chave,cliente_id,payload,criado_em,tentar_em) VALUES($1,$2,$3,$4,$4) ON CONFLICT DO NOTHING',[key,v.id,JSON.stringify(payload),agora]);
  const claim=await db.query("UPDATE cadmiv_lembretes SET tentar_em=$2::timestamptz+interval '1 hour' WHERE chave=$1 AND enviado_em IS NULL AND tentar_em<=$2 AND criado_em>$2::timestamptz-interval '23 hours' RETURNING payload",[key,agora]);
  if(!claim.rows.length)continue;
  try{
   await send({payload:claim.rows[0].payload,key});
   await db.query('UPDATE cadmiv_lembretes SET enviado_em=$2 WHERE chave=$1',[key,now()]);
  }catch{console.error('Lembrete de renovação pendente: confira o serviço de e-mail.');}
 }
}
function iniciarLembretes(db,options){
 let executando=false;
 const run=async()=>{if(executando)return;executando=true;try{await enviarLembretes(db,options);}catch{console.error('Não foi possível verificar lembretes de renovação.');}finally{executando=false;}};
 run();const timer=setInterval(run,3600000);timer.unref();return ()=>clearInterval(timer);
}
module.exports={lembrete,enviarLembretes,iniciarLembretes};
