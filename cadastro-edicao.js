'use strict';
window.cadmivEdicao={ativo:new URLSearchParams(location.search).get('editar')==='1',pronto:false,combo:0};
const camposEditaveis=['telefone','email','nascimento','marca','modelo','cor','ano','estado_conservacao','dep1_nome','dep1_parentesco','dep2_nome','dep2_parentesco','responsabilidade','cep','logradouro','numero','bairro','cidade','uf','contato_emergencia','telefone_emergencia','sangue','latex','medicamentos','medico','telefone_medico'];
async function salvarEdicaoCadastro(b){
 const body={senha_atual:document.getElementById('senha-atual-edicao').value,fotos:{}};
 for(const key of camposEditaveis)if(Object.hasOwn(b,key))body[key]=b[key];
 for(let i=0;i<window.cadmivEdicao.combo;i++){const f=fotosCadastro.get(i);if(f.busy)throw Error('Aguarde a preparação da foto.');if(f.changed)body.fotos[i]=f.data;}
 fecharTodasCameras();await apiCadastro('/api/me',body,'PATCH');
 for(const f of fotosCadastro.values())f.changed=false;
 document.getElementById('senha-atual-edicao').value='';
 const message=document.getElementById('mensagem-cadastro');message.textContent='Alterações salvas. Use o telefone atualizado no próximo acesso.';message.scrollIntoView({block:'center'});
}
async function abrirCadastroExistente(){
 const form=document.getElementById('form-cadastro'),message=document.getElementById('mensagem-cadastro'),submit=document.getElementById('btn-enviar');submit.disabled=true;form.hidden=true;message.textContent='Carregando seu cadastro...';
 try{
  const response=await fetch('/api/me',{cache:'no-store'});if(!response.ok)throw Error('Entre na sua conta para editar ou excluir seu cadastro.');const d=await response.json();
  const values={...d.privado,...d};
  for(const [key,value] of Object.entries(values))for(const el of form.querySelectorAll('[name="'+key+'"]')){if(el.type==='radio')el.checked=el.value===String(value);else if(el.type==='checkbox')el.checked=!!value;else if(typeof value==='string'||typeof value==='number')el.value=value;}
  d.dependentes.forEach((dep,i)=>{form.querySelector('[name="dep'+(i+1)+'_nome"]').value=dep.nome;form.querySelector('[name="dep'+(i+1)+'_parentesco"]').value=dep.parentesco;});
  const nascimento=String(d.nascimento).slice(0,10).split('-');document.getElementById('cadmiv_ano').value=nascimento[0];document.getElementById('nasc_mes').value=String(Number(nascimento[1]));document.getElementById('nasc_dia').value=String(Number(nascimento[2]));
  for(const key of ['nome','cpf','chassi','nota_fiscal']){const el=form.querySelector('[name="'+key+'"]');el.readOnly=true;el.setAttribute('aria-readonly','true');}
  for(const el of form.querySelectorAll('[name="combo"]')){el.checked=el.value===String(d.combo);el.disabled=true;}
  gerenciarCombo();window.cadmivEdicao.combo=Number(d.combo);
  for(const el of form.querySelectorAll('[name="origem_sem_nota"]')){el.checked=el.value===d.origem_sem_nota;el.disabled=true;}
  document.getElementById('sem-nota').open=!!d.origem_sem_nota;
  const nota=form.querySelector('[name="nota_fiscal"]');nota.required=!d.origem_sem_nota;
  const senha=form.querySelector('[name="senha"]');senha.disabled=true;senha.required=false;senha.parentElement.hidden=true;form.querySelector('label[for="senha-confirmacao"]').hidden=true;
  const anterior=document.getElementById('cadastro_anterior');anterior.value='Não';anterior.disabled=true;anterior.setCustomValidity('');
  document.getElementById('data_emissao').value=new Date(d.criado_em).toLocaleDateString('pt-BR');
  document.getElementById('senha-edicao').hidden=false;document.getElementById('senha-atual-edicao').required=true;
  document.getElementById('abrir-exclusao').hidden=false;document.getElementById('acesso-edicao').hidden=true;
  document.querySelector('.container h2').textContent='Alterar meu Cadastro';submit.textContent='Salvar Alterações';
  for(let i=0;i<Number(d.combo);i++){
   const f=fotosCadastro.get(i);try{const r=await fetch('/api/me/foto/'+i,{cache:'no-store'});if(r.status===404)continue;if(!r.ok)throw Error();const url=URL.createObjectURL(await r.blob()),img=f.el.querySelector('[data-preview]');img.src=url;await img.decode();img.hidden=false;f.el.querySelector('[data-vazio]').hidden=true;f.el.querySelector('[data-remover]').hidden=false;URL.revokeObjectURL(url);}catch{f.el.querySelector('[data-aviso]').textContent='A foto existente não carregou. Ela será mantida se você não escolher outra.';}
  }
  window.cadmivEdicao.pronto=true;message.textContent='Confira os dados e confirme sua senha ao final para salvar. O plano contratado permanece o mesmo.';form.hidden=false;submit.disabled=false;
 }catch(e){message.textContent=e.message;const a=document.createElement('a');a.href='login.html';a.textContent='Entrar na minha conta';message.append(document.createElement('br'),a);}
}
document.addEventListener('DOMContentLoaded',()=>{
 if(!window.cadmivEdicao.ativo)return;
 abrirCadastroExistente();
 const dialog=document.getElementById('confirmar-exclusao'),message=document.getElementById('mensagem-exclusao'),button=document.getElementById('executar-exclusao');let deleting=false;
 document.getElementById('abrir-exclusao').addEventListener('click',()=>{message.textContent='';document.getElementById('senha-exclusao').value='';document.getElementById('texto-exclusao').value='';dialog.showModal();});
 document.getElementById('cancelar-exclusao').addEventListener('click',()=>{if(!deleting)dialog.close();});dialog.addEventListener('cancel',e=>{if(deleting)e.preventDefault();});
 button.addEventListener('click',async()=>{
  if(deleting)return;const body={motivo:document.getElementById('motivo-exclusao').value,senha:document.getElementById('senha-exclusao').value,confirmacao:document.getElementById('texto-exclusao').value};
  if(!body.motivo||!body.senha||body.confirmacao!=='EXCLUIR'){message.textContent='Escolha o motivo, informe sua senha e digite EXCLUIR.';return;}
  deleting=true;button.disabled=true;message.textContent='Excluindo seu cadastro...';
  try{await apiCadastro('/api/me/excluir',body);fecharTodasCameras();dialog.close();const container=document.querySelector('.container');container.replaceChildren();const h=document.createElement('h2');h.textContent='Cadastro excluído';const p=document.createElement('p');p.textContent='Seus dados e os do veículo foram removidos deste sistema. O acesso à conta foi encerrado.';const a=document.createElement('a');a.href='index.html';a.textContent='Voltar ao Início';container.append(h,p,a);}
  catch(e){message.textContent=e.message;}finally{deleting=false;button.disabled=false;document.getElementById('senha-exclusao').value='';}
 });
});
