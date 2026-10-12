'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const form=document.getElementById('aceite-termos'),check=document.getElementById('aceite-contato'),button=document.getElementById('prosseguir-cadastro'),message=document.getElementById('mensagem-termos');
 check.checked=false;button.disabled=true;
 try{sessionStorage.removeItem('cadmiv_aceite_contato');}catch{}
 check.addEventListener('change',()=>{button.disabled=!check.checked;message.textContent='';try{sessionStorage.removeItem('cadmiv_aceite_contato');}catch{}});
 form.addEventListener('submit',e=>{
  e.preventDefault();if(!check.checked||!form.reportValidity())return;
  try{sessionStorage.setItem('cadmiv_aceite_contato','2026-10-09');location.assign('cadastro.html');}
  catch{message.textContent='Permita o armazenamento desta sessão no navegador para prosseguir com o cadastro.';}
 });
});
