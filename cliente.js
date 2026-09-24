'use strict';
function nomeModelo(value){return ({bike_comum:'Bicicleta comum',bike_sem_acelerador:'Bicicleta elétrica sem acelerador',bike_com_acelerador:'Bicicleta elétrica com acelerador',bike_esportiva_alto_custo:'Bicicleta esportiva',bike_triciclo_comum:'Triciclo',bike_triciclo_especial:'Triciclo adaptado',patinete:'Patinete',monociclo:'Monociclo'})[value]||value;}
async function api(path,body,method){
 const options=body===undefined?{}:{method:method||'POST',headers:{'Content-Type':'application/json','X-CADMIV':'1'},body:JSON.stringify(body)};
 const r=await fetch(path,options),data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível concluir.');return data;
}
function alternar(id,icone){const el=document.getElementById(id),botao=document.getElementById(icone),mostrar=el.type==='password';el.type=mostrar?'text':'password';botao.textContent=mostrar?'🐵':'🙈';botao.setAttribute('aria-label',mostrar?'Ocultar senha':'Mostrar senha');botao.setAttribute('aria-pressed',String(mostrar));}
function alternarVisibilidadeSenha(){alternar('login_senha','icone_olho');}
function alternarOlhoAlerta(){alternar('alerta_senha','icone_olho_alerta');}
async function realizarLogin(){
 const box=document.getElementById('alerta-login');
 try{const d=await api('/api/login',{telefone:document.getElementById('login_telefone').value,senha:document.getElementById('login_senha').value});if(d.renovar){await carregarRenovacao();return;}location.assign('botao.html');}
 catch(e){box.textContent=e.message;box.style.display='block';}
}
async function consultarChassi(){
 const result=document.getElementById('resultado_consulta');result.style.display='block';result.className='status-result';result.textContent='Consultando...';
 try{const d=await api('/api/consultar',{chassi:document.getElementById('input_agente').value});result.textContent=[d.mensagem,d.marca,nomeModelo(d.modelo),d.cor,d.chassi?'Chassi: '+d.chassi:'',d.chassi?'Compare estes dados com o veículo apresentado.':''].filter(Boolean).join(' — ');if(d.status==='ROUBO')result.classList.add('status-alert-furto');}
 catch(e){result.textContent=e.message;}
}
function avancarFluxo(){location.assign('termos.html');}
function finalizarProcesso(){location.assign('cartao.html');}
function abrirVerificacaoAlerta(){document.getElementById('caixa-validacao').style.display='block';}
async function confirmarBloqueioTotal(){
 try{
  const senha=document.getElementById('alerta_senha').value;
  await api('/api/login',{telefone:document.getElementById('alerta_id').value,senha});
  await api('/api/alerta',{senha});document.getElementById('alerta_senha').value='';alert('Alerta de furto ou roubo salvo no CADMIV.');
 }catch(e){alert(e.message);}
}
async function dispararAlertaCadmiv(){
 try{await api('/api/alerta',{senha:document.getElementById('senha-confirmacao').value});document.getElementById('senha-confirmacao').value='';alert('Alerta de furto ou roubo salvo no CADMIV.');await carregarCliente();}catch(e){alert(e.message);}
}
function salvarAlteracoes(){location.assign('cadastro.html?editar=1');}
async function sair(){try{await api('/api/logout',{});location.assign('login.html');}catch(e){alert(e.message);}}
async function carregarCliente(){
 const d=await api('/api/me');if(d.vencido){location.replace('login.html?renovar=1');return;}
 const set=(id,value)=>{const el=document.getElementById(id);if(el){if(el.tagName==='INPUT')el.value=value;else el.textContent=value;}};
 set('cliente_nome',d.nome);set('cliente_telefone',d.telefone);set('cliente_modelo',d.marca+' — '+nomeModelo(d.modelo));
 set('cartao_status','Situação: '+d.status+(d.status==='PENDENTE'?' — NÃO ATIVO':''));
 if(!document.getElementById('pessoa-cartao'))set('cliente_status','Situação: '+d.status+(d.status==='PENDENTE'?' — cadastro salvo, ainda não ativo.':''));
 if(typeof iniciarCartoes==='function')iniciarCartoes(d);
 set('caixa_nome_real',d.nome);set('caixa_chassi_real',d.marca+' — '+nomeModelo(d.modelo)+' — CHASSI: '+d.chassi);
 const qr=document.getElementById('qr-veiculo'),link=document.getElementById('link-consulta');
 if(qr&&link){qr.src='/api/me/qr';qr.hidden=false;link.href='fiscalizacao.html#codigo='+encodeURIComponent(d.codigo);link.hidden=false;}
 set('caixa_codigo_real','Referência: '+d.codigo.slice(0,8).toUpperCase()+'…'+d.codigo.slice(-4).toUpperCase());set('caixa_data_real',(d.renovado_em?'RENOVADO EM: ':'CADASTRADO EM: ')+new Date(d.renovado_em||d.criado_em).toLocaleDateString('pt-BR'));const validade=document.getElementById('validade-cartao');if(validade)validade.textContent=d.valido_ate?'VÁLIDO ATÉ: '+new Date(d.valido_ate).toLocaleDateString('pt-BR'):'';
}
document.addEventListener('DOMContentLoaded',()=>{
 if(document.getElementById('resultado_consulta')){
  const codigo=new URLSearchParams(location.hash.slice(1)).get('codigo');
  if(codigo){
   const result=document.getElementById('resultado_consulta');result.style.display='block';result.textContent='Consultando situação atual...';
   api('/api/consultar',{codigo}).then(d=>{result.textContent=[d.mensagem,d.marca,nomeModelo(d.modelo),d.cor,d.chassi?'Chassi: '+d.chassi:'',d.chassi?'Compare estes dados com o veículo apresentado.':''].filter(Boolean).join(' — ');if(d.status==='ROUBO')result.classList.add('status-alert-furto');}).catch(()=>{result.textContent='Não foi possível confirmar a situação. Tente novamente com conexão à internet.';});
  }
 }
 // Remove vestígios da versão antiga, que usava armazenamento local e dados pessoais na URL.
 for(const key of ['nome','cpf','chassi','codigo','cadmiv_nome','cadmiv_cpf','cadmiv_chassi','cadmiv_codigo'])localStorage.removeItem(key);
 if(location.search && location.pathname.endsWith('cartao.html'))history.replaceState(null,'',location.pathname);
 if(document.getElementById('cliente_nome')||document.getElementById('caixa_nome_real'))carregarCliente().catch(e=>{const el=document.getElementById('cliente_status');if(el)el.textContent=e.message;});
});
