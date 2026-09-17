'use strict';
async function api(path,body,method){
 const options=body===undefined?{}:{method:method||'POST',headers:{'Content-Type':'application/json','X-CADMIV':'1'},body:JSON.stringify(body)};
 const r=await fetch(path,options),data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível concluir.');return data;
}
function alternar(id,icone){const el=document.getElementById(id);el.type=el.type==='password'?'text':'password';document.getElementById(icone).textContent=el.type==='password'?'🙈':'👁️';}
function alternarVisibilidadeSenha(){alternar('login_senha','icone_olho');}
function alternarOlhoAlerta(){alternar('alerta_senha','icone_olho_alerta');}
async function realizarLogin(){
 const box=document.getElementById('alerta-login');
 try{await api('/api/login',{telefone:document.getElementById('login_telefone').value,senha:document.getElementById('login_senha').value});location.assign('botao.html');}
 catch(e){box.textContent=e.message;box.style.display='block';}
}
async function consultarChassi(){
 const result=document.getElementById('resultado_consulta');result.style.display='block';result.className='status-result';result.textContent='Consultando...';
 try{const d=await api('/api/consultar',{chassi:document.getElementById('input_agente').value});result.textContent=[d.mensagem,d.marca,d.modelo,d.cor].filter(Boolean).join(' — ');if(d.status==='ROUBO')result.classList.add('status-alert-furto');}
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
async function salvarAlteracoes(){try{await api('/api/me',{telefone:document.getElementById('cliente_telefone').value},'PATCH');alert('Telefone atualizado. Use este telefone no próximo login.');}catch(e){alert(e.message);}}
async function sair(){try{await api('/api/logout',{});location.assign('login.html');}catch(e){alert(e.message);}}
async function carregarCliente(){
 const d=await api('/api/me');
 const set=(id,value)=>{const el=document.getElementById(id);if(el){if(el.tagName==='INPUT')el.value=value;else el.textContent=value;}};
 set('cliente_nome',d.nome);set('cliente_telefone',d.telefone);set('cliente_modelo',d.marca+' — '+d.modelo);
 set('cartao_status','Situação: '+d.status+(d.status==='PENDENTE'?' — NÃO ATIVO':''));
 set('cliente_status','Situação: '+d.status+(d.status==='PENDENTE'?' — cadastro salvo, ainda não ativo.':''));
 set('caixa_nome_real',d.nome);set('caixa_cpf_real','CPF: '+d.cpf);set('caixa_chassi_real',d.marca+' — '+d.modelo+' — CHASSI: '+d.chassi);
 set('caixa_codigo_real','Registro: '+d.codigo);set('caixa_data_real','CADASTRADO EM: '+new Date(d.criado_em).toLocaleDateString('pt-BR'));
}
document.addEventListener('DOMContentLoaded',()=>{
 // Remove vestígios da versão antiga, que usava armazenamento local e dados pessoais na URL.
 for(const key of ['nome','cpf','chassi','codigo','cadmiv_nome','cadmiv_cpf','cadmiv_chassi','cadmiv_codigo'])localStorage.removeItem(key);
 if(location.search && location.pathname.endsWith('cartao.html'))history.replaceState(null,'',location.pathname);
 if(document.getElementById('cliente_nome')||document.getElementById('caixa_nome_real'))carregarCliente().catch(e=>{const el=document.getElementById('cliente_status');if(el)el.textContent=e.message;});
});
