'use strict';
function alternarSenhaCadastro(id,botao){
 const campo=document.getElementById(id),mostrar=campo.type==='password';
 campo.type=mostrar?'text':'password';botao.textContent=mostrar?'🐵':'🙈';
 botao.setAttribute('aria-label',mostrar?'Ocultar senha':'Mostrar senha');botao.setAttribute('aria-pressed',String(mostrar));
}
function mostrarMensagemCadastro(texto,erro=false,destacar=false){
 const el=document.getElementById('mensagem-cadastro');
 el.classList.toggle('alerta-cadastro',erro);el.setAttribute('role',erro?'alert':'status');el.setAttribute('aria-live',erro?'assertive':'polite');
 el.textContent=texto;
 if(destacar){el.focus({preventScroll:true});el.scrollIntoView({block:'center',behavior:'instant'});}
}
async function apiCadastro(path,body,method='POST'){
 const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-CADMIV':'1'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível salvar.');return data;
}
function gerenciarCombo(){
 const titular=document.getElementById('foto-titular'),escolhido=!!document.querySelector('[name="combo"]:checked');
 if(titular){titular.style.display=escolhido?'block':'none';titular.querySelectorAll('input,button').forEach(el=>el.disabled=!escolhido);if(!escolhido&&typeof fecharFotoCadastro==='function')fecharFotoCadastro(0);}
 const count=Number(document.querySelector('[name="combo"]:checked')?.value||1)-1;
 for(let i=1;i<=2;i++){
  const block=document.getElementById('dep'+i),active=i<=count;
  block.style.display=active?'block':'none';
  block.querySelectorAll('input,select,button').forEach(el=>{el.disabled=!active;el.required=active&&!!el.name;});
  if(!active&&typeof fecharFotoCadastro==='function')fecharFotoCadastro(i);
 }
 document.getElementById('secao-responsabilidade').style.display=count?'block':'none';
 document.getElementById('responsabilidade').disabled=!count;
 document.getElementById('responsabilidade').required=!!count;
}
function forcarAberturaDependentes(){gerenciarCombo();}
function verificarIdadeCompleta(){return true;}
function mascaraCPF(el){
 const v=el.value.replace(/\D/g,'').slice(0,11);
 el.value=v.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4');
}
function verificarContestacaoVeiculo(){
 if(window.cadmivEdicao?.ativo)return;
 const el=document.getElementById('cadastro_anterior');el.setCustomValidity(el.value==='Sim'?'Procure o suporte para transferência do cadastro existente.':'');
}
let chassiRequest=0;
async function verificarChassiCadastrado(){
 if(window.cadmivEdicao?.ativo)return;
 const input=document.getElementById('chassi_veiculo'),message=document.getElementById('alerta-trava');
 const value=input.value,request=++chassiRequest;input.setCustomValidity('');
 if(!value.trim()){message.style.display='none';return;}
 try{
  const d=await apiCadastro('/api/chassi/verificar',{chassi:value});
  if(request!==chassiRequest||input.value!==value)return;
  message.style.display=d.cadastrado?'block':'none';
  message.textContent='Este chassi ou número de série já está cadastrado no CADMIV. Não é permitido criar outro cadastro para este veículo.';
  input.setCustomValidity(d.cadastrado?message.textContent:'');
 }catch(e){if(request===chassiRequest){message.style.display='block';message.textContent='Não foi possível verificar agora. A conferência será repetida ao salvar.';}}
}
document.addEventListener('DOMContentLoaded',()=>{
 iniciarFotosCadastro();
 const nota=document.getElementById('nota-fiscal'),origens=[...document.querySelectorAll('[name="origem_sem_nota"]')];
 for(const opcao of origens)opcao.addEventListener('change',()=>{
  if(opcao.checked)for(const outra of origens)if(outra!==opcao)outra.checked=false;
  const semNota=origens.some(el=>el.checked);nota.disabled=semNota;nota.required=!semNota;
 });
 document.getElementById('data_emissao').value=new Date().toLocaleDateString('pt-BR');
 document.getElementById('cadmiv_ano').max=new Date().getFullYear();
 document.getElementById('chassi_veiculo').addEventListener('input',e=>{chassiRequest++;e.target.setCustomValidity('');document.getElementById('alerta-trava').style.display='none';});
 gerenciarCombo();
 const form=document.getElementById('form-cadastro');let saving=false;
 const avisosTraduzidos=new Set();
 let mostrarSetas=false;
 const setas=new Map();
 function atualizarSetas(){
  if(!mostrarSetas)return;
  const destinos=new Set();
  for(const campo of form.querySelectorAll('input,select,textarea')){
   const invalido=campo.willValidate&&!campo.validity.valid;
   campo.classList.toggle('campo-pendente',invalido);
   if(invalido)campo.setAttribute('aria-invalid','true');else campo.removeAttribute('aria-invalid');
   if(!invalido)continue;
   let destino=campo.labels?.[0];
   // Os três campos da data compartilham a pergunta; cada campo mantém sua borda.
   for(let bloco=campo;!destino&&bloco&&bloco!==form;bloco=bloco.parentElement){
    if(bloco.previousElementSibling?.tagName==='LABEL')destino=bloco.previousElementSibling;
    if(campo.type==='radio'||campo.type==='checkbox'){destino=campo.parentElement;break;}
   }
   destino=destino||campo.parentElement;destinos.add(destino);
   if(!setas.has(destino)){
    const seta=document.createElement('span');seta.className='seta-cadastro';seta.textContent='➜';
    seta.setAttribute('aria-hidden','true');seta.title='Preencha ou confira este campo';
    destino.prepend(seta);setas.set(destino,seta);
   }
  }
  for(const [destino,seta] of setas)if(!destinos.has(destino)){seta.remove();setas.delete(destino);}
 }
 let primeiroInvalido=null;
 function limparAvisosTraduzidos(){
  for(const campo of avisosTraduzidos)campo.setCustomValidity('');
  avisosTraduzidos.clear();
  if(document.getElementById('mensagem-cadastro').classList.contains('alerta-cadastro'))mostrarMensagemCadastro('');
  atualizarSetas();
 }
 form.addEventListener('input',limparAvisosTraduzidos);
 form.addEventListener('change',limparAvisosTraduzidos);
 form.addEventListener('invalid',e=>{
  const campo=e.target,v=campo.validity;
  e.preventDefault();
  mostrarSetas=true;
  if(!primeiroInvalido){primeiroInvalido=campo;queueMicrotask(()=>{
   const alvo=primeiroInvalido;primeiroInvalido=null;
   const label=[...form.querySelectorAll('label[for]')].find(l=>l.htmlFor===alvo.id);
   const texto=alvo.validationMessage;
   mostrarMensagemCadastro(label?label.textContent.trim()+' '+texto:texto,true,true);
   atualizarSetas();
  });}
  if(v.customError)return;
  let aviso='Confira o valor preenchido neste campo.';
  if(v.valueMissing)aviso=campo.type==='checkbox'?'Marque esta opção para continuar.':campo.type==='radio'?'Selecione uma das opções.':campo.tagName==='SELECT'?'Selecione uma opção.':'Preencha este campo.';
  else if(v.typeMismatch)aviso=campo.type==='email'?'Informe um e-mail válido.':'Informe um valor válido.';
  else if(v.tooShort)aviso='Digite pelo menos '+campo.minLength+' caracteres.';
  else if(v.tooLong)aviso='Digite no máximo '+campo.maxLength+' caracteres.';
  else if(v.rangeUnderflow)aviso='Informe um valor igual ou maior que '+campo.min+'.';
  else if(v.rangeOverflow)aviso='Informe um valor igual ou menor que '+campo.max+'.';
  else if(v.badInput||v.stepMismatch)aviso='Informe um número válido.';
  campo.setCustomValidity(aviso);avisosTraduzidos.add(campo);
 },true);

 form.addEventListener('submit',async e=>{
  e.preventDefault();if(saving||!form.reportValidity())return;
  if(window.cadmivEdicao?.ativo&&!window.cadmivEdicao.pronto)return;
  const b=Object.fromEntries(new FormData(form));
  b.nascimento=document.getElementById('cadmiv_ano').value+'-'+document.getElementById('nasc_mes').value.padStart(2,'0')+'-'+document.getElementById('nasc_dia').value.padStart(2,'0');
  b.responsabilidade=document.getElementById('responsabilidade').checked&&!document.getElementById('responsabilidade').disabled;
  const message=document.getElementById('mensagem-cadastro');saving=true;
  form.querySelectorAll('[type="submit"]').forEach(el=>el.disabled=true);mostrarMensagemCadastro('Salvando cadastro...');
  const controles=[...form.querySelectorAll('input,select,textarea,button')].map(el=>[el,el.disabled]);for(const [el] of controles)el.disabled=true;
  try{if(window.cadmivEdicao?.ativo){await salvarEdicaoCadastro(b);return;}b.fotos=obterFotosCadastro(Number(b.combo));fecharTodasCameras();await apiCadastro('/api/cadastros',b);window.location.assign('validar.html');}
  catch(err){mostrarMensagemCadastro(err.message,true,true);}
  finally{saving=false;for(const [el,disabled] of controles)el.disabled=disabled;form.querySelectorAll('[type="submit"]').forEach(el=>el.disabled=false);}
 });
});

const fotosCadastro=new Map();
function fecharFotoCadastro(i){const f=fotosCadastro.get(i);if(!f)return;f.version++;if(f.stream)f.stream.getTracks().forEach(t=>t.stop());f.stream=null;f.el.querySelector('[data-video]').srcObject=null;for(const key of ['video','capturar','fechar'])f.el.querySelector('[data-'+key+']').hidden=true;}
function fecharTodasCameras(){for(const i of fotosCadastro.keys())fecharFotoCadastro(i);}
function obterFotosCadastro(count){
 const result=[];for(let i=0;i<count;i++){const f=fotosCadastro.get(i);if(f?.busy)throw Error('Aguarde a preparação da foto antes de salvar.');result.push(f?.data||null);}return result;
}
function iniciarFotosCadastro(){
 for(const el of document.querySelectorAll('[data-foto]')){
  const i=Number(el.dataset.foto),f={el,data:null,changed:false,version:0,fileVersion:0,busy:false,stream:null};fotosCadastro.set(i,f);
  const q=k=>el.querySelector('[data-'+k+']'),aviso=m=>q('aviso').textContent=m;
  function preview(source,width,height){const scale=Math.min(1,480/width,640/height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);f.changed=true;f.data=canvas.toDataURL('image/jpeg',.82);q('preview').src=f.data;q('preview').hidden=false;q('vazio').hidden=true;q('remover').hidden=false;aviso('Foto preparada para salvar com o cadastro.');}
  q('buscar').addEventListener('click',()=>q('arquivo').click());
  q('arquivo').addEventListener('change',async()=>{
   const file=q('arquivo').files[0];if(!file)return;fecharFotoCadastro(i);const version=++f.fileVersion;
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){aviso('Escolha uma foto JPEG, PNG ou WebP de até 10 MB.');q('arquivo').value='';return;}
   f.busy=true;aviso('Preparando foto...');const url=URL.createObjectURL(file);
   try{const img=new Image();img.src=url;await img.decode();if(version===f.fileVersion)preview(img,img.naturalWidth,img.naturalHeight);}catch{if(version===f.fileVersion)aviso('Não foi possível abrir a foto. Escolha outro arquivo.');}finally{URL.revokeObjectURL(url);if(version===f.fileVersion){f.busy=false;q('arquivo').value='';}}
  });
  q('camera').addEventListener('click',async()=>{
   fecharTodasCameras();if(!navigator.mediaDevices?.getUserMedia){aviso('Câmera indisponível. Use Buscar no Arquivo.');return;}
   const version=f.version;try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});if(version!==f.version){stream.getTracks().forEach(t=>t.stop());return;}f.stream=stream;q('video').srcObject=stream;for(const key of ['video','capturar','fechar'])q(key).hidden=false;aviso('Clique em Capturar Foto quando estiver pronto.');}catch{if(version===f.version)aviso('Autorize a câmera no navegador ou use Buscar no Arquivo.');}
  });
  q('capturar').addEventListener('click',()=>{const v=q('video');if(!v.videoWidth)return;f.fileVersion++;f.busy=false;preview(v,v.videoWidth,v.videoHeight);fecharFotoCadastro(i);});
  q('fechar').addEventListener('click',()=>fecharFotoCadastro(i));
  q('remover').addEventListener('click',()=>{fecharFotoCadastro(i);f.fileVersion++;f.busy=false;f.changed=true;f.data=null;q('preview').hidden=true;q('preview').removeAttribute('src');q('vazio').hidden=false;q('remover').hidden=true;q('arquivo').value='';aviso('Foto removida.');});
 }
 window.addEventListener('pagehide',fecharTodasCameras);
}
