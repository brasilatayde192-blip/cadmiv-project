'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const form=document.querySelector('form'),message=document.getElementById('mensagem');
 const reset=form.id==='redefinir-senha';
 let token=reset?new URLSearchParams(location.hash.slice(1)).get('token'):null;
 if(reset)history.replaceState(null,'',location.pathname);
 const button=form.querySelector('button[type="submit"]');
 if(reset&&!/^[a-f0-9]{64}$/.test(token||'')){
  message.textContent='Link inválido ou incompleto. Solicite outro link.';button.disabled=true;return;
 }
 const translated=new Set();
 form.addEventListener('invalid',e=>{
  if(e.target.validity.customError)return;
  e.target.setCustomValidity(e.target.validity.valueMissing?'Preencha este campo.':e.target.type==='email'?'Informe um e-mail válido.':'Use uma senha de 12 a 128 caracteres.');translated.add(e.target);
 },true);
 form.addEventListener('input',()=>{for(const el of translated)el.setCustomValidity('');translated.clear();});
 let busy=false;
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  const body=Object.fromEntries(new FormData(form));
  if(reset){
   if(body.senha!==body.confirmacao){message.textContent='As duas senhas precisam ser iguais.';return;}
   delete body.confirmacao;body.token=token;
  }
  busy=true;button.disabled=true;message.textContent='Aguarde...';
  try{
   const r=await fetch(reset?'/api/senha/redefinir':'/api/senha/solicitar',{
    method:'POST',headers:{'Content-Type':'application/json','X-CADMIV':'1'},body:JSON.stringify(body)
   });
   const data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível concluir. Tente novamente.');
   message.textContent=data.mensagem;
   if(reset){token=null;form.hidden=true;document.getElementById('entrar').hidden=false;}
  }catch(e){message.textContent=e.message==='Failed to fetch'?'Não foi possível conectar. Confira sua conexão e tente novamente.':e.message;}
  finally{busy=false;button.disabled=false;}
 });
});
