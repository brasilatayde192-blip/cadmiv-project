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
function mostrarSaudeConsulta(saude){
 const caixa=document.getElementById('saude-consulta'),lista=document.getElementById('dados-saude-consulta');if(!caixa||!lista)return;
 caixa.hidden=true;lista.replaceChildren();if(!saude||typeof saude!=='object')return;
 const labels={sangue:'Tipo sanguíneo',latex:'Alergia a látex',medicamentos:'Alergias a medicamentos',contato_emergencia:'Contato de emergência',telefone_emergencia:'Telefone de emergência',medico:'Médico de preferência',telefone_medico:'Telefone do médico'};
 const parentes={pai:'Pai',mae:'Mãe',irmao:'Irmão(a)',tio:'Tio(a)',filho:'Filho(a)',primo:'Primo(a)',cunhado:'Cunhado(a)',enteado:'Enteado(a)',amigo:'Amigo(a)',vizinho:'Vizinho(a)'};
 for(const [key,label] of Object.entries(labels)){
  const value=saude[key];if(typeof value!=='string'||!value.trim())continue;
  const titulo=document.createElement('dt'),valor=document.createElement('dd');titulo.textContent=label;titulo.style.fontWeight='bold';
  valor.textContent=key==='latex'?({sim:'Sim',nao:'Não'}[value]||value):key==='contato_emergencia'?(parentes[value]||value):value;
  valor.style.margin='4px 0 14px';valor.style.overflowWrap='anywhere';lista.append(titulo,valor);
 }
 caixa.hidden=!lista.children.length;
}
let consultaAtual=0;
async function consultarVeiculo(body){
 const vez=++consultaAtual;mostrarSaudeConsulta(null);
 const result=document.getElementById('resultado_consulta');result.style.display='block';result.className='status-result';result.textContent='Consultando...';
 try{const d=await api('/api/consultar',body);if(vez!==consultaAtual)return;result.textContent=[d.mensagem,d.marca,nomeModelo(d.modelo),d.cor,d.chassi?'Chassi: '+d.chassi:'',d.chassi?'Compare estes dados com o veículo apresentado.':''].filter(Boolean).join(' — ');if(d.status==='ROUBO')result.classList.add('status-alert-furto');mostrarSaudeConsulta(d.saude);}
 catch(e){if(vez===consultaAtual){result.textContent=e.message;mostrarSaudeConsulta(null);}}
}
function consultarChassi(){return consultarVeiculo({chassi:document.getElementById('input_agente').value});}
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
  if(codigo)consultarVeiculo({codigo});
 }
 // Remove vestígios da versão antiga, que usava armazenamento local e dados pessoais na URL.
 for(const key of ['nome','cpf','chassi','codigo','cadmiv_nome','cadmiv_cpf','cadmiv_chassi','cadmiv_codigo'])localStorage.removeItem(key);
 if(location.search && location.pathname.endsWith('cartao.html'))history.replaceState(null,'',location.pathname);
 if(document.getElementById('cliente_nome')||document.getElementById('caixa_nome_real'))carregarCliente().catch(e=>{const el=document.getElementById('cliente_status');if(el)el.textContent=e.message;});
});
