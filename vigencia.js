'use strict';
// Datas de ativação/renovação só poderão ser gravadas pela futura integração
// de pagamentos, após validar a confirmação do provedor. Nenhuma rota pública as grava.
function umAnoApos(valor){
 const d=new Date(valor);if(!Number.isFinite(d.getTime()))throw Error('Data de pagamento inválida.');
 const mes=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()+1);
 if(d.getUTCMonth()!==mes)d.setUTCDate(0); // 29/02 vence em 28/02 no ano seguinte.
 return d.toISOString();
}
function vigencia(v,agora=new Date()){
 const inicio=v.renovado_em||v.ativado_em;
 const valido_ate=inicio?umAnoApos(inicio):null;
 const vencido=v.status==='ADORMECIDO'||!!(valido_ate&&new Date(valido_ate)<=agora);
 // Furto/roubo e desativação nunca são apagados pelo vencimento.
 const status=vencido&&v.status==='ATIVO'?'ADORMECIDO':v.status;
 return {valido_ate,vencido,status,renovacao_confirmada:!!v.renovado_em&&!!valido_ate&&!vencido&&status==='ATIVO'};
}
module.exports={umAnoApos,vigencia};
