'use strict';
let consultandoRenovacao=false;
async function carregarRenovacao(){
 if(consultandoRenovacao)return;consultandoRenovacao=true;
 const box=document.getElementById('renovacao'),msg=document.getElementById('mensagem-renovacao');
 box.hidden=false;msg.textContent='Conferindo a validade do cartão...';
 for(const id of ['renovacao-pendente','renovacao-concluida','renovacao-acesso'])document.getElementById(id).hidden=true;
 try{
  const d=await api('/api/me/renovacao');
  document.querySelector('.login-container form').hidden=true;
  document.getElementById('login_senha').value='';document.getElementById('alerta-login').style.display='none';
  if(d.vencido){
   document.getElementById('renovacao-pendente').hidden=false;
   msg.textContent=d.status==='ROUBO'?'O alerta de furto ou roubo continua registrado. O cartão também está vencido.':'Cartão Digital vencido.';
  }else if(d.renovacao_confirmada){
   document.getElementById('renovacao-concluida').hidden=false;
   msg.textContent='Renovado em '+new Date(d.renovado_em).toLocaleDateString('pt-BR')+'. Válido até '+new Date(d.valido_ate).toLocaleDateString('pt-BR')+'.';
  }else{
   msg.textContent=d.status==='PENDENTE'?'Seu cadastro aguarda a primeira ativação.':'Não há renovação vencida identificada para este cadastro.';
   document.getElementById('renovacao-acesso').hidden=false;
  }
  box.focus({preventScroll:true});box.scrollIntoView({block:'center'});
 }catch(e){msg.textContent=e.message;document.querySelector('.login-container form').hidden=false;}
 finally{consultandoRenovacao=false;}
}
document.addEventListener('DOMContentLoaded',()=>{if(new URLSearchParams(location.search).get('renovar')==='1')carregarRenovacao();});
